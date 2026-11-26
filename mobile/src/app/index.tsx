import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { Palette, Spacing } from '../theme/tokens';

export default function SplashGateScreen() {
  const { user, isLoading, hasCompletedOnboarding } = useAuth();
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.92));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  if (!isLoading) {
    if (!hasCompletedOnboarding) {
      return <Redirect href="/onboarding" />;
    }
    if (!user) {
      return <Redirect href="/(auth)/login" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.brandBlock,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.logoBox}>
          <MaterialCommunityIcons name="shield-check" size={52} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>WarrantyWise</Text>
        <Text style={styles.subtitle}>Smart Product Warranty &amp; Repair Manager</Text>
        <ActivityIndicator color={Palette.primary} style={styles.loader} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  brandBlock: {
    alignItems: 'center',
  },
  logoBox: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Palette.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Palette.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  loader: {
    marginTop: Spacing.xxl,
  },
});
