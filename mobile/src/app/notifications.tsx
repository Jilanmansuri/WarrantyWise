import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActivityIndicator, Switch } from 'react-native-paper';
import { AppCard, EmptyState, ErrorBanner, StatusBadge } from '../components/ui/Common';
import { useAuth } from '../context/AuthContext';
import {
  authApi,
  dashboardApi,
  extractErrorMessage,
  productsApi,
} from '../services/api';
import {
  getScheduledNotificationCount,
  syncWarrantyNotifications,
} from '../services/notifications';
import { Palette, Spacing } from '../theme/tokens';
import { NotificationPreference, Product } from '../types';
import { formatReadableDate } from '../utils/dateUtils';

export default function NotificationsScreen() {
  const router = useRouter();
  const { notificationPreferences, updateNotificationPrefsLocal } = useAuth();

  const [prefs, setPrefs] = useState<NotificationPreference>(
    notificationPreferences || {
      enabled: true,
      remind30Days: true,
      remind7Days: true,
      remind1Day: true,
      notifyNewProduct: true,
      amcRenewalAlerts: true,
      maintenanceReminders: true,
      familySharedReminders: true,
    }
  );
  const [upcoming, setUpcoming] = useState<Product[]>([]);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingPref, setSavingPref] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const [serverPrefs, expiringList, count] = await Promise.all([
        authApi.getNotificationPreferences(),
        dashboardApi.getUpcomingExpiries(45),
        getScheduledNotificationCount(),
      ]);
      setPrefs(serverPrefs);
      updateNotificationPrefsLocal(serverPrefs);
      setUpcoming(expiringList);
      setScheduledCount(count);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [updateNotificationPrefsLocal]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const togglePreference = async (key: keyof NotificationPreference, value: boolean) => {
    const nextPrefs = { ...prefs, [key]: value };
    setPrefs(nextPrefs);
    setSavingPref(true);
    try {
      const updated = await authApi.updateNotificationPreferences({ [key]: value });
      updateNotificationPrefsLocal(updated);
      const allProducts = await productsApi.list();
      const count = await syncWarrantyNotifications(allProducts, updated);
      setScheduledCount(count);
    } catch (err) {
      setPrefs(prefs);
      setError(extractErrorMessage(err));
    } finally {
      setSavingPref(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}

      <AppCard>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Reminder Settings</Text>
          {savingPref ? <ActivityIndicator size="small" color={Palette.primary} /> : null}
        </View>
        <Text style={styles.subText}>
          {scheduledCount} local reminder(s) currently scheduled on this device based on actual
          warranty expiry dates.
        </Text>

        <SettingRow
          label="Enable Warranty Notifications"
          description="Master toggle for all local warranty alerts"
          value={prefs.enabled}
          onChange={(v) => void togglePreference('enabled', v)}
        />
        <SettingRow
          label="30 Days Before Expiry"
          description="Early reminder to plan warranty service"
          value={prefs.remind30Days}
          disabled={!prefs.enabled}
          onChange={(v) => void togglePreference('remind30Days', v)}
        />
        <SettingRow
          label="7 Days Before Expiry"
          description="One-week urgent warranty reminder"
          value={prefs.remind7Days}
          disabled={!prefs.enabled}
          onChange={(v) => void togglePreference('remind7Days', v)}
        />
        <SettingRow
          label="1 Day Before Expiry"
          description="Final reminder before coverage ends"
          value={prefs.remind1Day}
          disabled={!prefs.enabled}
          onChange={(v) => void togglePreference('remind1Day', v)}
        />
        <SettingRow
          label="New Product Confirmation"
          description="Notify when a new product warranty is added"
          value={prefs.notifyNewProduct}
          disabled={!prefs.enabled}
          onChange={(v) => void togglePreference('notifyNewProduct', v)}
        />
        <SettingRow
          label="AMC Renewal Alerts"
          description="Remind 14 days before Annual Maintenance Contracts expire"
          value={prefs.amcRenewalAlerts}
          disabled={!prefs.enabled}
          onChange={(v) => void togglePreference('amcRenewalAlerts', v)}
        />
        <SettingRow
          label="Smart Maintenance Reminders"
          description="Notify 1 day before scheduled appliance servicing"
          value={prefs.maintenanceReminders}
          disabled={!prefs.enabled}
          onChange={(v) => void togglePreference('maintenanceReminders', v)}
        />
        <SettingRow
          label="Family Vault Shared Alerts"
          description="Include shared family product reminders"
          value={prefs.familySharedReminders}
          disabled={!prefs.enabled}
          onChange={(v) => void togglePreference('familySharedReminders', v)}
        />
      </AppCard>

      <Text style={styles.sectionTitle}>Expiring Within 45 Days</Text>
      {loading && upcoming.length === 0 ? (
        <ActivityIndicator color={Palette.primary} style={{ marginTop: 24 }} />
      ) : upcoming.length === 0 ? (
        <EmptyState
          icon="bell-check-outline"
          title="No warranties expiring soon"
          subtitle="You're all caught up. Any products nearing expiration will appear here."
        />
      ) : (
        <AppCard noPadding>
          {upcoming.map((item, idx) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/products/${item.id}`)}
              style={[
                styles.row,
                idx < upcoming.length - 1 && styles.rowBorder,
              ]}
            >
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>
                  {item.brand} {item.productName}
                </Text>
                <Text style={styles.rowMeta}>
                  Expires {formatReadableDate(item.warrantyEndDate)} •{' '}
                  {item.warrantyMetrics.remainingDays} day(s) remaining
                </Text>
              </View>
              <StatusBadge status={item.warrantyMetrics.warrantyStatus} />
            </Pressable>
          ))}
        </AppCard>
      )}
    </ScrollView>
  );
}

function SettingRow({
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={[styles.settingLabel, disabled && styles.disabledText]}>{label}</Text>
        <Text style={styles.settingDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        color={Palette.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary },
  subText: { fontSize: 12, color: Palette.textSecondary, marginTop: 4, marginBottom: Spacing.md },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    gap: Spacing.md,
  },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: Palette.textPrimary },
  settingDesc: { fontSize: 12, color: Palette.textMuted, marginTop: 2 },
  disabledText: { color: Palette.textMuted },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary, marginTop: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Palette.border },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: Palette.textPrimary },
  rowMeta: { fontSize: 12, color: Palette.textSecondary, marginTop: 2 },
});
