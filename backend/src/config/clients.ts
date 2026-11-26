import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(uri: string = env.mongoUri): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri);
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function isCloudinaryConfigured(): boolean {
  return (
    Boolean(env.cloudinaryCloudName) &&
    Boolean(env.cloudinaryApiKey) &&
    Boolean(env.cloudinaryApiSecret) &&
    env.cloudinaryCloudName !== 'your_cloud_name'
  );
}

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
}

export { cloudinary };
