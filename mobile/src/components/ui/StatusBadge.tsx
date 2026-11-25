import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { RepairStatus, WarrantyStatus } from '../../types';

interface StatusBadgeProps {
  status: WarrantyStatus | RepairStatus | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colors = getStatusColors(status);
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <View style={[styles.dot, { backgroundColor: colors.text }]} />
      <Text style={[styles.label, { color: colors.text }]}>{status}</Text>
    </View>
  );
}

function getStatusColors(status: string): { bg: string; text: string } {
  switch (status) {
    case 'Active':
    case 'Completed':
      return { bg: Palette.successBg, text: Palette.success };
    case 'Expiring Soon':
    case 'In Progress':
    case 'Pending':
      return { bg: Palette.warningBg, text: Palette.warning };
    case 'Expired':
    case 'Cancelled':
      return { bg: Palette.dangerBg, text: Palette.danger };
    default:
      return { bg: Palette.infoBg, text: Palette.info };
  }
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.pill,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
