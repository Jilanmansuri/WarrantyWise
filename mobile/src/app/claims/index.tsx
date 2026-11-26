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
import { AppCard, EmptyState, ErrorBanner, StatusBadge } from '../../components/ui/Common';
import { claimsApi, extractErrorMessage } from '../../services/api';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { CLAIM_STATUSES, WarrantyClaimRecord } from '../../types';
import { formatReadableDate } from '../../utils/dateUtils';

export default function ClaimsListScreen() {
  const router = useRouter();
  const [claims, setClaims] = useState<WarrantyClaimRecord[]>([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClaims = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        setError(null);
        const res = await claimsApi.list({
          status: statusFilter !== 'All' ? statusFilter : undefined,
        });
        setClaims(res.data);
        setDisclaimer(res.disclaimer);
      } catch (err) {
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter]
  );

  useFocusEffect(
    useCallback(() => {
      void loadClaims(false);
    }, [loadClaims])
  );

  const handleDelete = (claim: WarrantyClaimRecord) => {
    Alert.alert('Delete Claim', 'Remove this warranty claim record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await claimsApi.remove(claim._id);
            await loadClaims(false);
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
        <View style={styles.headerRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {['All', ...CLAIM_STATUSES].map((st) => (
              <Chip
                key={st}
                selected={statusFilter === st}
                onPress={() => setStatusFilter(st)}
                style={[styles.chip, statusFilter === st && styles.chipSel]}
              >
                {st}
              </Chip>
            ))}
          </ScrollView>
          <Pressable onPress={() => router.push('/claims/form')} style={styles.addBtn}>
            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errPad}>
          <ErrorBanner message={error} onRetry={() => void loadClaims(false)} />
        </View>
      ) : null}

      {disclaimer ? (
        <View style={styles.disclaimerBanner}>
          <MaterialCommunityIcons name="information-outline" size={16} color={Palette.textSecondary} />
          <Text style={styles.disclaimerText}>{disclaimer}</Text>
        </View>
      ) : null}

      {loading && claims.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      ) : (
        <FlatList
          data={claims}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadClaims(true)}
              tintColor={Palette.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="clipboard-check-outline"
              title="No warranty claims"
              subtitle="Start a guided claim checklist, track reference numbers, and organize supporting documents."
              actionLabel="Start New Claim"
              onAction={() => router.push('/claims/form')}
            />
          }
          renderItem={({ item }) => {
            const prod = typeof item.productId === 'object' ? item.productId : null;
            const completedSteps = item.checklist.filter((c) => c.completed).length;
            return (
              <AppCard style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.title}>
                      {prod ? `${prod.brand} ${prod.productName}` : 'Product Claim'}
                    </Text>
                    <Text style={styles.sub}>{item.manufacturerOrCenter}</Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>

                <Text style={styles.issueText} numberOfLines={2}>
                  {item.issueSummary}
                </Text>

                <View style={styles.metaGrid}>
                  {item.claimReferenceNumber ? (
                    <Text style={styles.metaText}>Ref #: {item.claimReferenceNumber}</Text>
                  ) : null}
                  <Text style={styles.metaText}>
                    Checklist: {completedSteps}/{item.checklist.length} completed •{' '}
                    {item.supportingDocumentIds?.length || 0} doc(s) • Updated{' '}
                    {formatReadableDate(item.updatedAt)}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Button
                    mode="contained-tonal"
                    compact
                    onPress={() =>
                      router.push({ pathname: '/claims/form', params: { id: item._id } })
                    }
                  >
                    Manage Claim
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
  disclaimerBanner: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  disclaimerText: { flex: 1, fontSize: 11, color: Palette.textSecondary, lineHeight: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  card: { marginBottom: Spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardInfo: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary },
  sub: { fontSize: 13, color: Palette.primaryAccent, fontWeight: '600', marginTop: 2 },
  issueText: { fontSize: 13, color: Palette.textPrimary, marginTop: Spacing.sm, lineHeight: 19 },
  metaGrid: { marginTop: Spacing.sm, gap: 3 },
  metaText: { fontSize: 12, color: Palette.textMuted },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
});
