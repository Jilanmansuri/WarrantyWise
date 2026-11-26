import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { AppCard } from '../../components/ui/AppCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';
import {
  amcApi,
  dashboardApi,
  documentsApi,
  extractErrorMessage,
  maintenanceApi,
  productsApi,
} from '../../services/api';
import { syncWarrantyNotifications } from '../../services/notifications';
import {
  loadCachedSlice,
  saveCachedSlice,
  setLastSyncedTimestamp,
} from '../../services/offlineStore';
import { CardShadow, Palette, Radii, Spacing } from '../../theme/tokens';
import { DashboardData } from '../../types';
import { formatCurrency, formatReadableDate } from '../../utils/dateUtils';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, notificationPreferences } = useAuth();
  const userId = user?.id;
  const { isOnline } = useOffline();
  const [data, setData] = useState<DashboardData | null>(null);
  const hasDataRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else if (!hasDataRef.current) setLoading(true);

      try {
        setError(null);
        if (!isOnline && userId) {
          const cached = await loadCachedSlice<DashboardData>(userId, 'dashboard');
          if (cached) {
            hasDataRef.current = true;
            setData(cached);
            return;
          }
        }

        const [statsData, allProducts, amcs, maintenances, docs] = await Promise.all([
          dashboardApi.getStats(),
          productsApi.list({ sort: 'expiry_asc' }),
          amcApi.list(),
          maintenanceApi.list(),
          documentsApi.list(),
        ]);

        hasDataRef.current = true;
        setData(statsData);
        if (userId) {
          await Promise.all([
            saveCachedSlice(userId, 'dashboard', statsData),
            saveCachedSlice(userId, 'products', allProducts),
            saveCachedSlice(userId, 'amcs', amcs),
            saveCachedSlice(userId, 'maintenances', maintenances),
            saveCachedSlice(userId, 'documents', docs),
            setLastSyncedTimestamp(userId),
          ]);
        }

        await syncWarrantyNotifications(allProducts, notificationPreferences, {
          amcs,
          maintenances,
        });
      } catch (err) {
        if (userId) {
          const cached = await loadCachedSlice<DashboardData>(userId, 'dashboard');
          if (cached) {
            hasDataRef.current = true;
            setData(cached);
            setError(null);
            return;
          }
        }
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isOnline, notificationPreferences, userId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadDashboard(false);
    }, [loadDashboard])
  );

  const stats = data?.stats ?? {
    totalProducts: 0,
    activeWarranties: 0,
    expiringSoon: 0,
    expiredWarranties: 0,
    totalDocuments: 0,
    totalRepairs: 0,
    activeAmcContracts: 0,
    pendingClaims: 0,
    upcomingMaintenance: 0,
  };

  const warrantyAlerts = data?.warrantyAlerts || [];
  const maintenanceAlerts = data?.maintenanceAlerts || [];
  const upcomingEvents = data?.upcomingEvents || [];
  const recentActivity = data?.recentProductActivity || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadDashboard(true)}
          tintColor={Palette.primary}
        />
      }
    >
      <OfflineBanner />

      <View style={styles.greetingRow}>
        <View style={styles.greetingTextWrap}>
          <Text style={styles.greetingSub}>Hello, {user?.name?.split(' ')[0] || 'there'}</Text>
          <Text style={styles.greetingTitle}>Product Lifecycle Hub</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/calendar')}
            style={styles.bellButton}
            accessibilityLabel="Warranty and Service Calendar"
          >
            <MaterialCommunityIcons name="calendar-month-outline" size={22} color={Palette.primary} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/notifications')}
            style={styles.bellButton}
            accessibilityLabel="Notifications and reminder settings"
          >
            <MaterialCommunityIcons name="bell-outline" size={22} color={Palette.primary} />
            {stats.expiringSoon + maintenanceAlerts.length > 0 ? (
              <View style={styles.bellDot} />
            ) : null}
          </Pressable>
        </View>
      </View>

      {error ? <ErrorBanner message={error} onRetry={() => void loadDashboard(false)} /> : null}

      {loading && !data ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      ) : (
        <>
          {/* Enhanced Statistics Grid */}
          <View style={styles.statsGrid}>
            <StatCard
              label="Total Products"
              value={stats.totalProducts}
              icon="devices"
              accentColor={Palette.primary}
              accentBg={Palette.primaryLight}
              onPress={() => router.push('/(tabs)/products')}
            />
            <StatCard
              label="Active Warranties"
              value={stats.activeWarranties}
              icon="shield-check-outline"
              accentColor={Palette.success}
              accentBg={Palette.successBg}
              onPress={() => router.push({ pathname: '/(tabs)/products', params: { status: 'Active' } })}
            />
            <StatCard
              label="Expiring Soon"
              value={stats.expiringSoon}
              icon="clock-alert-outline"
              accentColor={Palette.warning}
              accentBg={Palette.warningBg}
              onPress={() =>
                router.push({ pathname: '/(tabs)/products', params: { status: 'Expiring Soon' } })
              }
            />
            <StatCard
              label="Expired Warranties"
              value={stats.expiredWarranties}
              icon="shield-off-outline"
              accentColor={Palette.danger}
              accentBg={Palette.dangerBg}
              onPress={() => router.push({ pathname: '/(tabs)/products', params: { status: 'Expired' } })}
            />
            <StatCard
              label="Active AMC"
              value={stats.activeAmcContracts}
              icon="file-certificate-outline"
              accentColor="#0F766E"
              accentBg="#CCFBF1"
              onPress={() => router.push('/amc')}
            />
            <StatCard
              label="Pending Claims"
              value={stats.pendingClaims}
              icon="clipboard-check-outline"
              accentColor={Palette.primaryAccent}
              accentBg={Palette.infoBg}
              onPress={() => router.push('/claims')}
            />
            <StatCard
              label="Upcoming Service"
              value={stats.upcomingMaintenance}
              icon="calendar-clock"
              accentColor={Palette.warning}
              accentBg={Palette.warningBg}
              onPress={() => router.push('/maintenance')}
            />
          </View>

          {/* Lifecycle Modules & Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions &amp; Modules</Text>
          <View style={styles.quickGrid}>
            <QuickActionTile
              icon="plus-box-outline"
              label="Add Product"
              onPress={() => router.push('/products/form')}
            />
            <QuickActionTile
              icon="line-scan"
              label="Scan / QR"
              onPress={() => router.push('/(tabs)/scan')}
            />
            <QuickActionTile
              icon="calendar-month-outline"
              label="Expiry Calendar"
              onPress={() => router.push('/calendar')}
            />
            <QuickActionTile
              icon="file-certificate-outline"
              label="AMC Tracker"
              onPress={() => router.push('/amc')}
            />
            <QuickActionTile
              icon="tools"
              label="Maintenance"
              onPress={() => router.push('/maintenance')}
            />
            <QuickActionTile
              icon="clipboard-text-outline"
              label="Claim Assistant"
              onPress={() => router.push('/claims')}
            />
            <QuickActionTile
              icon="account-group-outline"
              label="Family Vault"
              onPress={() => router.push('/family')}
            />
            <QuickActionTile
              icon="wrench-outline"
              label="Add Repair"
              onPress={() => router.push('/repairs/form')}
            />
          </View>

          {/* Warranty & Maintenance Alerts */}
          {warrantyAlerts.length > 0 || maintenanceAlerts.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
                Active Alerts
              </Text>
              <AppCard noPadding style={styles.listCard}>
                {[...warrantyAlerts, ...maintenanceAlerts].slice(0, 6).map((alert, idx, arr) => (
                  <Pressable
                    key={alert.id}
                    onPress={() => router.push(`/products/${alert.productId}`)}
                    style={[styles.listRow, idx < arr.length - 1 && styles.listRowBorder]}
                  >
                    <MaterialCommunityIcons
                      name={alert.id.startsWith('wa-') ? 'shield-alert-outline' : 'wrench-clock'}
                      size={22}
                      color={alert.severity === 'high' ? Palette.danger : Palette.warning}
                    />
                    <View style={styles.listInfo}>
                      <Text style={styles.listTitle}>{alert.title}</Text>
                      <Text style={styles.listMeta}>{alert.message}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={Palette.textMuted} />
                  </Pressable>
                ))}
              </AppCard>
            </>
          ) : null}

          {/* Upcoming Events */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <Pressable onPress={() => router.push('/calendar')}>
              <Text style={styles.sectionLink}>Open Calendar</Text>
            </Pressable>
          </View>
          {upcomingEvents.length > 0 ? (
            <AppCard noPadding style={styles.listCard}>
              {upcomingEvents.map((ev, idx) => (
                <Pressable
                  key={ev.id}
                  onPress={() => router.push(`/products/${ev.productId}`)}
                  style={[
                    styles.listRow,
                    idx < upcomingEvents.length - 1 && styles.listRowBorder,
                  ]}
                >
                  <View style={styles.listInfo}>
                    <Text style={styles.listTitle}>{ev.title}</Text>
                    <Text style={styles.listMeta}>{formatReadableDate(ev.date)}</Text>
                  </View>
                  <StatusBadge
                    status={
                      ev.type === 'maintenance'
                        ? 'Maintenance'
                        : ev.type === 'amc_expiry'
                          ? 'AMC'
                          : 'Warranty'
                    }
                  />
                </Pressable>
              ))}
            </AppCard>
          ) : (
            <EmptyState
              icon="calendar-check-outline"
              title="No upcoming events"
              subtitle="Add a product, AMC, or maintenance schedule to track upcoming milestones."
            />
          )}

          {/* Recent Product Activity */}
          {recentActivity.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
                Recent Product Activity
              </Text>
              <AppCard noPadding style={styles.listCard}>
                {recentActivity.slice(0, 5).map((ev, idx, arr) => (
                  <Pressable
                    key={ev._id}
                    onPress={() =>
                      ev.productId?._id ? router.push(`/products/${ev.productId._id}`) : undefined
                    }
                    style={[styles.listRow, idx < arr.length - 1 && styles.listRowBorder]}
                  >
                    <View style={styles.listInfo}>
                      <Text style={styles.listTitle}>{ev.title}</Text>
                      <Text style={styles.listMeta}>
                        {ev.productId ? `${ev.productId.brand} ${ev.productId.productName} • ` : ''}
                        {formatReadableDate(ev.eventDate)}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={Palette.textMuted} />
                  </Pressable>
                ))}
              </AppCard>
            </>
          ) : null}

          {/* Recent Repairs */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Repairs</Text>
            <Pressable onPress={() => router.push('/repairs/form')}>
              <Text style={styles.sectionLink}>+ Log Repair</Text>
            </Pressable>
          </View>
          {data && data.recentlyRepairedProducts.length > 0 ? (
            <AppCard noPadding style={styles.listCard}>
              {data.recentlyRepairedProducts.map((repair, idx) => {
                const prod = typeof repair.productId === 'object' ? repair.productId : null;
                const targetProductId =
                  typeof repair.productId === 'string'
                    ? repair.productId
                    : repair.productId?._id;
                return (
                  <Pressable
                    key={repair._id}
                    onPress={() =>
                      targetProductId ? router.push(`/products/${targetProductId}`) : undefined
                    }
                    style={[
                      styles.listRow,
                      idx < data.recentlyRepairedProducts.length - 1 && styles.listRowBorder,
                    ]}
                  >
                    <View style={styles.listInfo}>
                      <Text style={styles.listTitle}>
                        {prod ? `${prod.brand} ${prod.productName}` : 'Product Repair'}
                      </Text>
                      <Text style={styles.listMeta} numberOfLines={1}>
                        {repair.problemDescription} • {repair.repairCenter}
                      </Text>
                      <Text style={styles.listMeta}>
                        {formatReadableDate(repair.repairDate)} •{' '}
                        {formatCurrency(repair.repairCost, 'USD', user?.privacyHideAmounts)}
                      </Text>
                    </View>
                    <StatusBadge status={repair.repairStatus} />
                  </Pressable>
                );
              })}
            </AppCard>
          ) : (
            <EmptyState
              icon="wrench-outline"
              title="No repair history yet"
              subtitle="Log repair center visits, costs, and service invoices whenever a product is serviced."
            />
          )}
        </>
      )}
    </ScrollView>
  );
}

function QuickActionTile({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}
    >
      <View style={styles.quickIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={Palette.primary} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  greetingTextWrap: { flex: 1 },
  greetingSub: { fontSize: 13, color: Palette.textSecondary, fontWeight: '500' },
  greetingTitle: { fontSize: 22, fontWeight: '800', color: Palette.textPrimary, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: Radii.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...CardShadow,
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.warning,
  },
  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.textPrimary,
    marginBottom: Spacing.sm,
  },
  sectionLink: { fontSize: 13, fontWeight: '600', color: Palette.primaryAccent, marginBottom: Spacing.sm },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickTile: {
    width: '48.5%',
    backgroundColor: Palette.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...CardShadow,
  },
  pressed: { opacity: 0.85 },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: Radii.sm,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontSize: 13, fontWeight: '600', color: Palette.textPrimary, flexShrink: 1 },
  listCard: { overflow: 'hidden' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: Palette.border },
  listInfo: { flex: 1 },
  listTitle: { fontSize: 14, fontWeight: '700', color: Palette.textPrimary, marginBottom: 2 },
  listMeta: { fontSize: 12, color: Palette.textSecondary },
});
