import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { AuthenticatedRequest } from '../middleware/auth';
import { FamilyMember } from '../models/FamilyMember';
import { NotificationPreference } from '../models/NotificationPreference';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { signAuthToken } from '../utils/jwt';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  phone: z.string().trim().max(30).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  avatarUrl: z.string().trim().url().or(z.literal('')).optional(),
  themePreference: z.enum(['light', 'system']).optional(),
  privacyHideAmounts: z.boolean().optional(),
  privacyBiometricLock: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  code: z.string().trim().length(6, 'Reset code must be 6 digits'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(100),
});

export const notificationPrefSchema = z.object({
  enabled: z.boolean().optional(),
  remind30Days: z.boolean().optional(),
  remind7Days: z.boolean().optional(),
  remind1Day: z.boolean().optional(),
  notifyNewProduct: z.boolean().optional(),
  amcRenewalAlerts: z.boolean().optional(),
  maintenanceReminders: z.boolean().optional(),
  familySharedReminders: z.boolean().optional(),
});

function sanitizeUser(user: InstanceType<typeof User>) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    avatarUrl: user.avatarUrl || '',
    themePreference: user.themePreference,
    privacyHideAmounts: user.privacyHideAmounts,
    privacyBiometricLock: user.privacyBiometricLock,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function register(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, email, password, phone } = req.body as z.infer<typeof registerSchema>;

    const existing = await User.findOne({ email });
    if (existing) {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      phone,
    });

    const preferences = await NotificationPreference.create({
      userId: user._id,
      enabled: true,
      remind30Days: true,
      remind7Days: true,
      remind1Day: true,
      notifyNewProduct: true,
      amcRenewalAlerts: true,
      maintenanceReminders: true,
      familySharedReminders: true,
    });

    // Link any pending family member invitations for this email
    await FamilyMember.updateMany(
      { email: user.email, linkedUserId: { $exists: false } },
      { $set: { linkedUserId: user._id } }
    );

    const token = signAuthToken({ userId: user._id.toString(), email: user.email });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: sanitizeUser(user),
        notificationPreferences: preferences,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    let preferences = await NotificationPreference.findOne({ userId: user._id });
    if (!preferences) {
      preferences = await NotificationPreference.create({ userId: user._id });
    }

    await FamilyMember.updateMany(
      { email: user.email, linkedUserId: { $exists: false } },
      { $set: { linkedUserId: user._id } }
    );

    const token = signAuthToken({ userId: user._id.toString(), email: user.email });

    res.json({
      success: true,
      data: {
        token,
        user: sanitizeUser(user),
        notificationPreferences: preferences,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    let preferences = await NotificationPreference.findOne({ userId: user._id });
    if (!preferences) {
      preferences = await NotificationPreference.create({ userId: user._id });
    }

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        notificationPreferences: preferences,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const updates = req.body as z.infer<typeof updateProfileSchema>;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body as z.infer<typeof forgotPasswordSchema>;
    const user = await User.findOne({ email });

    if (!user) {
      res.json({
        success: true,
        data: {
          message: 'If an account matches that email, a 6-digit reset code has been generated.',
        },
      });
      return;
    }

    const code = String(crypto.randomInt(100000, 999999));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    user.resetCodeHash = codeHash;
    user.resetCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    res.json({
      success: true,
      data: {
        message: 'A 6-digit password reset code has been generated and expires in 15 minutes.',
        ...(env.nodeEnv !== 'production' ? { devResetCode: code } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, code, newPassword } = req.body as z.infer<typeof resetPasswordSchema>;
    const user = await User.findOne({ email }).select('+resetCodeHash +resetCodeExpiresAt');

    if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) {
      throw new AppError('Invalid or expired reset code.', 400, 'INVALID_RESET_CODE');
    }

    if (user.resetCodeExpiresAt.getTime() < Date.now()) {
      throw new AppError('Reset code has expired. Please request a new one.', 400, 'RESET_CODE_EXPIRED');
    }

    const submittedHash = crypto.createHash('sha256').update(code).digest('hex');
    if (submittedHash !== user.resetCodeHash) {
      throw new AppError('Invalid or expired reset code.', 400, 'INVALID_RESET_CODE');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetCodeHash = undefined;
    user.resetCodeExpiresAt = undefined;
    await user.save();

    res.json({
      success: true,
      data: {
        message: 'Your password has been updated. You can now sign in with your new password.',
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getNotificationPreferences(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let preferences = await NotificationPreference.findOne({ userId: req.userId });
    if (!preferences) {
      preferences = await NotificationPreference.create({ userId: req.userId });
    }

    res.json({
      success: true,
      data: preferences,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateNotificationPreferences(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const updates = req.body as z.infer<typeof notificationPrefSchema>;
    const preferences = await NotificationPreference.findOneAndUpdate(
      { userId: req.userId },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      data: preferences,
    });
  } catch (err) {
    next(err);
  }
}
