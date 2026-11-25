import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

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
