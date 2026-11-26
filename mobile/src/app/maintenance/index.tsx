import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Chip, TextInput } from 'react-native-paper';
import { AppCard } from '../../components/ui/AppCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';
import { extractErrorMessage, maintenanceApi } from '../../services/api';
import { loadCachedSlice, saveCachedSlice } from '../../services/offlineStore';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { MaintenanceRecord } from '../../types';
import { formatCurrency, formatReadableDate } from '../../utils/dateUtils';

export default function MaintenanceListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const { isOnline, queueMutation } = useOffline();

  const [items, setItems] = useState<MaintenanceRecord[]>([]);
  const [filter, setFilter] = useState<'All' | 'Scheduled' | 'Completed'>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Complete Service Modal
  const [completeTarget, setCompleteTarget] = useState<MaintenanceRecord | null>(null);
  const [serviceCost, setServiceCost] = useState('0');
  const [serviceProvider, setServiceProvider] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadList = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        setError(null);
        if (!isOnline && userId) {
          const cached = await loadCachedSlice<MaintenanceRecord[]>(userId, 'maintenances');
          if (cached) {
            setItems(filter === 'All' ? cached : cached.filter((m) => m.status === filter));
            return;
          }
        }
        const data = await maintenanceApi.list({ status: filter !== 'All' ? filter : undefined });
        setItems(data);
        if (userId && filter === 'All') {
          await saveCachedSlice(userId, 'maintenances', data);
        }
      } catch (err) {
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, isOnline, userId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadList(false);
    }, [loadList])
  );

  const handleOpenComplete = (item: MaintenanceRecord) => {
    setCompleteTarget(item);
    setServiceCost(String(item.estimatedCost || 0));
    setServiceProvider(item.serviceProvider || '');
    setServiceNotes('');
  };

  const handleCompleteSubmit = async () => {
    if (!completeTarget) return;
    setSubmitting(true);
    try {
      const payload = {
        cost: Number(serviceCost || 0),
        serviceProvider: serviceProvider.trim() || undefined,
        notes: serviceNotes.trim() || undefined,
      };
      if (isOnline) {
        await maintenanceApi.complete(completeTarget._id, payload);
        setCompleteTarget(null);
        await loadList(false);
      } else {
        await queueMutation({
          type: 'COMPLETE_MAINTENANCE',
          targetId: completeTarget._id,
          payload,
          baseVersion: completeTarget.version,
        });
        setCompleteTarget(null);
        Alert.alert(
          'Queued Offline',
          'Maintenance completion saved locally and will sync when connectivity returns.'
        );
      }
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (item: MaintenanceRecord) => {
    Alert.alert('Delete Schedule', `Remove "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await maintenanceApi.remove(item._id);
            await loadList(false);
          } catch (err) {
            Alert.alert('Error', extractErrorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <OfflineBanner />
        <View style={styles.headerRow}>
          <View style={styles.chips}>
            {(['All', 'Scheduled', 'Completed'] as const).map((st) => (
              <Chip
                key={st}
                selected={filter === st}
                onPress={() => setFilter(st)}
                style={[styles.chip, filter === st && styles.chipSel]}
              >
                {st}
              </Chip>
            ))}
          </View>
          <Pressable onPress={() => router.push('/maintenance/form')} style={styles.addBtn}>
            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errPad}>
          <ErrorBanner message={error} onRetry={() => void loadList(false)} />
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadList(true)}
              tintColor={Palette.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="tools"
              title="No maintenance schedules"
              subtitle="Set up recurring reminders for AC servicing, water purifier filters, laptop cleaning, and more."
              actionLabel="Schedule Maintenance"
              onAction={() => router.push('/maintenance/form')}
            />
          }
          renderItem={({ item }) => {
            const prod = typeof item.productId === 'object' ? item.productId : null;
            return (
              <AppCard style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.sub}>
                      {prod ? `${prod.brand} ${prod.productName}` : 'Product'} • {item.serviceType}
                    </Text>
                  </View>
                  <StatusBadge status={item.isOverdue ? 'Overdue' : item.status} />
                </View>

                <View style={styles.metaGrid}>
                  <Text style={styles.metaText}>
                    Next Service: {formatReadableDate(item.nextServiceDate)} (
                    {item.daysUntilDue < 0
                      ? `${Math.abs(item.daysUntilDue)}d overdue`
                      : `in ${item.daysUntilDue}d`}
                    )
                  </Text>
                  <Text style={styles.metaText}>
                    Last Serviced:{' '}
                    {item.lastServiceDate ? formatReadableDate(item.lastServiceDate) : 'Never'} •{' '}
                    {item.frequencyMonths > 0
                      ? `Every ${item.frequencyMonths} mo`
                      : 'One-time'}
                  </Text>
                  <Text style={styles.metaText}>
                    History: {item.history?.length || 0} completed • Est.{' '}
                    {formatCurrency(item.estimatedCost, 'USD', user?.privacyHideAmounts)}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Button
                    mode="contained-tonal"
                    compact
                    icon="check-circle-outline"
                    onPress={() => handleOpenComplete(item)}
                  >
                    Mark Serviced
                  </Button>
                  <Button
                    mode="text"
                    compact
                    onPress={() =>
                      router.push({ pathname: '/maintenance/form', params: { id: item._id } })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    mode="text"
                    compact
                    textColor={Palette.danger}
                    onPress={() => handleDelete(item)}
                  >
                    Delete
                  </Button>
                </View>
              </AppCard>
            );
          }}
        />
      )}

      <Modal visible={Boolean(completeTarget)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log Completed Maintenance</Text>
            <Text style={styles.modalSub}>{completeTarget?.title}</Text>
            <TextInput
              mode="outlined"
              label="Service Cost"
              value={serviceCost}
              onChangeText={setServiceCost}
              keyboardType="decimal-pad"
              style={styles.input}
              outlineStyle={styles.outline}
            />
            <TextInput
              mode="outlined"
              label="Technician / Service Provider"
              value={serviceProvider}
              onChangeText={setServiceProvider}
              style={styles.input}
              outlineStyle={styles.outline}
            />
            <TextInput
              mode="outlined"
              label="Service Notes"
              value={serviceNotes}
              onChangeText={setServiceNotes}
              multiline
              numberOfLines={3}
              style={styles.input}
              outlineStyle={styles.outline}
            />
            <View style={styles.modalBtns}>
              <Button mode="text" onPress={() => setCompleteTarget(null)}>
                Cancel
              </Button>
              <Button
                mode="contained"
                loading={submitting}
                disabled={submitting}
                buttonColor={Palette.primary}
                onPress={handleCompleteSubmit}
              >
                Save Service
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.background },
  topBar: {
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: Palette.background },
  chipSel: { backgroundColor: Palette.primaryLight },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: Radii.md,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errPad: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  card: { marginBottom: Spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardInfo: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary },
  sub: { fontSize: 13, color: Palette.textSecondary, marginTop: 2 },
  metaGrid: { marginTop: Spacing.sm, gap: 3 },
  metaText: { fontSize: 12, color: Palette.textMuted },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: { backgroundColor: Palette.surface, borderRadius: Radii.lg, padding: Spacing.xl },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Palette.textPrimary },
  modalSub: { fontSize: 13, color: Palette.textSecondary, marginBottom: Spacing.md },
  input: { marginBottom: Spacing.md, backgroundColor: Palette.surface },
  outline: { borderRadius: Radii.md },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
});
