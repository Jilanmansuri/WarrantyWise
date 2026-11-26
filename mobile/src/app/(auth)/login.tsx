import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from '../../components/ui/AppCard';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { useAuth } from '../../context/AuthContext';
import { Palette, Radii, Spacing } from '../../theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await signIn(trimmedEmail, password);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <MaterialCommunityIcons name="shield-check" size={38} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to manage your product warranties, invoices, and repairs.
            </Text>
          </View>

          <AppCard>
            {error ? <ErrorBanner message={error} /> : null}

            <TextInput
              mode="outlined"
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
              outlineStyle={styles.outline}
              left={<TextInput.Icon icon="email-outline" />}
            />

            <TextInput
              mode="outlined"
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              style={styles.input}
              outlineStyle={styles.outline}
              left={<TextInput.Icon icon="lock-outline" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onPress={() => setShowPassword((prev) => !prev)}
                />
              }
            />

            <View style={styles.forgotRow}>
              <Link href="/(auth)/forgot-password" asChild>
                <Button mode="text" compact textColor={Palette.primaryAccent}>
                  Forgot Password?
                </Button>
              </Link>
            </View>

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={submitting}
              disabled={submitting}
              buttonColor={Palette.primary}
              style={styles.submitBtn}
              contentStyle={styles.submitContent}
            >
              Sign In
            </Button>
          </AppCard>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to WarrantyWise?</Text>
            <Link href="/(auth)/register" asChild>
              <Button mode="text" compact textColor={Palette.primary}>
                Create Account
              </Button>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Palette.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: Palette.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  input: {
    marginBottom: Spacing.md,
    backgroundColor: Palette.surface,
  },
  outline: {
    borderRadius: Radii.md,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  submitBtn: {
    borderRadius: Radii.md,
  },
  submitContent: {
    height: 48,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    color: Palette.textSecondary,
    fontSize: 14,
  },
});
