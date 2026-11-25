import { NextFunction, Request, Response } from 'express';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { verifyAuthToken } from '../utils/jwt';

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
