import NetInfo from '@react-native-community/netinfo';
import { isAxiosError } from 'axios';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { maintenanceApi, productsApi } from '../services/api';
import {
  OfflineMutation,
  enqueueOfflineMutation,
  getLastSyncedTimestamp,
  getOfflineQueue,
  saveOfflineQueue,
  setLastSyncedTimestamp,
} from '../services/storage';

interface OfflineContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  queue: OfflineMutation[];
  pendingCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  queueMutation: (
    mutation: Omit<OfflineMutation, 'id' | 'clientMutationId' | 'createdAt' | 'status'>
  ) => Promise<OfflineMutation>;
  syncNow: () => Promise<void>;
  discardMutation: (mutationId: string) => Promise<void>;
  forceRetryMutation: (mutationId: string) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queue, setQueue] = useState<OfflineMutation[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) {
        await Promise.resolve();
        if (!active) return;
        setQueue([]);
        setLastSyncedAt(null);
        return;
      }
      const [q, ts] = await Promise.all([
        getOfflineQueue(userId),
        getLastSyncedTimestamp(userId),
      ]);
      if (!active) return;
      setQueue(q);
      setLastSyncedAt(ts);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const syncNow = useCallback(async () => {
    if (!userId || syncingRef.current || !isOnline) return;
    const currentQueue = await getOfflineQueue(userId);
    const pendingItems = currentQueue.filter((item) => item.status === 'pending');
    if (pendingItems.length === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);
    setLastSyncError(null);

    const remaining: OfflineMutation[] = [];
    for (const item of currentQueue) {
      if (item.status === 'conflict') {
        remaining.push(item);
        continue;
      }

      try {
        if (item.type === 'CREATE_MAINTENANCE') {
          await maintenanceApi.create({
            ...(item.payload as unknown as Parameters<typeof maintenanceApi.create>[0]),
            clientMutationId: item.clientMutationId,
          });
        } else if (item.type === 'UPDATE_MAINTENANCE_NOTE' && item.targetId) {
          await maintenanceApi.update(item.targetId, {
            notes: String(item.payload.notes || ''),
            version: item.baseVersion,
          });
        } else if (item.type === 'COMPLETE_MAINTENANCE' && item.targetId) {
          await maintenanceApi.complete(item.targetId, {
            ...(item.payload as Parameters<typeof maintenanceApi.complete>[1]),
            clientMutationId: item.clientMutationId,
          });
        } else if (item.type === 'UPDATE_PRODUCT_NOTE' && item.targetId) {
          await productsApi.update(item.targetId, {
            additionalNotes: String(item.payload.additionalNotes || ''),
            version: item.baseVersion,
          });
        }
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 409) {
          const msg =
            (err.response.data as { error?: { message?: string } })?.error?.message ||
            'Version conflict with server record.';
          remaining.push({ ...item, status: 'conflict', conflictMessage: msg });
        } else if (isAxiosError(err) && !err.response) {
          remaining.push(item);
          setLastSyncError('Network unavailable during sync. Remaining items queued.');
        } else {
          remaining.push({
            ...item,
            status: 'conflict',
            conflictMessage: err instanceof Error ? err.message : 'Sync failed',
          });
        }
      }
    }

    await saveOfflineQueue(userId, remaining);
    setQueue(remaining);
    if (remaining.length === 0) {
      const ts = await setLastSyncedTimestamp(userId);
      setLastSyncedAt(ts);
    }

    syncingRef.current = false;
    setIsSyncing(false);
  }, [userId, isOnline]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isOnline || !userId) return;
    const timer = setTimeout(() => {
      void syncNow();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOnline, userId, syncNow]);

  const queueMutation = async (
    mutation: Omit<OfflineMutation, 'id' | 'clientMutationId' | 'createdAt' | 'status'>
  ) => {
    if (!userId) {
      throw new Error('Authentication required for offline mutations.');
    }
    const entry = await enqueueOfflineMutation(userId, mutation);
    const updated = await getOfflineQueue(userId);
    setQueue(updated);
    return entry;
  };

  const discardMutation = async (mutationId: string) => {
    if (!userId) return;
    const updated = queue.filter((q) => q.id !== mutationId);
    await saveOfflineQueue(userId, updated);
    setQueue(updated);
  };

  const forceRetryMutation = async (mutationId: string) => {
    if (!userId) return;
    const updated = queue.map((q) =>
      q.id === mutationId
        ? { ...q, status: 'pending' as const, baseVersion: undefined, conflictMessage: undefined }
        : q
    );
    await saveOfflineQueue(userId, updated);
    setQueue(updated);
    if (isOnline) {
      await syncNow();
    }
  };

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        queue,
        pendingCount: queue.filter((q) => q.status === 'pending').length,
        conflictCount: queue.filter((q) => q.status === 'conflict').length,
        lastSyncedAt,
        lastSyncError,
        queueMutation,
        syncNow,
        discardMutation,
        forceRetryMutation,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used inside OfflineProvider');
  return ctx;
}
