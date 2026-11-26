import { Stack } from 'expo-router';
import React from 'react';
import { Palette } from '../../theme/tokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Palette.background },
        headerTintColor: Palette.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Palette.background },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Create Account' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset Password' }} />
    </Stack>
  );
}
