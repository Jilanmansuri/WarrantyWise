import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { Palette, Radii, Spacing } from '../../theme/tokens';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="alert-circle-outline" size={20} color={Palette.danger} />
        <Text style={styles.text}>{message}</Text>
      </View>
      {onRetry ? (
        <Button mode="text" compact textColor={Palette.danger} onPress={onRetry}>
          Retry
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Palette.dangerBg,
    borderRadius: Radii.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  text: {
    color: Palette.danger,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});
