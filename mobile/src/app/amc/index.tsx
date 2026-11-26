import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Chip } from 'react-native-paper';
import { AppCard } from '../../components/ui/AppCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';
import { amcApi, extractErrorMessage } from '../../services/api';
import { shareDocumentRecord } from '../../services/documentHelper';
import { loadCachedSlice, saveCachedSlice } from '../../services/offlineStore';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { AmcRecord, DocumentRecord } from '../../types';
import { formatCurrency, formatReadableDate } from '../../utils/dateUtils';

const STATUS_FILTERS = ['All', 'Active', 'Expiring Soon', 'Expired'] as const;

export default function AmcListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const { isOnline } = useOffline();

  const [amcs, setAmcs] = useState<AmcRecord[]>([]);
  const [filter, setFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAmcs = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        setError(null);
        if (!isOnline && userId) {
          const cached = await loadCachedSlice<AmcRecord[]>(userId, 'amcs');
          if (cached) {
            setAmcs(
              filter === 'All' ? cached : cached.filter((item) => item.status === filter)
            );
            return;
          }
        }
        const list = await amcApi.list({ status: filter !== 'All' ? filter : undefined });
        setAmcs(list);
        if (userId && filter === 'All') {
          await saveCachedSlice(userId, 'amcs', list);
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
      void loadAmcs(false);
    }, [loadAmcs])
  );

  const handleLogVisit = async (id: string) => {
    try {
      await amcApi.logVisit(id);
      await loadAmcs(false);
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  const handleDelete = (amc: AmcRecord) => {
    Alert.alert('Delete AMC Contract', `Remove contract with ${amc.providerName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await amcApi.remove(amc._id);
            await loadAmcs(false);
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {STATUS_FILTERS.map((st) => (
              <Chip
                key={st}
                selected={filter === st}
                onPress={() => setFilter(st)}
                style={[styles.chip, filter === st && styles.chipSel]}
              >
                {st}
              </Chip>
            ))}
          </ScrollView>
          <Pressable onPress={() => router.push('/amc/form')} style={styles.addBtn}>
            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errPad}>
          <ErrorBanner message={error} onRetry={() => void loadAmcs(false)} />
        </View>
      ) : null}

      {loading && amcs.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      ) : (
        <FlatList
          data={amcs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadAmcs(true)}
              tintColor={Palette.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="file-certificate-outline"
              title="No AMC contracts yet"
              subtitle="Track Annual Maintenance Contracts, service visits, and contract renewals."
              actionLabel="Add AMC Contract"
              onAction={() => router.push('/amc/form')}
            />
          }
          renderItem={({ item }) => {
            const prod = typeof item.productId === 'object' ? item.productId : null;
            const docObj =
              typeof item.contractDocumentId === 'object' && item.contractDocumentId
                ? item.contractDocumentId
                : null;
            return (
              <AppCard style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.title}>{item.providerName}</Text>
                    <Text style={styles.sub}>
                      {prod ? `${prod.brand} ${prod.productName}` : 'Product'}
                      {item.contractNumber ? ` • #${item.contractNumber}` : ''}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>

                <View style={styles.metaGrid}>
                  <Text style={styles.metaText}>
                    Term: {formatReadableDate(item.startDate)} → {formatReadableDate(item.endDate)}
                  </Text>
                  <Text style={styles.metaText}>
                    Visits: {item.completedVisitsCount}/{item.scheduledVisitsCount} completed
                    {item.nextVisitDate ? ` • Next: ${formatReadableDate(item.nextVisitDate)}` : ''}
                  </Text>
                  <Text style={styles.metaText}>
                    Cost: {formatCurrency(item.cost, 'USD', user?.privacyHideAmounts)} •{' '}
                    {item.remainingDays}d left
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Button
                    mode="contained-tonal"
                    compact
                    icon="check"
                    onPress={() => void handleLogVisit(item._id)}
                  >
                    Log Visit
                  </Button>
                  {docObj ? (
                    <Button
                      mode="text"
                      compact
                      icon="file-outline"
                      onPress={() =>
                        void shareDocumentRecord(docObj as unknown as DocumentRecord).catch((e) =>
                          Alert.alert('Error', extractErrorMessage(e))
                        )
                      }
                    >
                      Contract
                    </Button>
                  ) : null}
                  <Button
                    mode="text"
                    compact
                    onPress={() =>
                      router.push({ pathname: '/amc/form', params: { id: item._id } })
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  chips: { gap: 8 },
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
    gap: 4,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
});
