import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button, Checkbox, Chip, TextInput } from 'react-native-paper';
import { AppCard } from '../../components/ui/AppCard';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormContainer } from '../../components/ui/FormContainer';
import { StatusBadge } from '../../components/ui/StatusBadge';
import {
  claimsApi,
  documentsApi,
  extractErrorMessage,
  productsApi,
} from '../../services/api';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import {
  CLAIM_STATUSES,
  ClaimStatus,
  Product,
  WarrantyClaimRecord,
} from '../../types';

export default function ClaimFormScreen() {
  const router = useRouter();
  const { id, productId: paramProductId } = useLocalSearchParams<{
    id?: string;
    productId?: string;
  }>();
  const isEditing = Boolean(id);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(paramProductId || '');
  const [warrantyStatus, setWarrantyStatus] = useState<string>('');
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<WarrantyClaimRecord['checklist']>([]);
  const [disclaimer, setDisclaimer] = useState(
    'WarrantyWise helps organize your claim documents and checklist, and does not guarantee manufacturer or retailer claim approval.'
  );

  const [manufacturerOrCenter, setManufacturerOrCenter] = useState('');
  const [claimReferenceNumber, setClaimReferenceNumber] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [issueSummary, setIssueSummary] = useState('');
  const [status, setStatus] = useState<ClaimStatus>('Not Started');
  const [notes, setNotes] = useState('');
  const [supportingDocIds, setSupportingDocIds] = useState<string[]>([]);
  const [uploadedDocNames, setUploadedDocNames] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreparation = async (pid: string) => {
    try {
      const prep = await claimsApi.prepare(pid);
      setWarrantyStatus(prep.warrantyMetrics.warrantyStatus);
      setRequiredDocs(prep.requiredDocuments);
      setChecklist(prep.checklist);
      setDisclaimer(prep.disclaimer);
    } catch {
      // Ignore if offline or unavailable
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await productsApi.list({ sort: 'recent' });
        if (!mounted) return;
        setProducts(list);

        if (id) {
          const all = await claimsApi.list();
          const found = all.data.find((c) => c._id === id);
          if (found && mounted) {
            const pid =
              typeof found.productId === 'string' ? found.productId : found.productId._id;
            setSelectedProductId(pid);
            setManufacturerOrCenter(found.manufacturerOrCenter);
            setClaimReferenceNumber(found.claimReferenceNumber || '');
            setContactPhone(found.contactPhone || '');
            setContactEmail(found.contactEmail || '');
            setIssueSummary(found.issueSummary);
            setStatus(found.status);
            setNotes(found.notes || '');
            setChecklist(found.checklist || []);
            setSupportingDocIds(found.supportingDocumentIds?.map((d) => d._id) || []);
            setUploadedDocNames(found.supportingDocumentIds?.map((d) => d.title) || []);
            setDisclaimer(all.disclaimer);
          }
        } else {
          const initialPid = paramProductId || list[0]?.id || '';
          setSelectedProductId(initialPid);
          if (initialPid) await loadPreparation(initialPid);
        }
      } catch (err) {
        if (mounted) setError(extractErrorMessage(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, paramProductId]);

  const handleSelectProduct = async (pid: string) => {
    setSelectedProductId(pid);
    await loadPreparation(pid);
  };

  const toggleChecklist = (key: string) => {
    setChecklist((prev) =>
      prev.map((c) => (c.key === key ? { ...c, completed: !c.completed } : c))
    );
  };

  const handleAttachSupportingDoc = async () => {
    if (!selectedProductId) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!picked.canceled && picked.assets[0]) {
      const a = picked.assets[0];
      try {
        const doc = await documentsApi.upload({
          file: {
            uri: a.uri,
            name: a.name || `claim-doc-${Date.now()}.pdf`,
            mimeType: a.mimeType || 'application/pdf',
          },
          title: a.name || 'Claim Supporting Document',
          type: 'Claim Document',
          productId: selectedProductId,
        });
        setSupportingDocIds((prev) => [...prev, doc._id]);
        setUploadedDocNames((prev) => [...prev, doc.title]);
      } catch (err) {
        setError(extractErrorMessage(err));
      }
    }
  };

  const handleSave = async () => {
    if (!selectedProductId) {
      setError('Please select a product.');
      return;
    }
    if (!manufacturerOrCenter.trim()) {
      setError('Manufacturer or service center is required.');
      return;
    }
    if (!issueSummary.trim()) {
      setError('Issue summary is required.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const payload = {
        manufacturerOrCenter: manufacturerOrCenter.trim(),
        claimReferenceNumber: claimReferenceNumber.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        issueSummary: issueSummary.trim(),
        status,
        checklist,
        supportingDocumentIds: supportingDocIds,
        notes: notes.trim() || undefined,
      };

      if (isEditing && id) {
        await claimsApi.update(id, payload);
      } else {
        await claimsApi.create({ ...payload, productId: selectedProductId });
      }
      router.back();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Palette.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: isEditing ? 'Manage Claim' : 'New Warranty Claim' }} />
      <FormContainer>
        <AppCard>
          {error ? <ErrorBanner message={error} /> : null}

          {!isEditing ? (
            <>
              <Text style={styles.label}>Select Product *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {products.map((p) => (
                  <Chip
                    key={p.id}
                    selected={selectedProductId === p.id}
                    onPress={() => void handleSelectProduct(p.id)}
                    style={styles.chip}
                  >
                    {p.brand} {p.productName}
                  </Chip>
                ))}
              </ScrollView>
            </>
          ) : null}

          {warrantyStatus ? (
            <View style={styles.statusRow}>
              <Text style={styles.labelInline}>Current Warranty Status:</Text>
              <StatusBadge status={warrantyStatus} />
            </View>
          ) : null}

          {requiredDocs.length > 0 ? (
            <View style={styles.reqBox}>
              <Text style={styles.reqTitle}>Typically Required Documents</Text>
              {requiredDocs.map((d) => (
                <Text key={d} style={styles.reqItem}>
                  • {d}
                </Text>
              ))}
            </View>
          ) : null}

          {checklist.length > 0 ? (
            <View style={styles.checkWrap}>
              <Text style={styles.sectionTitle}>Claim Preparation Checklist</Text>
              {checklist.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => toggleChecklist(item.key)}
                  style={styles.checkRow}
                >
                  <Checkbox
                    status={item.completed ? 'checked' : 'unchecked'}
                    onPress={() => toggleChecklist(item.key)}
                    color={Palette.primary}
                  />
                  <Text style={styles.checkLabel}>
                    {item.label}
                    {item.required ? ' *' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Claim &amp; Service Center Details</Text>
          <TextInput
            mode="outlined"
            label="Manufacturer / Authorized Center *"
            value={manufacturerOrCenter}
            onChangeText={setManufacturerOrCenter}
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <TextInput
            mode="outlined"
            label="Claim Reference Number"
            value={claimReferenceNumber}
            onChangeText={setClaimReferenceNumber}
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <View style={styles.twoCol}>
            <TextInput
              mode="outlined"
              label="Support Phone"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
            <TextInput
              mode="outlined"
              label="Support Email"
              value={contactEmail}
              onChangeText={setContactEmail}
              autoCapitalize="none"
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
          </View>
          <TextInput
            mode="outlined"
            label="Issue Description *"
            value={issueSummary}
            onChangeText={setIssueSummary}
            multiline
            numberOfLines={3}
            style={styles.input}
            outlineStyle={styles.outline}
          />

          <Text style={styles.label}>Claim Status</Text>
          <View style={styles.statusChips}>
            {CLAIM_STATUSES.map((st) => (
              <Chip
                key={st}
                selected={status === st}
                onPress={() => setStatus(st)}
                style={styles.chip}
              >
                {st}
              </Chip>
            ))}
          </View>

          <Button
            mode="outlined"
            icon="paperclip"
            onPress={handleAttachSupportingDoc}
            style={{ marginBottom: Spacing.sm, borderRadius: Radii.md }}
          >
            Attach Supporting Document
          </Button>
          {uploadedDocNames.length > 0 ? (
            <Text style={styles.attachedText}>
              Attached: {uploadedDocNames.join(', ')}
            </Text>
          ) : null}

          <TextInput
            mode="outlined"
            label="Claim Notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.input}
            outlineStyle={styles.outline}
          />

          <View style={styles.disclaimerBox}>
            <MaterialCommunityIcons name="information-outline" size={16} color={Palette.textSecondary} />
            <Text style={styles.disclaimerText}>{disclaimer}</Text>
          </View>

          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            buttonColor={Palette.primary}
            style={{ marginTop: Spacing.md, borderRadius: Radii.md }}
            contentStyle={{ height: 48 }}
          >
            {isEditing ? 'Update Claim' : 'Save Warranty Claim'}
          </Button>
        </AppCard>
      </FormContainer>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: Palette.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  label: { fontSize: 12, fontWeight: '600', color: Palette.textSecondary, marginBottom: 6 },
  labelInline: { fontSize: 13, fontWeight: '600', color: Palette.textSecondary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  chipRow: { gap: 8, paddingBottom: Spacing.md },
  statusChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
  chip: { backgroundColor: Palette.background },
  reqBox: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  reqTitle: { fontSize: 13, fontWeight: '700', color: Palette.primary, marginBottom: 4 },
  reqItem: { fontSize: 12, color: Palette.textPrimary, lineHeight: 18 },
  checkWrap: { marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.primary,
    marginBottom: Spacing.sm,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  checkLabel: { flex: 1, fontSize: 13, color: Palette.textPrimary },
  input: { marginBottom: Spacing.md, backgroundColor: Palette.surface },
  outline: { borderRadius: Radii.md },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
  half: { flex: 1 },
  attachedText: { fontSize: 12, color: Palette.success, fontWeight: '600', marginBottom: Spacing.md },
  disclaimerBox: {
    flexDirection: 'row',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: Palette.surfaceMuted,
    borderRadius: Radii.md,
  },
  disclaimerText: { flex: 1, fontSize: 11, color: Palette.textSecondary, lineHeight: 16 },
});
