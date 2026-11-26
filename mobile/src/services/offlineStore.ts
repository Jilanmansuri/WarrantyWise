import AsyncStorage from '@react-native-async-storage/async-storage';

export type OfflineMutationType =
  | 'CREATE_MAINTENANCE'
  | 'UPDATE_MAINTENANCE_NOTE'
  | 'COMPLETE_MAINTENANCE'
  | 'UPDATE_PRODUCT_NOTE';

export interface OfflineMutation {
  id: string;
  clientMutationId: string;
  type: OfflineMutationType;
  targetId?: string;
  payload: Record<string, unknown>;
  baseVersion?: number;
  createdAt: string;
  status: 'pending' | 'conflict';
  conflictMessage?: string;
}

function cacheKey(userId: string, slice: string): string {
  return `ww_cache_${userId}_${slice}`;
}

function queueKey(userId: string): string {
  return `ww_sync_queue_${userId}`;
}

export async function saveCachedSlice<T>(userId: string, slice: string, data: T): Promise<void> {
  await AsyncStorage.setItem(cacheKey(userId, slice), JSON.stringify(data));
}

export async function loadCachedSlice<T>(userId: string, slice: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(cacheKey(userId, slice));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveCachedDocumentUri(docId: string, localUri: string): Promise<void> {
  await AsyncStorage.setItem(`ww_doc_uri_${docId}`, localUri);
}

export async function getCachedDocumentUri(docId: string): Promise<string | null> {
  return AsyncStorage.getItem(`ww_doc_uri_${docId}`);
}

export async function getOfflineQueue(userId: string): Promise<OfflineMutation[]> {
  const raw = await AsyncStorage.getItem(queueKey(userId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OfflineMutation[];
  } catch {
    return [];
  }
}

export async function saveOfflineQueue(userId: string, queue: OfflineMutation[]): Promise<void> {
  await AsyncStorage.setItem(queueKey(userId), JSON.stringify(queue));
}

export async function enqueueOfflineMutation(
  userId: string,
  mutation: Omit<OfflineMutation, 'id' | 'clientMutationId' | 'createdAt' | 'status'>
): Promise<OfflineMutation> {
  const queue = await getOfflineQueue(userId);
  const id = `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: OfflineMutation = {
    ...mutation,
    id,
    clientMutationId: id,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  queue.push(entry);
  await saveOfflineQueue(userId, queue);
  return entry;
}

export async function setLastSyncedTimestamp(userId: string): Promise<string> {
  const ts = new Date().toISOString();
  await AsyncStorage.setItem(cacheKey(userId, 'last_synced_at'), ts);
  return ts;
}

export async function getLastSyncedTimestamp(userId: string): Promise<string | null> {
  return AsyncStorage.getItem(cacheKey(userId, 'last_synced_at'));
}
