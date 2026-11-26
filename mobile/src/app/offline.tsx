import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { AppCard, EmptyState, StatusBadge } from '../components/ui/Common';
import { useOffline } from '../context/OfflineContext';
import { Palette, Radii, Spacing } from '../theme/tokens';
import { formatReadableDate } from '../utils/dateUtils';

export default function OfflineSyncScreen() {
  const {
    isOnline,
    isSyncing,
    queue,
    pendingCount,
    conflictCount,
    lastSyncedAt,
    lastSyncError,
    syncNow,
    discardMutation,
    forceRetryMutation,
  } = useOffline();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AppCard>
        <View style={styles.statusRow}>
          <MaterialCommunityIcons
            name={isOnline ? 'cloud-check-outline' : 'cloud-off-outline'}
            size={28}
            color={isOnline ? Palette.success : Palette.warning}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{isOnline ? 'Connected' : 'Offline Mode Active'}</Text>
            <Text style={styles.sub}>
              Last synced:{' '}
              {lastSyncedAt ? formatReadableDate(lastSyncedAt) : 'Not synced yet in this session'}
            </Text>
          </View>
          <StatusBadge status={isOnline ? 'Active' : 'Pending'} />
        </View>

        <Text style={styles.summary}>
          Pending changes: {pendingCount} • Conflicts: {conflictCount}
        </Text>

        {lastSyncError ? <Text style={styles.errText}>{lastSyncError}</Text> : null}

        <Button
          mode="contained"
          icon="sync"
          loading={isSyncing}
          disabled={!isOnline || isSyncing || pendingCount === 0}
          buttonColor={Palette.primary}
          onPress={() => void syncNow()}
          style={{ marginTop: Spacing.md, borderRadius: Radii.md }}
        >
          Sync Pending Changes Now
        </Button>
      </AppCard>

      <Text style={styles.sectionTitle}>Synchronization Queue ({queue.length})</Text>

      {queue.length === 0 ? (
        <EmptyState
          icon="check-circle-outline"
          title="All changes synchronized"
          subtitle="Products, warranties, repairs, and cached documents are up to date."
        />
      ) : (
        queue.map((item) => (
          <AppCard key={item.id} style={styles.itemCard}>
            <View style={styles.itemTop}>
              <Text style={styles.itemTitle}>{item.type}</Text>
              <StatusBadge status={item.status === 'conflict' ? 'Cancelled' : 'Pending'} />
            </View>
            <Text style={styles.itemMeta}>Queued: {item.createdAt}</Text>
            {item.conflictMessage ? (
              <Text style={styles.conflictText}>{item.conflictMessage}</Text>
            ) : null}
            <View style={styles.actions}>
              {item.status === 'conflict' ? (
                <Button
                  mode="contained-tonal"
                  compact
                  onPress={() => void forceRetryMutation(item.id)}
                >
                  Keep Mine &amp; Retry
                </Button>
              ) : null}
              <Button
                mode="text"
                compact
                textColor={Palette.danger}
                onPress={() => void discardMutation(item.id)}
              >
                Discard
              </Button>
            </View>
          </AppCard>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { fontSize: 17, fontWeight: '800', color: Palette.textPrimary },
  sub: { fontSize: 12, color: Palette.textSecondary, marginTop: 2 },
  summary: { fontSize: 13, fontWeight: '600', color: Palette.primary, marginTop: Spacing.md },
  errText: { fontSize: 12, color: Palette.danger, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary, marginTop: 4 },
  itemCard: { marginBottom: Spacing.sm },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 14, fontWeight: '700', color: Palette.textPrimary },
  itemMeta: { fontSize: 12, color: Palette.textMuted, marginTop: 3 },
  conflictText: { fontSize: 12, color: Palette.danger, marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: Spacing.sm },
});
