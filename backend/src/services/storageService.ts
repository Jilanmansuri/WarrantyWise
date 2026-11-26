import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { cloudinary, isCloudinaryConfigured } from '../config/clients';
import { env } from '../config/env';
import { AppError } from '../utils';

export interface StoredFileResult {
  storageProvider: 'cloudinary' | 'local';
  url: string;
  publicId: string;
  resourceType: 'image' | 'raw';
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

export async function uploadFileToStorage(params: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  userId: string;
  subFolder?: string;
}): Promise<StoredFileResult> {
  const { buffer, originalName, mimeType, userId, subFolder = 'documents' } = params;
  const isImage = mimeType.startsWith('image/');
  const resourceType: 'image' | 'raw' = isImage ? 'image' : 'raw';

  if (env.storageProvider === 'cloudinary') {
    if (!isCloudinaryConfigured()) {
      throw new AppError(
        'Cloudinary storage is enabled but credentials are not configured in environment variables.',
        503,
        'STORAGE_NOT_CONFIGURED'
      );
    }

    const folder = `${env.cloudinaryFolder}/${userId}/${subFolder}`;
    return new Promise<StoredFileResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error || !result) {
            reject(
              new AppError(
                error?.message || 'Failed to upload file to Cloudinary.',
                502,
                'CLOUDINARY_UPLOAD_FAILED'
              )
            );
            return;
          }
          resolve({
            storageProvider: 'cloudinary',
            url: result.secure_url,
            publicId: result.public_id,
            resourceType,
          });
        }
      );
      uploadStream.end(buffer);
    });
  }

  // Local authenticated disk storage adapter
  const safeName = `${crypto.randomUUID()}-${sanitizeFileName(originalName || 'file')}`;
  const relativeKey = path.posix.join(userId, subFolder, safeName);
  const targetDir = path.join(env.localUploadDir, userId, subFolder);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(env.localUploadDir, relativeKey), buffer);

  return {
    storageProvider: 'local',
    url: `/api/documents/file/${relativeKey}`,
    publicId: relativeKey,
    resourceType,
  };
}

export async function deleteFileFromStorage(
  storageProvider: 'cloudinary' | 'local',
  publicId: string,
  resourceType: 'image' | 'raw' = 'image'
): Promise<void> {
  if (!publicId) return;

  if (storageProvider === 'cloudinary') {
    if (!isCloudinaryConfigured()) return;
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return;
  }

  const targetPath = path.resolve(env.localUploadDir, publicId);
  const resolvedRoot = path.resolve(env.localUploadDir);
  if (!targetPath.startsWith(resolvedRoot)) {
    return;
  }
  await fs.unlink(targetPath).catch(() => undefined);
}

export function resolveLocalFilePath(publicId: string): string {
  const targetPath = path.resolve(env.localUploadDir, publicId);
  const resolvedRoot = path.resolve(env.localUploadDir);
  if (!targetPath.startsWith(resolvedRoot)) {
    throw new AppError('Invalid file path.', 400, 'INVALID_PATH');
  }
  return targetPath;
}
