import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { CardShadow, Palette, Radii, Spacing } from '../../theme/tokens';

interface AppCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
}

export function AppCard({ children, style, noPadding = false }: AppCardProps) {
  return (
    <View style={[styles.card, !noPadding && styles.padded, style]}>{children}</View>
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
  padded: {
    padding: Spacing.lg,
  },
});
