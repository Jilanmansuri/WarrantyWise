import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CardShadow, Palette, Radii, Spacing } from '../../theme/tokens';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accentColor?: string;
  accentBg?: string;
  onPress?: () => void;
}

export function StatCard({
  label,
  value,
  icon,
  accentColor = Palette.primary,
  accentBg = Palette.primaryLight,
  onPress,
}: StatCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && onPress && styles.pressed,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: accentBg }]}>
        <MaterialCommunityIcons name={icon} size={20} color={accentColor} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Palette.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
    ...CardShadow,
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: Palette.textPrimary,
    marginBottom: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Palette.textSecondary,
  },
});
