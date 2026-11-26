import * as DocumentPicker from 'expo-document-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button, Chip, TextInput } from 'react-native-paper';
import { AppCard, ErrorBanner, FormContainer } from '../../components/ui/Common';
import { DatePickerField } from '../../components/ui/DatePickerField';
import {
  FileUploadAsset,
  amcApi,
  documentsApi,
  extractErrorMessage,
  productsApi,
} from '../../services/api';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { Product } from '../../types';
import { addMonthsIso, toIsoDateOnly } from '../../utils/dateUtils';

export default function AmcFormScreen() {
  const router = useRouter();
  const { id, productId: paramProductId } = useLocalSearchParams<{
    id?: string;
    productId?: string;
  }>();
  const isEditing = Boolean(id);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(paramProductId || '');
  const [providerName, setProviderName] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [providerPhone, setProviderPhone] = useState('');
  const [providerEmail, setProviderEmail] = useState('');
  const [startDate, setStartDate] = useState(toIsoDateOnly(new Date()));
  const [endDate, setEndDate] = useState(addMonthsIso(toIsoDateOnly(new Date()), 12));
  const [cost, setCost] = useState('0');
  const [visitFrequencyMonths, setVisitFrequencyMonths] = useState('6');
  const [scheduledVisitsCount, setScheduledVisitsCount] = useState('2');
  const [notes, setNotes] = useState('');
  const [docAsset, setDocAsset] = useState<FileUploadAsset | null>(null);

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
        if (!paramProductId && list.length > 0) setSelectedProductId(list[0].id);

        if (id) {
          const allAmcs = await amcApi.list();
          const found = allAmcs.find((a) => a._id === id);
          if (found && mounted) {
            setProviderName(found.providerName);
            setContractNumber(found.contractNumber || '');
            setProviderPhone(found.providerPhone || '');
            setProviderEmail(found.providerEmail || '');
            setStartDate(toIsoDateOnly(found.startDate));
            setEndDate(toIsoDateOnly(found.endDate));
            setCost(String(found.cost ?? 0));
            setVisitFrequencyMonths(String(found.visitFrequencyMonths ?? 6));
            setScheduledVisitsCount(String(found.scheduledVisitsCount ?? 2));
            setNotes(found.notes || '');
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
  }, [id, paramProductId]);

  const handlePickDoc = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setDocAsset({
        uri: a.uri,
        name: a.name || `amc-${Date.now()}.pdf`,
        mimeType: a.mimeType || 'application/pdf',
      });
    }
  };

  const handleSave = async () => {
    if (!isEditing && !selectedProductId) {
      setError('Please select a product.');
      return;
    }
    if (!providerName.trim()) {
      setError('AMC provider name is required.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      let contractDocumentId: string | undefined;
      if (docAsset) {
        const uploaded = await documentsApi.upload({
          file: docAsset,
          title: `${providerName.trim()} AMC Contract`,
          type: 'AMC Contract',
          productId: selectedProductId || undefined,
        });
        contractDocumentId = uploaded._id;
      }

      const payload = {
        contractNumber: contractNumber.trim() || undefined,
        providerName: providerName.trim(),
        providerPhone: providerPhone.trim() || undefined,
        providerEmail: providerEmail.trim() || undefined,
        startDate,
        endDate,
        cost: Number(cost || 0),
        visitFrequencyMonths: Math.max(1, Number(visitFrequencyMonths || 6)),
        scheduledVisitsCount: Math.max(0, Number(scheduledVisitsCount || 2)),
        contractDocumentId,
        notes: notes.trim() || undefined,
      };

      if (isEditing && id) {
        await amcApi.update(id, payload);
      } else {
        await amcApi.create({ ...payload, productId: selectedProductId });
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
      <Stack.Screen options={{ title: isEditing ? 'Edit AMC Contract' : 'Add AMC Contract' }} />
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
                    onPress={() => setSelectedProductId(p.id)}
                    style={styles.chip}
                  >
                    {p.brand} {p.productName}
                  </Chip>
                ))}
              </ScrollView>
            </>
          ) : null}

          <TextInput
            mode="outlined"
            label="AMC Provider Name *"
            value={providerName}
            onChangeText={setProviderName}
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <View style={styles.twoCol}>
            <TextInput
              mode="outlined"
              label="Contract Number"
              value={contractNumber}
              onChangeText={setContractNumber}
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
            <TextInput
              mode="outlined"
              label="Contract Cost"
              value={cost}
              onChangeText={setCost}
              keyboardType="decimal-pad"
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
          </View>
          <View style={styles.twoCol}>
            <TextInput
              mode="outlined"
              label="Provider Phone"
              value={providerPhone}
              onChangeText={setProviderPhone}
              keyboardType="phone-pad"
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
            <TextInput
              mode="outlined"
              label="Provider Email"
              value={providerEmail}
              onChangeText={setProviderEmail}
              autoCapitalize="none"
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
          </View>

          <DatePickerField label="Contract Start Date *" value={startDate} onChange={setStartDate} />
          <DatePickerField label="Contract Expiry Date *" value={endDate} onChange={setEndDate} />

          <View style={styles.twoCol}>
            <TextInput
              mode="outlined"
              label="Visit Interval (Months)"
              value={visitFrequencyMonths}
              onChangeText={setVisitFrequencyMonths}
              keyboardType="number-pad"
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
            <TextInput
              mode="outlined"
              label="Total Included Visits"
              value={scheduledVisitsCount}
              onChangeText={setScheduledVisitsCount}
              keyboardType="number-pad"
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
          </View>

          <Button
            mode="outlined"
            icon="file-upload-outline"
            onPress={handlePickDoc}
            style={{ marginBottom: Spacing.md, borderRadius: Radii.md }}
          >
            {docAsset ? `Attached: ${docAsset.name}` : 'Upload AMC Contract Document'}
          </Button>

          <TextInput
            mode="outlined"
            label="Contract Notes"
            value={notes}
            onChangeText={setNotes}
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
            style={{ borderRadius: Radii.md }}
            contentStyle={{ height: 48 }}
          >
            {isEditing ? 'Save Contract' : 'Create AMC Contract'}
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
  chipRow: { gap: 8, paddingBottom: Spacing.md },
  chip: { backgroundColor: Palette.background },
  input: { marginBottom: Spacing.md, backgroundColor: Palette.surface },
  outline: { borderRadius: Radii.md },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
  half: { flex: 1 },
});
