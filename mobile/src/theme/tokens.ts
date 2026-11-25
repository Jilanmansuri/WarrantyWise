import { Platform } from 'react-native';
import { MD3LightTheme, configureFonts } from 'react-native-paper';

export const Palette = {
  primary: '#0F295C', // Deep authoritative navy blue
  primaryAccent: '#1E40AF',
  primaryLight: '#E8EEF9',
  primaryMuted: '#3B5998',
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  success: '#15803D',
  successBg: '#DCFCE7',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  danger: '#B91C1C',
  dangerBg: '#FEE2E2',
  info: '#1D4ED8',
  infoBg: '#DBEAFE',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const CardShadow = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: {
    elevation: 2,
  },
  default: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
});

export const paperTheme = {
  ...MD3LightTheme,
  roundness: 12,
  fonts: configureFonts({ config: {} }),
  colors: {
    ...MD3LightTheme.colors,
    primary: Palette.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: Palette.primaryLight,
    onPrimaryContainer: Palette.primary,
    secondary: Palette.primaryAccent,
    onSecondary: '#FFFFFF',
    background: Palette.background,
    surface: Palette.surface,
    surfaceVariant: Palette.surfaceMuted,
    onSurface: Palette.textPrimary,
    onSurfaceVariant: Palette.textSecondary,
    outline: Palette.border,
    error: Palette.danger,
  },
};
