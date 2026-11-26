import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, Switch, TextInput } from 'react-native-paper';
import { AppCard } from '../../components/ui/AppCard';
import { useAuth } from '../../context/AuthContext';
import {
  authApi,
  documentsApi,
  extractErrorMessage,
  productsApi,
  repairsApi,
  resolveApiBaseUrl,
} from '../../services/api';
import { generateMultiProductPdf, sharePdfFile } from '../../services/pdfService';
import { saveCustomApiUrl } from '../../services/storage';
import { Palette, Radii, Spacing } from '../../theme/tokens';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, updateUserLocal } = useAuth();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [exportingPortfolio, setExportingPortfolio] = useState(false);

  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState('');

  useEffect(() => {
    void resolveApiBaseUrl().then(setApiUrl);
  }, []);

  const handleSaveProfile = async () => {
    if (name.trim().length < 2) {
      Alert.alert('Invalid Name', 'Name must be at least 2 characters.');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await authApi.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
      });
      updateUserLocal(updated);
      setEditModalOpen(false);
    } catch (err) {
      Alert.alert('Update Failed', extractErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTogglePrivacy = async (
    field: 'privacyHideAmounts' | 'privacyBiometricLock',
    value: boolean
  ) => {
    try {
      const updated = await authApi.updateProfile({ [field]: value });
      updateUserLocal(updated);
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  const handleThemeChange = async (themePreference: 'light' | 'system') => {
    try {
      const updated = await authApi.updateProfile({ themePreference });
      updateUserLocal(updated);
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  const handleExportPortfolioPdf = async () => {
    setExportingPortfolio(true);
    try {
      const [products, repairs, documents] = await Promise.all([
        productsApi.list({ sort: 'purchaseDate_desc' }),
        repairsApi.listAll(),
        documentsApi.list(),
      ]);
      if (products.length === 0) {
        Alert.alert('No Products', 'Add at least one product before exporting a PDF report.');
        return;
      }
      const pdfUri = await generateMultiProductPdf({ products, repairs, documents });
      await sharePdfFile(pdfUri, 'WarrantyWise Portfolio Report');
    } catch (err) {
      Alert.alert('Export Failed', extractErrorMessage(err));
    } finally {
      setExportingPortfolio(false);
    }
  };

  const handleSaveApiUrl = async () => {
    await saveCustomApiUrl(apiUrl);
    setApiModalOpen(false);
    Alert.alert('API URL Saved', 'Future requests will use the updated server URL.');
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of WarrantyWise?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const initials = (user?.name || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Profile Card */}
      <AppCard>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            {user?.phone ? <Text style={styles.userPhone}>{user.phone}</Text> : null}
          </View>
          <Button
            mode="outlined"
            compact
            onPress={() => {
              setName(user?.name || '');
              setPhone(user?.phone || '');
              setEditModalOpen(true);
            }}
          >
            Edit
          </Button>
        </View>
      </AppCard>

      {/* Reports, Lifecycle Tools & Notifications */}
      <AppCard noPadding>
        <MenuRow
          icon="file-pdf-box"
          title="Export Multi-Product PDF Report"
          subtitle={exportingPortfolio ? 'Generating PDF...' : 'Share or save complete warranty portfolio'}
          onPress={handleExportPortfolioPdf}
        />
        <MenuRow
          icon="calendar-month-outline"
          title="Warranty &amp; Service Calendar"
          subtitle="Monthly and weekly view of expiries, maintenance &amp; AMC"
          onPress={() => router.push('/calendar')}
        />
        <MenuRow
          icon="file-certificate-outline"
          title="AMC Contracts Tracker"
          subtitle="Manage Annual Maintenance Contracts &amp; visits"
          onPress={() => router.push('/amc')}
        />
        <MenuRow
          icon="tools"
          title="Smart Maintenance Reminders"
          subtitle="Recurring service schedules &amp; history"
          onPress={() => router.push('/maintenance')}
        />
        <MenuRow
          icon="clipboard-check-outline"
          title="Warranty Claim Assistant"
          subtitle="Checklists, reference numbers &amp; claim status"
          onPress={() => router.push('/claims')}
        />
        <MenuRow
          icon="account-group-outline"
          title="Family Product Vault"
          subtitle="Organize &amp; share warranties across family members"
          onPress={() => router.push('/family')}
        />
        <MenuRow
          icon="cloud-sync-outline"
          title="Offline Cache &amp; Sync Queue"
          subtitle="Inspect offline changes and sync status"
          onPress={() => router.push('/offline')}
        />
        <MenuRow
          icon="bell-cog-outline"
          title="Notification Settings"
          subtitle="Configure 30d/7d/1d warranty, AMC &amp; maintenance alerts"
          onPress={() => router.push('/notifications')}
        />
      </AppCard>

      {/* Theme Settings */}
      <AppCard>
        <Text style={styles.sectionTitle}>Theme Settings</Text>
        <Text style={styles.sectionSub}>
          WarrantyWise uses a clean light executive theme with dark navy accents.
        </Text>
        <View style={styles.themeRow}>
          <Button
            mode={user?.themePreference !== 'system' ? 'contained' : 'outlined'}
            buttonColor={user?.themePreference !== 'system' ? Palette.primary : undefined}
            onPress={() => void handleThemeChange('light')}
            style={styles.themeBtn}
          >
            Light (Default)
          </Button>
          <Button
            mode={user?.themePreference === 'system' ? 'contained' : 'outlined'}
            buttonColor={user?.themePreference === 'system' ? Palette.primary : undefined}
            onPress={() => void handleThemeChange('system')}
            style={styles.themeBtn}
          >
            Follow System
          </Button>
        </View>
      </AppCard>

      {/* Privacy Settings */}
      <AppCard>
        <Text style={styles.sectionTitle}>Privacy Settings</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchBody}>
            <Text style={styles.switchTitle}>Mask Purchase &amp; Repair Amounts</Text>
            <Text style={styles.switchSub}>Hide monetary prices on dashboard and lists</Text>
          </View>
          <Switch
            value={Boolean(user?.privacyHideAmounts)}
            onValueChange={(v) => void handleTogglePrivacy('privacyHideAmounts', v)}
            color={Palette.primary}
          />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchBody}>
            <Text style={styles.switchTitle}>Require Re-auth for Sensitive Actions</Text>
            <Text style={styles.switchSub}>Keep stored tokens isolated in device SecureStore</Text>
          </View>
          <Switch
            value={Boolean(user?.privacyBiometricLock)}
            onValueChange={(v) => void handleTogglePrivacy('privacyBiometricLock', v)}
            color={Palette.primary}
          />
        </View>
      </AppCard>

      {/* Server & About */}
      <AppCard noPadding>
        <MenuRow
          icon="server-network"
          title="Backend API Server URL"
          subtitle={apiUrl}
          onPress={() => setApiModalOpen(true)}
        />
        <MenuRow
          icon="information-outline"
          title="About WarrantyWise"
          subtitle="Version 1.0.0 • Smart Warranty & Repair Management"
          onPress={() =>
            Alert.alert(
              'About WarrantyWise',
              'WarrantyWise v1.0.0\n\nHelps you securely store purchase invoices, track warranty expiry dates with leap-year precision, maintain product repair timelines, evaluate claim readiness, and export PDF reports.'
            )
          }
        />
      </AppCard>

      <Button
        mode="outlined"
        icon="logout"
        textColor={Palette.danger}
        onPress={handleLogout}
        style={styles.logoutBtn}
        contentStyle={{ height: 48 }}
      >
        Log Out
      </Button>

      {/* Edit Profile Modal */}
      <Modal visible={editModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TextInput
              mode="outlined"
              label="Full Name *"
              value={name}
              onChangeText={setName}
              style={styles.modalInput}
              outlineStyle={styles.outline}
            />
            <TextInput
              mode="outlined"
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={styles.modalInput}
              outlineStyle={styles.outline}
            />
            <View style={styles.modalBtns}>
              <Button mode="text" onPress={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                mode="contained"
                loading={savingProfile}
                disabled={savingProfile}
                buttonColor={Palette.primary}
                onPress={handleSaveProfile}
              >
                Save
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* API URL Modal */}
      <Modal visible={apiModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Backend API URL</Text>
            <Text style={styles.sectionSub}>
              Use http://10.0.2.2:5000/api for Android Emulator, or your computer&apos;s LAN IP for a
              physical phone.
            </Text>
            <TextInput
              mode="outlined"
              label="API Base URL"
              value={apiUrl}
              onChangeText={setApiUrl}
              autoCapitalize="none"
              style={[styles.modalInput, { marginTop: Spacing.md }]}
              outlineStyle={styles.outline}
            />
            <View style={styles.modalBtns}>
              <Button mode="text" onPress={() => setApiModalOpen(false)}>
                Cancel
              </Button>
              <Button mode="contained" buttonColor={Palette.primary} onPress={handleSaveApiUrl}>
                Save URL
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.menuRow}>
      <View style={styles.menuIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={Palette.primary} />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={Palette.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  profileInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '800', color: Palette.textPrimary },
  userEmail: { fontSize: 13, color: Palette.textSecondary },
  userPhone: { fontSize: 12, color: Palette.textMuted, marginTop: 2 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 14, fontWeight: '700', color: Palette.textPrimary },
  menuSub: { fontSize: 12, color: Palette.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary },
  sectionSub: { fontSize: 12, color: Palette.textSecondary, marginTop: 3 },
  themeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  themeBtn: { flex: 1, borderRadius: Radii.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    gap: Spacing.md,
  },
  switchBody: { flex: 1 },
  switchTitle: { fontSize: 14, fontWeight: '600', color: Palette.textPrimary },
  switchSub: { fontSize: 12, color: Palette.textMuted, marginTop: 2 },
  logoutBtn: { borderRadius: Radii.md, borderColor: Palette.danger, marginTop: Spacing.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: { backgroundColor: Palette.surface, borderRadius: Radii.lg, padding: Spacing.xl },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Palette.textPrimary, marginBottom: Spacing.sm },
  modalInput: { marginBottom: Spacing.md, backgroundColor: Palette.surface },
  outline: { borderRadius: Radii.md },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
});
