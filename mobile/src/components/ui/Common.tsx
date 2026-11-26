import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Button } from 'react-native-paper';
import { useOffline } from '../../context/OfflineContext';
import { CardShadow, Palette, Radii, Spacing } from '../../theme/tokens';
import { RepairStatus, WarrantyStatus } from '../../types';

export function AppCard({
  children,
  style,
  noPadding = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
}) {
  return <View style={[styles.card, !noPadding && styles.padded, style]}>{children}</View>;
}

function getStatusColors(status: string): { bg: string; text: string } {
  switch (status) {
    case 'Active':
    case 'Completed':
    case 'Approved':
    case 'Resolved':
      return { bg: Palette.successBg, text: Palette.success };
    case 'Expiring Soon':
    case 'In Progress':
    case 'Pending':
    case 'Submitted':
    case 'Under Review':
    case 'Documents Pending':
      return { bg: Palette.warningBg, text: Palette.warning };
    case 'Expired':
    case 'Cancelled':
    case 'Rejected':
    case 'Overdue':
      return { bg: Palette.dangerBg, text: Palette.danger };
    default:
      return { bg: Palette.infoBg, text: Palette.info };
  }
}

export function StatusBadge({ status }: { status: WarrantyStatus | RepairStatus | string }) {
  const colors = getStatusColors(status);
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <View style={[styles.dot, { backgroundColor: colors.text }]} />
      <Text style={[styles.badgeLabel, { color: colors.text }]}>{status}</Text>
    </View>
  );
}

export function StatCard({
  label,
  value,
  icon,
  accentColor = Palette.primary,
  accentBg = Palette.primaryLight,
  onPress,
}: {
  label: string;
  value: number | string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accentColor?: string;
  accentBg?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.statCard, pressed && onPress && styles.pressed]}
    >
      <View style={[styles.statIconWrap, { backgroundColor: accentBg }]}>
        <MaterialCommunityIcons name={icon} size={20} color={accentColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <MaterialCommunityIcons name={icon} size={34} color={Palette.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <Button
          mode="contained"
          onPress={onAction}
          style={styles.emptyBtn}
          buttonColor={Palette.primary}
        >
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorContainer}>
      <View style={styles.errorRow}>
        <MaterialCommunityIcons name="alert-circle-outline" size={20} color={Palette.danger} />
        <Text style={styles.errorText}>{message}</Text>
      </View>
      {onRetry ? (
        <Button mode="text" compact textColor={Palette.danger} onPress={onRetry}>
          Retry
        </Button>
      ) : null}
    </View>
  );
}

export function OfflineBanner() {
  const router = useRouter();
  const { isOnline, isSyncing, pendingCount, conflictCount } = useOffline();

  if (isOnline && !isSyncing && pendingCount === 0 && conflictCount === 0) {
    return null;
  }

  const bg = conflictCount > 0 ? Palette.dangerBg : !isOnline ? Palette.warningBg : Palette.infoBg;
  const fg = conflictCount > 0 ? Palette.danger : !isOnline ? Palette.warning : Palette.info;
  const icon =
    conflictCount > 0
      ? 'alert-outline'
      : !isOnline
        ? 'cloud-off-outline'
        : isSyncing
          ? 'cloud-sync-outline'
          : 'cloud-upload-outline';

  const message =
    conflictCount > 0
      ? `${conflictCount} sync conflict(s) need review`
      : !isOnline
        ? `Offline Mode • Viewing cached data${pendingCount > 0 ? ` (${pendingCount} queued)` : ''}`
        : isSyncing
          ? 'Synchronizing offline changes...'
          : `${pendingCount} change(s) ready to sync`;

  return (
    <Pressable onPress={() => router.push('/offline')} style={[styles.offlineBanner, { backgroundColor: bg }]}>
      <View style={styles.offlineLeft}>
        <MaterialCommunityIcons name={icon} size={18} color={fg} />
        <Text style={[styles.offlineText, { color: fg }]}>{message}</Text>
      </View>
      <Text style={[styles.offlineLink, { color: fg }]}>Details</Text>
    </Pressable>
  );
}

export function FormContainer({
  children,
  contentContainerStyle,
}: {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.formFlex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={styles.formContainer}
        contentContainerStyle={[styles.formContent, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...CardShadow,
  },
  padded: { padding: Spacing.lg },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.pill,
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeLabel: { fontSize: 12, fontWeight: '600' },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Palette.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
    ...CardShadow,
  },
  pressed: { opacity: 0.85 },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: { fontSize: 24, fontWeight: '700', color: Palette.textPrimary, marginBottom: 2 },
  statLabel: { fontSize: 13, fontWeight: '500', color: Palette.textSecondary },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Palette.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Palette.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Palette.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  emptyBtn: { borderRadius: Radii.md },
  errorContainer: {
    backgroundColor: Palette.dangerBg,
    borderRadius: Radii.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  errorText: { color: Palette.danger, fontSize: 13, fontWeight: '500', flex: 1 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    marginBottom: Spacing.md,
  },
  offlineLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  offlineText: { fontSize: 12, fontWeight: '700', flex: 1 },
  offlineLink: { fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
  formFlex: { flex: 1, backgroundColor: Palette.background },
  formContainer: { flex: 1, backgroundColor: Palette.background },
  formContent: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
});
