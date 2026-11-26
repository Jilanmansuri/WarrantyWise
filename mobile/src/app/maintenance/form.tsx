import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button, Chip, TextInput } from 'react-native-paper';
import { AppCard } from '../../components/ui/AppCard';
import { DatePickerField } from '../../components/ui/DatePickerField';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormContainer } from '../../components/ui/FormContainer';
import { useOffline } from '../../context/OfflineContext';
import { extractErrorMessage, maintenanceApi, productsApi } from '../../services/api';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { Product } from '../../types';
import { addMonthsIso, toIsoDateOnly } from '../../utils/dateUtils';

const PRESETS = [
  { title: 'AC Filter & Coil Servicing', serviceType: 'AC Servicing', freq: '6' },
  { title: 'Water Purifier Filter Replacement', serviceType: 'Filter Replacement', freq: '6' },
  { title: 'Laptop Thermal & Fan Cleaning', serviceType: 'Laptop Servicing', freq: '12' },
  { title: 'Washing Machine Drum Descaling', serviceType: 'Appliance Care', freq: '3' },
  { title: 'Refrigerator Condenser Cleaning', serviceType: 'Refrigerator Care', freq: '12' },
];

export default function MaintenanceFormScreen() {
  const router = useRouter();
  const { id, productId: paramProductId } = useLocalSearchParams<{
    id?: string;
    productId?: string;
  }>();
  const isEditing = Boolean(id);
  const { isOnline, queueMutation } = useOffline();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(paramProductId || '');
  const [title, setTitle] = useState('');
  const [serviceType, setServiceType] = useState('Routine Servicing');
  const [frequencyMonths, setFrequencyMonths] = useState('6');
  const [nextServiceDate, setNextServiceDate] = useState(
    addMonthsIso(toIsoDateOnly(new Date()), 6)
  );
  const [serviceProvider, setServiceProvider] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('0');
  const [notes, setNotes] = useState('');
  const [version, setVersion] = useState<number>(1);

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
          const all = await maintenanceApi.list();
          const found = all.find((m) => m._id === id);
          if (found && mounted) {
            setTitle(found.title);
            setServiceType(found.serviceType);
            setFrequencyMonths(String(found.frequencyMonths));
            setNextServiceDate(toIsoDateOnly(found.nextServiceDate));
            setServiceProvider(found.serviceProvider || '');
            setEstimatedCost(String(found.estimatedCost ?? 0));
            setNotes(found.notes || '');
            setVersion(found.version || 1);
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

  const handleSave = async () => {
    if (!isEditing && !selectedProductId) {
      setError('Please select a product.');
      return;
    }
    if (!title.trim()) {
      setError('Maintenance title is required.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        serviceType: serviceType.trim() || 'Routine Servicing',
        frequencyMonths: Math.max(0, Number(frequencyMonths || 0)),
        nextServiceDate,
        serviceProvider: serviceProvider.trim() || undefined,
        estimatedCost: Math.max(0, Number(estimatedCost || 0)),
        notes: notes.trim() || undefined,
      };

      if (isEditing && id) {
        if (isOnline) {
          await maintenanceApi.update(id, { ...payload, version });
        } else {
          await queueMutation({
            type: 'UPDATE_MAINTENANCE_NOTE',
            targetId: id,
            payload: { notes: payload.notes || '' },
            baseVersion: version,
          });
          Alert.alert('Queued Offline', 'Maintenance note queued for sync.');
        }
      } else if (isOnline) {
        await maintenanceApi.create({ ...payload, productId: selectedProductId });
      } else {
        await queueMutation({
          type: 'CREATE_MAINTENANCE',
          payload: { ...payload, productId: selectedProductId },
        });
        Alert.alert('Queued Offline', 'Maintenance schedule saved offline and queued for sync.');
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
      <Stack.Screen
        options={{ title: isEditing ? 'Edit Maintenance' : 'Schedule Maintenance' }}
      />
      <FormContainer>
        <AppCard>
          {error ? <ErrorBanner message={error} /> : null}

          {!isEditing ? (
            <>
              <Text style={styles.label}>Quick Presets</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {PRESETS.map((p) => (
                  <Chip
                    key={p.title}
                    onPress={() => {
                      setTitle(p.title);
                      setServiceType(p.serviceType);
                      setFrequencyMonths(p.freq);
                      setNextServiceDate(addMonthsIso(toIsoDateOnly(new Date()), Number(p.freq)));
                    }}
                    style={styles.chip}
                  >
                    {p.serviceType}
                  </Chip>
                ))}
              </ScrollView>

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
            label="Maintenance Task Title *"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <TextInput
            mode="outlined"
            label="Service Type"
            value={serviceType}
            onChangeText={setServiceType}
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <DatePickerField
            label="Next Scheduled Service Date *"
            value={nextServiceDate}
            onChange={setNextServiceDate}
          />
          <View style={styles.twoCol}>
            <TextInput
              mode="outlined"
              label="Repeat Every (Mo, 0=once)"
              value={frequencyMonths}
              onChangeText={setFrequencyMonths}
              keyboardType="number-pad"
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
            <TextInput
              mode="outlined"
              label="Estimated Cost"
              value={estimatedCost}
              onChangeText={setEstimatedCost}
              keyboardType="decimal-pad"
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
          </View>
          <TextInput
            mode="outlined"
            label="Preferred Service Provider"
            value={serviceProvider}
            onChangeText={setServiceProvider}
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <TextInput
            mode="outlined"
            label="Maintenance Notes"
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
            {isEditing ? 'Update Schedule' : 'Save Maintenance Schedule'}
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
