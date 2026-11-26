import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActivityIndicator, Chip, Searchbar } from 'react-native-paper';
import { AppCard } from '../../components/ui/AppCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';
import { extractErrorMessage, productsApi } from '../../services/api';
import { loadCachedSlice, saveCachedSlice } from '../../services/offlineStore';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { PRODUCT_CATEGORIES, Product } from '../../types';
import { formatCurrency, formatReadableDate } from '../../utils/dateUtils';

const STATUS_FILTERS = ['All', 'Active', 'Expiring Soon', 'Expired'] as const;
const SORT_OPTIONS = [
  { key: 'purchaseDate_desc', label: 'Newest Purchase' },
  { key: 'purchaseDate_asc', label: 'Oldest Purchase' },
  { key: 'expiry_asc', label: 'Expiring Soonest' },
] as const;

export default function ProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const { user } = useAuth();
  const userId = user?.id;
  const { isOnline } = useOffline();

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const status = statusOverride ?? params.status ?? 'All';
  const setStatus = setStatusOverride;
  const [sort, setSort] = useState<string>('purchaseDate_desc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterCachedProducts = useCallback(
    (cached: Product[]) => {
      const q = search.trim().toLowerCase();
      return cached
        .filter((p) => {
          if (category !== 'All' && p.category !== category) return false;
          if (status !== 'All' && p.warrantyMetrics.warrantyStatus !== status) return false;
          if (q) {
            const hay = [
              p.productName,
              p.brand,
              p.modelNumber,
              p.serialNumber,
              p.sellerName,
              p.invoiceNumber,
            ]
              .join(' ')
              .toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        })
        .sort((a, b) => {
          if (sort === 'purchaseDate_asc') {
            return a.purchaseDate.localeCompare(b.purchaseDate);
          }
          if (sort === 'expiry_asc') {
            return a.warrantyMetrics.daysUntilExpiry - b.warrantyMetrics.daysUntilExpiry;
          }
          return b.purchaseDate.localeCompare(a.purchaseDate);
        });
    },
    [category, search, sort, status]
  );

  const fetchProducts = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        setError(null);
        if (!isOnline && userId) {
          const cached = await loadCachedSlice<Product[]>(userId, 'products');
          if (cached) {
            setProducts(filterCachedProducts(cached));
            return;
          }
        }
        const list = await productsApi.list({
          search: search.trim() || undefined,
          category: category !== 'All' ? category : undefined,
          status: status !== 'All' ? status : undefined,
          sort,
        });
        setProducts(list);
        if (userId && !search && category === 'All' && status === 'All') {
          await saveCachedSlice(userId, 'products', list);
        }
      } catch (err) {
        if (userId) {
          const cached = await loadCachedSlice<Product[]>(userId, 'products');
          if (cached) {
            setProducts(filterCachedProducts(cached));
            return;
          }
        }
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [category, filterCachedProducts, isOnline, search, sort, status, userId]
  );

  useFocusEffect(
    useCallback(() => {
      void fetchProducts(false);
    }, [fetchProducts])
  );

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <OfflineBanner />
        </View>
        <View style={styles.searchRow}>
          <Searchbar
            placeholder="Search name, brand, serial..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            elevation={0}
          />
          <Pressable
            onPress={() => router.push('/products/form')}
            style={styles.addBtn}
            accessibilityLabel="Add new product"
          >
            <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Status filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {STATUS_FILTERS.map((st) => (
            <Chip
              key={st}
              selected={status === st}
              onPress={() => setStatus(st)}
              style={[styles.chip, status === st && styles.chipSelected]}
              textStyle={[styles.chipText, status === st && styles.chipTextSelected]}
            >
              {st}
            </Chip>
          ))}
        </ScrollView>

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {['All', ...PRODUCT_CATEGORIES].map((cat) => (
            <Chip
              key={cat}
              selected={category === cat}
              onPress={() => setCategory(cat)}
              compact
              style={[styles.chip, category === cat && styles.chipSelected]}
              textStyle={[styles.chipText, category === cat && styles.chipTextSelected]}
            >
              {cat}
            </Chip>
          ))}
        </ScrollView>

        {/* Sort pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}
        >
          <Text style={styles.sortLabel}>Sort:</Text>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setSort(opt.key)}
              style={[styles.sortPill, sort === opt.key && styles.sortPillActive]}
            >
              <Text style={[styles.sortPillText, sort === opt.key && styles.sortPillTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} onRetry={() => void fetchProducts(false)} />
        </View>
      ) : null}

      {loading && products.length === 0 ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void fetchProducts(true)}
              tintColor={Palette.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="devices"
              title="No matching products"
              subtitle={
                search || category !== 'All' || status !== 'All'
                  ? 'Try clearing your search or filters.'
                  : 'Add your first product manually or by scanning a purchase invoice.'
              }
              actionLabel="Add Product"
              onAction={() => router.push('/products/form')}
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/products/${item.id}`)}>
              <AppCard style={styles.productCard}>
                <View style={styles.cardTop}>
                  {item.productImageUrl ? (
                    <Image source={{ uri: item.productImageUrl }} style={styles.thumb} />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <MaterialCommunityIcons name="cube-outline" size={24} color={Palette.primary} />
                    </View>
                  )}

                  <View style={styles.cardMain}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {item.productName}
                      </Text>
                      <StatusBadge status={item.warrantyMetrics.warrantyStatus} />
                    </View>
                    <Text style={styles.brandLine} numberOfLines={1}>
                      {item.brand} • {item.category}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaText}>
                        Purchased: {formatReadableDate(item.purchaseDate)}
                      </Text>
                      <Text style={styles.metaText}>
                        {formatCurrency(item.purchasePrice, item.currency, user?.privacyHideAmounts)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardBottom}>
                  <Text style={styles.expiryText}>
                    Expires {formatReadableDate(item.warrantyEndDate)} (
                    {item.warrantyMetrics.remainingDays}d left)
                  </Text>
                  <View style={styles.readinessPill}>
                    <Text style={styles.readinessText}>
                      Claim Score: {item.claimReadiness.score}/100
                    </Text>
                  </View>
                </View>
              </AppCard>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  topSection: {
    backgroundColor: Palette.surface,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    backgroundColor: Palette.background,
    borderRadius: Radii.md,
    height: 46,
  },
  searchInput: {
    fontSize: 14,
    minHeight: 0,
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: Radii.md,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 4,
    gap: 8,
  },
  chip: {
    backgroundColor: Palette.background,
    borderRadius: Radii.pill,
  },
  chipSelected: {
    backgroundColor: Palette.primaryLight,
  },
  chipText: {
    fontSize: 12,
    color: Palette.textSecondary,
  },
  chipTextSelected: {
    color: Palette.primary,
    fontWeight: '700',
  },
  sortRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 6,
    paddingBottom: 4,
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.textMuted,
  },
  sortPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  sortPillActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  sortPillText: {
    fontSize: 12,
    color: Palette.textSecondary,
    fontWeight: '500',
  },
  sortPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  centerLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  productCard: {
    marginBottom: Spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Radii.md,
    backgroundColor: Palette.background,
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: Radii.md,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMain: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.textPrimary,
    flex: 1,
  },
  brandLine: {
    fontSize: 13,
    color: Palette.textSecondary,
    marginTop: 2,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  expiryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.primary,
  },
  readinessPill: {
    backgroundColor: Palette.surfaceMuted,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  readinessText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.textSecondary,
  },
});
