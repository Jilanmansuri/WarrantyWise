import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from '../../components/ui/AppCard';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { authApi, extractErrorMessage } from '../../services/api';
import { Palette, Radii, Spacing } from '../../theme/tokens';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(trimmed);
      const devHint = res.devResetCode ? ` (Dev code: ${res.devResetCode})` : '';
      setInfoMessage(`${res.message}${devHint}`);
      if (res.devResetCode) {
        setCode(res.devResetCode);
      }
      setStep('reset');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (code.trim().length !== 6) {
      setError('Please enter the 6-digit reset code.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
      });
      Alert.alert('Password Updated', res.message, [
        { text: 'Back to Sign In', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Recover your account</Text>
        <Text style={styles.sub}>
          {step === 'request'
            ? 'Enter your account email to generate a 6-digit password reset code.'
            : 'Enter the 6-digit code and choose a new password.'}
        </Text>

        <AppCard>
          {error ? <ErrorBanner message={error} /> : null}
          {infoMessage ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{infoMessage}</Text>
            </View>
          ) : null}

          <TextInput
            mode="outlined"
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            editable={step === 'request'}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            outlineStyle={styles.outline}
          />

          {step === 'reset' ? (
            <>
              <TextInput
                mode="outlined"
                label="6-Digit Reset Code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
                outlineStyle={styles.outline}
              />
              <TextInput
                mode="outlined"
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                style={styles.input}
                outlineStyle={styles.outline}
              />
            </>
          ) : null}

          <Button
            mode="contained"
            onPress={step === 'request' ? handleRequestCode : handleResetPassword}
            loading={loading}
            disabled={loading}
            buttonColor={Palette.primary}
            style={styles.btn}
            contentStyle={styles.btnContent}
          >
            {step === 'request' ? 'Generate Reset Code' : 'Update Password'}
          </Button>
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
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
  infoBox: {
    backgroundColor: Palette.infoBg,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoText: {
    color: Palette.info,
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    marginBottom: Spacing.md,
    backgroundColor: Palette.surface,
  },
  outline: {
    borderRadius: Radii.md,
  },
  btn: {
    borderRadius: Radii.md,
  },
  btnContent: {
    height: 48,
  },
});
