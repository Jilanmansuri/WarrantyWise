import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';
import { DocumentRecord } from '../types';
import { documentsApi } from './api';
import { getAuthToken } from './storage';

export async function downloadDocumentToDevice(doc: DocumentRecord): Promise<string> {
  const safeName = `${doc._id}-${doc.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  if (Platform.OS === 'web') {
    const url = doc.storageProvider === 'cloudinary' ? doc.url : await documentsApi.getDownloadUrl(doc._id);
    await Linking.openURL(url);
    return url;
  }

  const target = new File(Paths.cache, safeName);
  if (doc.storageProvider === 'cloudinary') {
    const downloaded = await File.downloadFileAsync(doc.url, target, { idempotent: true });
    return downloaded.uri;
  }

  const token = await getAuthToken();
  const downloadUrl = await documentsApi.getDownloadUrl(doc._id);
  const downloaded = await File.downloadFileAsync(downloadUrl, target, {
    idempotent: true,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return downloaded.uri;
}

export async function shareDocumentRecord(doc: DocumentRecord): Promise<void> {
  const localUri = await downloadDocumentToDevice(doc);
  if (Platform.OS === 'web') return;
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not supported on this device.');
  }
  await Sharing.shareAsync(localUri, {
    mimeType: doc.mimeType,
    dialogTitle: `Share ${doc.title}`,
  });
}
