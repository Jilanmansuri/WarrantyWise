import mongoose, { Document as MongooseDocument, Schema } from 'mongoose';

export interface IUser extends MongooseDocument {
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  avatarUrl?: string;
  themePreference: 'light' | 'system';
  privacyHideAmounts: boolean;
  privacyBiometricLock: boolean;
  resetCodeHash?: string;
  resetCodeExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [30, 'Phone number cannot exceed 30 characters'],
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    themePreference: {
      type: String,
      enum: ['light', 'system'],
      default: 'light',
    },
    privacyHideAmounts: {
      type: Boolean,
      default: false,
    },
    privacyBiometricLock: {
      type: Boolean,
      default: false,
    },
    resetCodeHash: {
      type: String,
      select: false,
    },
    resetCodeExpiresAt: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
