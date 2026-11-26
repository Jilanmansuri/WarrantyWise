import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, ErrorBanner } from '../../components/ui/Common';
import { useAuth } from '../../context/AuthContext';
import { Palette, Radii, Spacing } from '../../theme/tokens';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (name.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await signUp(name.trim(), trimmedEmail, password, phone.trim() || undefined);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Set up your WarrantyWise vault</Text>
          <Text style={styles.sub}>
            Your products, invoices, and repair records stay private to your account.
          </Text>

          <AppCard>
            {error ? <ErrorBanner message={error} /> : null}

            <TextInput
              mode="outlined"
              label="Full Name *"
              value={name}
              onChangeText={setName}
              style={styles.input}
              outlineStyle={styles.outline}
              left={<TextInput.Icon icon="account-outline" />}
            />

            <TextInput
              mode="outlined"
              label="Email Address *"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              outlineStyle={styles.outline}
              left={<TextInput.Icon icon="email-outline" />}
            />

            <TextInput
              mode="outlined"
              label="Phone Number (Optional)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={styles.input}
              outlineStyle={styles.outline}
              left={<TextInput.Icon icon="phone-outline" />}
            />

            <TextInput
              mode="outlined"
              label="Password *"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
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

            <TextInput
              mode="outlined"
              label="Confirm Password *"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              style={styles.input}
              outlineStyle={styles.outline}
              left={<TextInput.Icon icon="lock-check-outline" />}
            />

            <Button
              mode="contained"
              onPress={handleRegister}
              loading={submitting}
              disabled={submitting}
              buttonColor={Palette.primary}
              style={styles.submitBtn}
              contentStyle={styles.submitContent}
            >
              Create Account
            </Button>
          </AppCard>
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
    padding: Spacing.xl,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: Palette.textPrimary,
  },
  sub: {
    fontSize: 14,
    color: Palette.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  input: {
    marginBottom: Spacing.md,
    backgroundColor: Palette.surface,
  },
  outline: {
    borderRadius: Radii.md,
  },
  submitBtn: {
    borderRadius: Radii.md,
    marginTop: Spacing.sm,
  },
  submitContent: {
    height: 48,
  },
});
