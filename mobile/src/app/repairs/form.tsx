import * as DocumentPicker from 'expo-document-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button, Chip, TextInput } from 'react-native-paper';
import { AppCard } from '../../components/ui/AppCard';
import { DatePickerField } from '../../components/ui/DatePickerField';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormContainer } from '../../components/ui/FormContainer';
import {
  FileUploadAsset,
  documentsApi,
  extractErrorMessage,
  productsApi,
  repairsApi,
} from '../../services/api';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { Product, REPAIR_STATUSES, RepairStatus } from '../../types';
import { toIsoDateOnly } from '../../utils/dateUtils';

export default function RepairFormScreen() {
  const router = useRouter();
  const { productId: paramProductId, repairId } = useLocalSearchParams<{
    productId?: string;
    repairId?: string;
  }>();

  const isEditing = Boolean(repairId);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(paramProductId || '');
  const [repairDate, setRepairDate] = useState(toIsoDateOnly(new Date()));
  const [problemDescription, setProblemDescription] = useState('');
  const [repairCenter, setRepairCenter] = useState('');
  const [repairCost, setRepairCost] = useState('0');
  const [repairStatus, setRepairStatus] = useState<RepairStatus>('Pending');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [invoiceAsset, setInvoiceAsset] = useState<FileUploadAsset | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await productsApi.list({ sort: 'recent' });
        if (!mounted) return;
        setProducts(list);
        if (!paramProductId && list.length > 0) {
          setSelectedProductId(list[0].id);
        }

        if (repairId && paramProductId) {
          const repairs = await repairsApi.listByProduct(paramProductId);
          const found = repairs.find((r) => r._id === repairId);
          if (found && mounted) {
            setRepairDate(toIsoDateOnly(found.repairDate));
            setProblemDescription(found.problemDescription);
            setRepairCenter(found.repairCenter);
            setRepairCost(String(found.repairCost ?? 0));
            setRepairStatus(found.repairStatus);
            setAdditionalNotes(found.additionalNotes || '');
          }
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
  }, [paramProductId, repairId]);

  const handlePickRepairInvoice = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setInvoiceAsset({
        uri: a.uri,
        name: a.name || `repair-invoice-${Date.now()}.pdf`,
        mimeType: a.mimeType || 'application/pdf',
      });
    }
  };

  const handleSave = async () => {
    if (!selectedProductId) {
      setError('Please select a product first.');
      return;
    }
    if (!problemDescription.trim()) {
      setError('Problem description is required.');
      return;
    }
    if (!repairCenter.trim()) {
      setError('Repair center name is required.');
      return;
    }
    const costNum = Number(repairCost || 0);
    if (!Number.isFinite(costNum) || costNum < 0) {
      setError('Repair cost must be a valid non-negative number.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      let repairInvoiceDocumentId: string | undefined;
      if (invoiceAsset) {
        const doc = await documentsApi.upload({
          file: invoiceAsset,
          title: `Repair Invoice (${repairDate})`,
          type: 'Repair Invoice',
          productId: selectedProductId,
        });
        repairInvoiceDocumentId = doc._id;
      }

      if (isEditing && repairId) {
        await repairsApi.update(repairId, {
          repairDate,
          problemDescription: problemDescription.trim(),
          repairCenter: repairCenter.trim(),
          repairCost: costNum,
          repairStatus,
          repairInvoiceDocumentId,
          additionalNotes: additionalNotes.trim() || undefined,
        });
      } else {
        await repairsApi.create({
          productId: selectedProductId,
          repairDate,
          problemDescription: problemDescription.trim(),
          repairCenter: repairCenter.trim(),
          repairCost: costNum,
          repairStatus,
          repairInvoiceDocumentId,
          additionalNotes: additionalNotes.trim() || undefined,
        });
      }

      router.replace(`/products/${selectedProductId}`);
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
      <Stack.Screen options={{ title: isEditing ? 'Edit Repair Record' : 'Add Repair Record' }} />
      <FormContainer>
        <AppCard>
          {error ? <ErrorBanner message={error} /> : null}

          {products.length === 0 ? (
            <View style={styles.noProducts}>
              <Text style={styles.noProdText}>
                You need at least one product before logging a repair record.
              </Text>
              <Button
                mode="contained"
                buttonColor={Palette.primary}
                onPress={() => router.replace('/products/form')}
              >
                Add a Product First
              </Button>
            </View>
          ) : (
            <>
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
                        onPress={() => setSelectedProductId(p.id)}
                        style={styles.chip}
                      >
                        {p.brand} {p.productName}
                      </Chip>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              <DatePickerField label="Repair Date *" value={repairDate} onChange={setRepairDate} />

              <TextInput
                mode="outlined"
                label="Problem Description *"
                value={problemDescription}
                onChangeText={setProblemDescription}
                multiline
                numberOfLines={3}
                style={styles.input}
                outlineStyle={styles.outline}
              />

              <TextInput
                mode="outlined"
                label="Repair Center / Service Provider *"
                value={repairCenter}
                onChangeText={setRepairCenter}
                style={styles.input}
                outlineStyle={styles.outline}
              />

              <TextInput
                mode="outlined"
                label="Repair Cost"
                value={repairCost}
                onChangeText={setRepairCost}
                keyboardType="decimal-pad"
                style={styles.input}
                outlineStyle={styles.outline}
              />

              <Text style={styles.label}>Repair Status *</Text>
              <View style={styles.statusRow}>
                {REPAIR_STATUSES.map((st) => (
                  <Chip
                    key={st}
                    selected={repairStatus === st}
                    onPress={() => setRepairStatus(st)}
                    style={styles.chip}
                  >
                    {st}
                  </Chip>
                ))}
              </View>

              <Button
                mode="outlined"
                icon="file-upload-outline"
                onPress={handlePickRepairInvoice}
                style={styles.uploadBtn}
              >
                {invoiceAsset ? `Attached: ${invoiceAsset.name}` : 'Attach Repair Invoice (Optional)'}
              </Button>

              <TextInput
                mode="outlined"
                label="Additional Notes"
                value={additionalNotes}
                onChangeText={setAdditionalNotes}
                multiline
                numberOfLines={3}
                style={styles.input}
                outlineStyle={styles.outline}
              />

              <Button
                mode="contained"
                onPress={handleSave}
                loading={saving}
                disabled={saving}
                buttonColor={Palette.primary}
                style={styles.saveBtn}
                contentStyle={styles.saveContent}
              >
                {isEditing ? 'Update Repair Record' : 'Save Repair Record'}
              </Button>
            </>
          )}
        </AppCard>
      </FormContainer>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: Palette.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  noProducts: { gap: Spacing.md, paddingVertical: Spacing.lg },
  noProdText: { fontSize: 14, color: Palette.textSecondary, textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: Palette.textSecondary, marginBottom: 6 },
  chipRow: { gap: 8, paddingBottom: Spacing.md },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  chip: { backgroundColor: Palette.background },
  input: { marginBottom: Spacing.md, backgroundColor: Palette.surface },
  outline: { borderRadius: Radii.md },
  uploadBtn: { borderRadius: Radii.md, marginBottom: Spacing.md },
  saveBtn: { borderRadius: Radii.md, marginTop: Spacing.sm },
  saveContent: { height: 48 },
});
