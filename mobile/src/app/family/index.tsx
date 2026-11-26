import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Chip, Switch, TextInput } from 'react-native-paper';
import { AppCard, EmptyState, ErrorBanner, StatCard, StatusBadge } from '../../components/ui/Common';
import { extractErrorMessage, familyApi, productsApi } from '../../services/api';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import {
  FAMILY_RELATIONSHIPS,
  FamilyDashboardData,
  FamilyRelationship,
  Product,
} from '../../types';
import { formatReadableDate } from '../../utils/dateUtils';

export default function FamilyVaultScreen() {
  const router = useRouter();
  const [data, setData] = useState<FamilyDashboardData | null>(null);
  const [ownProducts, setOwnProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add Member Modal
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [relationship, setRelationship] = useState<FamilyRelationship>('Spouse');
  const [memberEmail, setMemberEmail] = useState('');
  const [canViewWarranties, setCanViewWarranties] = useState(true);
  const [canViewDocuments, setCanViewDocuments] = useState(false);
  const [canReceiveReminders, setCanReceiveReminders] = useState(true);
  const [savingMember, setSavingMember] = useState(false);

  // Assign Product Modal
  const [assignModalMemberId, setAssignModalMemberId] = useState<string | null>(null);
  const [selectedAssignProductId, setSelectedAssignProductId] = useState('');
  const [shareOnAssign, setShareOnAssign] = useState(true);

  const loadFamily = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      setError(null);
      const [fam, prods] = await Promise.all([
        familyApi.getDashboard(),
        productsApi.list({ sort: 'recent' }),
      ]);
      setData(fam);
      setOwnProducts(prods);
      if (prods.length > 0) setSelectedAssignProductId(prods[0].id);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFamily(false);
    }, [loadFamily])
  );

  const handleAddMember = async () => {
    if (memberName.trim().length < 2) {
      Alert.alert('Invalid Name', 'Member name must be at least 2 characters.');
      return;
    }
    setSavingMember(true);
    try {
      await familyApi.addMember({
        name: memberName.trim(),
        relationship,
        email: memberEmail.trim() || undefined,
        permissions: {
          canViewWarranties,
          canViewDocuments,
          canReceiveReminders,
        },
      });
      setMemberModalOpen(false);
      setMemberName('');
      setMemberEmail('');
      await loadFamily(false);
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err));
    } finally {
      setSavingMember(false);
    }
  };

  const handleAssignProduct = async () => {
    if (!assignModalMemberId || !selectedAssignProductId) return;
    try {
      await familyApi.assignProduct({
        productId: selectedAssignProductId,
        familyMemberId: assignModalMemberId,
        sharedWithFamily: shareOnAssign,
      });
      setAssignModalMemberId(null);
      await loadFamily(false);
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err));
    }
  };

  const handleRemoveMember = (id: string, name: string) => {
    Alert.alert('Remove Member', `Remove ${name} from your Family Vault?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await familyApi.removeMember(id);
            await loadFamily(false);
          } catch (err) {
            Alert.alert('Error', extractErrorMessage(err));
          }
        },
      },
    ]);
  };

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Palette.primary} />
      </View>
    );
  }

  const summary = data?.summary;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadFamily(true)}
          tintColor={Palette.primary}
        />
      }
    >
      {error ? <ErrorBanner message={error} onRetry={() => void loadFamily(false)} /> : null}

      {summary ? (
        <View style={styles.statsGrid}>
          <StatCard label="Family Members" value={summary.memberCount} icon="account-group-outline" />
          <StatCard
            label="Assigned Products"
            value={summary.assignedProductsCount}
            icon="devices"
            accentColor={Palette.primaryAccent}
            accentBg={Palette.infoBg}
          />
          <StatCard
            label="Active Warranties"
            value={summary.activeFamilyWarranties}
            icon="shield-check-outline"
            accentColor={Palette.success}
            accentBg={Palette.successBg}
          />
          <StatCard
            label="Shared With Me"
            value={summary.sharedWithMeCount}
            icon="share-variant-outline"
            accentColor={Palette.warning}
            accentBg={Palette.warningBg}
          />
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Family Members &amp; Inventory</Text>
        <Button
          mode="contained"
          compact
          icon="account-plus-outline"
          buttonColor={Palette.primary}
          onPress={() => setMemberModalOpen(true)}
        >
          Add Member
        </Button>
      </View>

      {!data || data.members.length === 0 ? (
        <EmptyState
          icon="account-group-outline"
          title="No family members added"
          subtitle="Add household members, assign their devices, and control whether they can view shared warranties or documents."
          actionLabel="Add Family Member"
          onAction={() => setMemberModalOpen(true)}
        />
      ) : (
        data.members.map((member) => (
          <AppCard key={member._id} style={styles.memberCard}>
            <View style={styles.memberTop}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {member.name} • {member.relationship}
                </Text>
                {member.email ? <Text style={styles.memberEmail}>{member.email}</Text> : null}
                <Text style={styles.permText}>
                  Permissions: {member.permissions.canViewWarranties ? 'Warranties ' : ''}
                  {member.permissions.canViewDocuments ? '• Docs ' : '• No Docs '}
                  {member.permissions.canReceiveReminders ? '• Reminders' : ''}
                </Text>
              </View>
              <Pressable onPress={() => handleRemoveMember(member._id, member.name)}>
                <MaterialCommunityIcons name="delete-outline" size={20} color={Palette.danger} />
              </Pressable>
            </View>

            <View style={styles.memberStatsRow}>
              <Text style={styles.memberStat}>
                {member.productCount || 0} product(s) • {member.activeWarranties || 0} active
              </Text>
              {ownProducts.length > 0 ? (
                <Button
                  mode="text"
                  compact
                  onPress={() => setAssignModalMemberId(member._id)}
                >
                  + Assign Product
                </Button>
              ) : null}
            </View>

            {(member.products || []).map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/products/${p.id}`)}
                style={styles.prodRow}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.prodName}>
                    {p.brand} {p.productName}
                  </Text>
                  <Text style={styles.prodMeta}>
                    Expires {formatReadableDate(p.extendedWarrantyEndDate || p.warrantyEndDate)}
                    {p.sharedWithFamily ? ' • Shared' : ' • Owner only'}
                  </Text>
                </View>
                <StatusBadge status={p.warrantyMetrics.warrantyStatus} />
              </Pressable>
            ))}
          </AppCard>
        ))
      )}

      {/* Shared With Me */}
      {data && data.sharedWithMe.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Shared With Me</Text>
          {data.sharedWithMe.map((item) => (
            <Pressable key={item.id} onPress={() => router.push(`/products/${item.id}`)}>
              <AppCard style={styles.memberCard}>
                <View style={styles.memberTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>
                      {item.brand} {item.productName}
                    </Text>
                    <Text style={styles.memberEmail}>
                      Shared by {item.ownerName} •{' '}
                      {item.canViewDocuments ? 'Docs enabled' : 'Warranties only'}
                    </Text>
                  </View>
                  <StatusBadge status={item.warrantyMetrics.warrantyStatus} />
                </View>
              </AppCard>
            </Pressable>
          ))}
        </>
      ) : null}

      {/* Add Member Modal */}
      <Modal visible={memberModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Family Member</Text>
            <TextInput
              mode="outlined"
              label="Member Name *"
              value={memberName}
              onChangeText={setMemberName}
              style={styles.input}
              outlineStyle={styles.outline}
            />
            <TextInput
              mode="outlined"
              label="Member Email (for sharing access)"
              value={memberEmail}
              onChangeText={setMemberEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              outlineStyle={styles.outline}
            />
            <Text style={styles.label}>Relationship</Text>
            <View style={styles.chipWrap}>
              {FAMILY_RELATIONSHIPS.map((rel) => (
                <Chip
                  key={rel}
                  selected={relationship === rel}
                  onPress={() => setRelationship(rel)}
                  style={styles.chip}
                >
                  {rel}
                </Chip>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Allow Viewing Shared Warranties</Text>
              <Switch
                value={canViewWarranties}
                onValueChange={setCanViewWarranties}
                color={Palette.primary}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Allow Viewing Attached Invoices/Docs</Text>
              <Switch
                value={canViewDocuments}
                onValueChange={setCanViewDocuments}
                color={Palette.primary}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Share Expiry &amp; Service Reminders</Text>
              <Switch
                value={canReceiveReminders}
                onValueChange={setCanReceiveReminders}
                color={Palette.primary}
              />
            </View>

            <View style={styles.modalBtns}>
              <Button mode="text" onPress={() => setMemberModalOpen(false)}>
                Cancel
              </Button>
              <Button
                mode="contained"
                loading={savingMember}
                disabled={savingMember}
                buttonColor={Palette.primary}
                onPress={handleAddMember}
              >
                Add Member
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Product Modal */}
      <Modal visible={Boolean(assignModalMemberId)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign Product to Member</Text>
            <ScrollView style={{ maxHeight: 200, marginBottom: Spacing.md }}>
              {ownProducts.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedAssignProductId(p.id)}
                  style={[
                    styles.assignRow,
                    selectedAssignProductId === p.id && styles.assignRowSelected,
                  ]}
                >
                  <Text style={styles.prodName}>
                    {p.brand} {p.productName}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Share with member&apos;s account</Text>
              <Switch
                value={shareOnAssign}
                onValueChange={setShareOnAssign}
                color={Palette.primary}
              />
            </View>

            <View style={styles.modalBtns}>
              <Button mode="text" onPress={() => setAssignModalMemberId(null)}>
                Cancel
              </Button>
              <Button mode="contained" buttonColor={Palette.primary} onPress={handleAssignProduct}>
                Assign
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: Palette.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary },
  memberCard: { marginBottom: Spacing.sm },
  memberTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary },
  memberEmail: { fontSize: 12, color: Palette.textSecondary, marginTop: 2 },
  permText: { fontSize: 11, color: Palette.primaryAccent, fontWeight: '600', marginTop: 4 },
  memberStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  memberStat: { fontSize: 12, color: Palette.textMuted, fontWeight: '600' },
  prodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    gap: Spacing.sm,
  },
  prodName: { fontSize: 14, fontWeight: '600', color: Palette.textPrimary },
  prodMeta: { fontSize: 12, color: Palette.textMuted },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: { backgroundColor: Palette.surface, borderRadius: Radii.lg, padding: Spacing.xl },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Palette.textPrimary, marginBottom: Spacing.md },
  input: { marginBottom: Spacing.md, backgroundColor: Palette.surface },
  outline: { borderRadius: Radii.md },
  label: { fontSize: 12, fontWeight: '600', color: Palette.textSecondary, marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
  chip: { backgroundColor: Palette.background },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  switchLabel: { fontSize: 13, color: Palette.textPrimary, flex: 1 },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },
  assignRow: {
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: Spacing.xs,
  },
  assignRowSelected: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
});
