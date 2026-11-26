import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useOffline } from '../../context/OfflineContext';
import { Palette, Radii, Spacing } from '../../theme/tokens';

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
    <Pressable onPress={() => router.push('/offline')} style={[styles.banner, { backgroundColor: bg }]}>
      <View style={styles.left}>
        <MaterialCommunityIcons name={icon} size={18} color={fg} />
        <Text style={[styles.text, { color: fg }]}>{message}</Text>
      </View>
      <Text style={[styles.link, { color: fg }]}>Details</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    marginBottom: Spacing.md,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  text: { fontSize: 12, fontWeight: '700', flex: 1 },
  link: { fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
});
