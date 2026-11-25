import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface EnvConfig {
  port: number;
  nodeEnv: string;
  mongoUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  storageProvider: 'cloudinary' | 'local';
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  cloudinaryFolder: string;
  ocrSpaceApiKey: string;
  localUploadDir: string;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const rawJwtSecret = process.env.JWT_SECRET;

if (!rawJwtSecret && nodeEnv === 'production') {
  throw new Error('JWT_SECRET environment variable must be set in production.');
}

const rawStorageProvider = (process.env.STORAGE_PROVIDER || '').toLowerCase();
const hasCloudinary =
  Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
  Boolean(process.env.CLOUDINARY_API_KEY) &&
  Boolean(process.env.CLOUDINARY_API_SECRET) &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

const storageProvider: 'cloudinary' | 'local' =
  rawStorageProvider === 'local'
    ? 'local'
    : rawStorageProvider === 'cloudinary'
      ? 'cloudinary'
      : hasCloudinary
        ? 'cloudinary'
        : 'local';

export const env: EnvConfig = {
  port: Number(process.env.PORT || 5000),
  nodeEnv,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warrantywise',
  jwtSecret: rawJwtSecret || 'warrantywise-dev-only-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  storageProvider,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || 'warrantywise',
  ocrSpaceApiKey: process.env.OCR_SPACE_API_KEY || '',
  localUploadDir: path.resolve(process.cwd(), 'uploads'),
};
