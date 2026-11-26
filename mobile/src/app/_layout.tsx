import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { OfflineProvider } from '../context/OfflineContext';
import { Palette, paperTheme } from '../theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [isLoading]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Palette.surface },
        headerTintColor: Palette.primary,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Palette.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="products/[id]" options={{ title: 'Product Lifecycle', headerBackTitle: 'Back' }} />
      <Stack.Screen name="products/form" options={{ title: 'Product Details', headerBackTitle: 'Cancel' }} />
      <Stack.Screen name="repairs/form" options={{ title: 'Repair Record', headerBackTitle: 'Cancel' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications & Reminders', headerBackTitle: 'Back' }} />
      <Stack.Screen name="calendar" options={{ title: 'Warranty & Service Calendar', headerBackTitle: 'Back' }} />
      <Stack.Screen name="amc/index" options={{ title: 'AMC Contracts', headerBackTitle: 'Back' }} />
      <Stack.Screen name="amc/form" options={{ title: 'AMC Contract', headerBackTitle: 'Cancel' }} />
      <Stack.Screen name="maintenance/index" options={{ title: 'Smart Maintenance', headerBackTitle: 'Back' }} />
      <Stack.Screen name="maintenance/form" options={{ title: 'Maintenance Schedule', headerBackTitle: 'Cancel' }} />
      <Stack.Screen name="claims/index" options={{ title: 'Warranty Claim Assistant', headerBackTitle: 'Back' }} />
      <Stack.Screen name="claims/form" options={{ title: 'Warranty Claim', headerBackTitle: 'Cancel' }} />
      <Stack.Screen name="family/index" options={{ title: 'Family Product Vault', headerBackTitle: 'Back' }} />
      <Stack.Screen name="qr/[token]" options={{ title: 'QR Product Identity', headerBackTitle: 'Back' }} />
      <Stack.Screen name="offline" options={{ title: 'Offline Sync & Queue', headerBackTitle: 'Back' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <AuthProvider>
          <OfflineProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </OfflineProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
