import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodSchema } from 'zod';
import { env } from '../config/env';
import { User } from '../models/User';
import { AppError, verifyAuthToken } from '../utils';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication token is required.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError('Authentication token is required.', 401, 'UNAUTHORIZED');
    }

    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.userId).select('_id email');
    if (!user) {
      throw new AppError('User account no longer exists.', 401, 'UNAUTHORIZED');
    }

    req.userId = user._id.toString();
    req.userEmail = user.email;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(new AppError('Invalid or expired authentication token.', 401, 'INVALID_TOKEN'));
  }
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          'Unsupported file type. Allowed formats: JPEG, PNG, WEBP, HEIC, and PDF.',
          400,
          'UNSUPPORTED_FILE_TYPE'
        )
      );
    }
  },
});

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      next(
        new AppError(details[0]?.message || 'Validation failed.', 400, 'VALIDATION_ERROR', details)
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File size exceeds the 10 MB limit.'
        : `Upload error: ${err.message}`;
    res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message } });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: 'Invalid resource identifier.' },
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: messages[0] || 'Database validation error.',
        details: messages,
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  if (env.nodeEnv !== 'test') {
    console.error('[ErrorHandler]', err);
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.nodeEnv === 'production' ? 'An unexpected error occurred.' : message,
    },
  });
}
