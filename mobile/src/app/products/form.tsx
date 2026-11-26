import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Chip, Switch, TextInput } from 'react-native-paper';
import { AppCard, ErrorBanner, FormContainer } from '../../components/ui/Common';
import { DatePickerField } from '../../components/ui/DatePickerField';
import { useAuth } from '../../context/AuthContext';
import {
  FileUploadAsset,
  documentsApi,
  extractErrorMessage,
  familyApi,
  productsApi,
} from '../../services/api';
import { sendProductAddedNotification } from '../../services/notifications';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import {
  FamilyMemberRecord,
  LIFECYCLE_STATUSES,
  LifecycleStatus,
  PRODUCT_CATEGORIES,
  ProductCategory,
} from '../../types';
import { addMonthsIso, toIsoDateOnly } from '../../utils/dateUtils';

export default function ProductFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const { notificationPreferences } = useAuth();

  const [loadingInitial, setLoadingInitial] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberRecord[]>([]);

  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Smartphones');
  const [purchaseDate, setPurchaseDate] = useState(toIsoDateOnly(new Date()));
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [sellerName, setSellerName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [warrantyDurationMonths, setWarrantyDurationMonths] = useState('12');
  const [warrantyStartDate, setWarrantyStartDate] = useState(toIsoDateOnly(new Date()));
  const [customEndDateEnabled, setCustomEndDateEnabled] = useState(false);
  const [customWarrantyEndDate, setCustomWarrantyEndDate] = useState(
    addMonthsIso(toIsoDateOnly(new Date()), 12)
  );
  const warrantyEndDate = customEndDateEnabled
    ? customWarrantyEndDate
    : /^\d{4}-\d{2}-\d{2}$/.test(warrantyStartDate)
      ? addMonthsIso(warrantyStartDate, Math.max(0, Number(warrantyDurationMonths) || 0))
      : customWarrantyEndDate;

  // Extended Warranty
  const [hasExtendedWarranty, setHasExtendedWarranty] = useState(false);
  const [extendedWarrantyProvider, setExtendedWarrantyProvider] = useState('');
  const [extendedWarrantyMonths, setExtendedWarrantyMonths] = useState('12');
  const [extendedWarrantyCost, setExtendedWarrantyCost] = useState('');

  // Transfer & Lifecycle
  const [warrantyTransferable, setWarrantyTransferable] = useState(false);
  const [transferredToName, setTransferredToName] = useState('');
  const [transferredToEmail, setTransferredToEmail] = useState('');
  const [lifecycleStatus, setLifecycleStatus] = useState<LifecycleStatus>('Active');
  const [resalePrice, setResalePrice] = useState('');
  const [resaleDate, setResaleDate] = useState(toIsoDateOnly(new Date()));
  const [resaleBuyerName, setResaleBuyerName] = useState('');
  const [disposalMethod, setDisposalMethod] = useState('');

  // Family Assignment
  const [familyMemberId, setFamilyMemberId] = useState<string>('');
  const [sharedWithFamily, setSharedWithFamily] = useState(false);

  const [additionalNotes, setAdditionalNotes] = useState('');
  const [productImageAsset, setProductImageAsset] = useState<FileUploadAsset | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState('');
  const [invoiceAsset, setInvoiceAsset] = useState<FileUploadAsset | null>(null);
  const [existingInvoiceDocId, setExistingInvoiceDocId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const famData = await familyApi.getDashboard().catch(() => null);
        if (mounted && famData) setFamilyMembers(famData.members);

        if (!id) return;
        const prod = await productsApi.getById(id);
        if (!mounted) return;
        setProductName(prod.productName);
        setBrand(prod.brand);
        setModelNumber(prod.modelNumber || '');
        setSerialNumber(prod.serialNumber || '');
        setCategory(prod.category);
        setPurchaseDate(toIsoDateOnly(prod.purchaseDate));
        setPurchasePrice(
          prod.purchasePrice !== undefined && prod.purchasePrice !== null
            ? String(prod.purchasePrice)
            : ''
        );
        setCurrency(prod.currency || 'USD');
        setSellerName(prod.sellerName || '');
        setInvoiceNumber(prod.invoiceNumber || '');
        setWarrantyDurationMonths(String(prod.warrantyDurationMonths));
        setWarrantyStartDate(toIsoDateOnly(prod.warrantyStartDate));
        setCustomWarrantyEndDate(toIsoDateOnly(prod.warrantyEndDate));

        if (prod.extendedWarrantyMonths || prod.extendedWarrantyEndDate) {
          setHasExtendedWarranty(true);
          setExtendedWarrantyProvider(prod.extendedWarrantyProvider || '');
          setExtendedWarrantyMonths(String(prod.extendedWarrantyMonths || 12));
          setExtendedWarrantyCost(
            prod.extendedWarrantyCost !== undefined ? String(prod.extendedWarrantyCost) : ''
          );
        }

        setWarrantyTransferable(Boolean(prod.warrantyTransferable));
        setTransferredToName(prod.transferredToName || '');
        setTransferredToEmail(prod.transferredToEmail || '');
        setLifecycleStatus(prod.lifecycleStatus || 'Active');
        if (prod.resalePrice !== undefined) setResalePrice(String(prod.resalePrice));
        if (prod.resaleDate) setResaleDate(toIsoDateOnly(prod.resaleDate));
        setResaleBuyerName(prod.resaleBuyerName || '');
        setDisposalMethod(prod.disposalMethod || '');
        setFamilyMemberId(prod.familyMemberId || '');
        setSharedWithFamily(Boolean(prod.sharedWithFamily));

        setAdditionalNotes(prod.additionalNotes || '');
        setExistingImageUrl(prod.productImageUrl || '');
        setExistingInvoiceDocId(prod.invoiceDocumentId);
      } catch (err) {
        if (mounted) setError(extractErrorMessage(err));
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handlePickProductImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please allow photo access to attach a product image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setProductImageAsset({
        uri: a.uri,
        name: a.fileName || `product-${Date.now()}.jpg`,
        mimeType: a.mimeType || 'image/jpeg',
      });
    }
  };

  const handlePickInvoice = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setInvoiceAsset({
        uri: a.uri,
        name: a.name || `invoice-${Date.now()}.pdf`,
        mimeType: a.mimeType || 'application/pdf',
      });
    }
  };

  const handleSubmit = async () => {
    if (!productName.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!brand.trim()) {
      setError('Brand is required.');
      return;
    }
    const months = Number(warrantyDurationMonths);
    if (!Number.isFinite(months) || months < 0) {
      setError('Warranty duration must be 0 or greater.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      let productImageDocumentId: string | undefined;
      let invoiceDocumentId: string | undefined = existingInvoiceDocId;

      if (productImageAsset) {
        const uploadedImg = await documentsApi.upload({
          file: productImageAsset,
          title: `${brand.trim()} ${productName.trim()} Photo`,
          type: 'Other',
          productId: id,
        });
        productImageDocumentId = uploadedImg._id;
      }

      if (invoiceAsset) {
        const uploadedInv = await documentsApi.upload({
          file: invoiceAsset,
          title: `${brand.trim()} ${productName.trim()} Invoice`,
          type: 'Purchase Invoice',
          productId: id,
        });
        invoiceDocumentId = uploadedInv._id;
      }

      const payload = {
        productName: productName.trim(),
        brand: brand.trim(),
        modelNumber: modelNumber.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        category,
        purchaseDate,
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        currency,
        sellerName: sellerName.trim() || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        warrantyDurationMonths: Math.round(months),
        warrantyStartDate,
        warrantyEndDate: customEndDateEnabled ? warrantyEndDate : undefined,
        extendedWarrantyProvider: hasExtendedWarranty
          ? extendedWarrantyProvider.trim() || undefined
          : undefined,
        extendedWarrantyMonths: hasExtendedWarranty
          ? Math.max(0, Math.round(Number(extendedWarrantyMonths || 0)))
          : isEditing
            ? 0
            : undefined,
        extendedWarrantyCost:
          hasExtendedWarranty && extendedWarrantyCost ? Number(extendedWarrantyCost) : undefined,
        warrantyTransferable,
        transferredToName: transferredToName.trim() || undefined,
        transferredToEmail: transferredToEmail.trim() || undefined,
        transferredAt: transferredToName.trim() ? toIsoDateOnly(new Date()) : undefined,
        lifecycleStatus,
        resalePrice: lifecycleStatus === 'Resold' && resalePrice ? Number(resalePrice) : undefined,
        resaleDate: lifecycleStatus === 'Resold' ? resaleDate : undefined,
        resaleBuyerName: lifecycleStatus === 'Resold' ? resaleBuyerName.trim() || undefined : undefined,
        disposalDate: lifecycleStatus === 'Disposed' ? toIsoDateOnly(new Date()) : undefined,
        disposalMethod: lifecycleStatus === 'Disposed' ? disposalMethod.trim() || undefined : undefined,
        familyMemberId: familyMemberId || null,
        sharedWithFamily: Boolean(familyMemberId && sharedWithFamily),
        productImageDocumentId,
        invoiceDocumentId,
        additionalNotes: additionalNotes.trim() || undefined,
      };

      if (isEditing && id) {
        await productsApi.update(id, payload);
        router.replace(`/products/${id}`);
      } else {
        const created = await productsApi.create(payload);
        await sendProductAddedNotification(
          created.productName,
          created.warrantyEndDate,
          notificationPreferences
        );
        router.replace(`/products/${created.id}`);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Palette.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: isEditing ? 'Edit Product' : 'Add Product' }} />
      <FormContainer>
        <AppCard>
          {error ? <ErrorBanner message={error} /> : null}

          <Text style={styles.sectionHeading}>Product Information</Text>
          <TextInput
            mode="outlined"
            label="Product Name *"
            value={productName}
            onChangeText={setProductName}
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <TextInput
            mode="outlined"
            label="Brand *"
            value={brand}
            onChangeText={setBrand}
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <View style={styles.twoCol}>
            <TextInput
              mode="outlined"
              label="Model Number"
              value={modelNumber}
              onChangeText={setModelNumber}
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
            <TextInput
              mode="outlined"
              label="Serial Number"
              value={serialNumber}
              onChangeText={setSerialNumber}
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
          </View>

          <Text style={styles.label}>Category *</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            {PRODUCT_CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                selected={category === cat}
                onPress={() => setCategory(cat)}
                style={styles.chip}
              >
                {cat}
              </Chip>
            ))}
          </ScrollView>

          <Text style={styles.sectionHeading}>Purchase &amp; Seller</Text>
          <DatePickerField
            label="Purchase Date *"
            value={purchaseDate}
            onChange={(d) => {
              setPurchaseDate(d);
              if (!isEditing) setWarrantyStartDate(d);
            }}
          />
          <View style={styles.twoCol}>
            <TextInput
              mode="outlined"
              label="Purchase Price"
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              keyboardType="decimal-pad"
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
            <TextInput
              mode="outlined"
              label="Currency (USD/INR)"
              value={currency}
              onChangeText={(t) => setCurrency(t.toUpperCase())}
              maxLength={5}
              style={[styles.input, styles.half]}
              outlineStyle={styles.outline}
            />
          </View>
          <TextInput
            mode="outlined"
            label="Seller Name"
            value={sellerName}
            onChangeText={setSellerName}
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <TextInput
            mode="outlined"
            label="Invoice Number"
            value={invoiceNumber}
            onChangeText={setInvoiceNumber}
            style={styles.input}
            outlineStyle={styles.outline}
          />

          <Text style={styles.sectionHeading}>Standard Warranty</Text>
          <DatePickerField
            label="Warranty Start Date *"
            value={warrantyStartDate}
            onChange={setWarrantyStartDate}
          />
          <TextInput
            mode="outlined"
            label="Standard Duration (Months) *"
            value={warrantyDurationMonths}
            onChangeText={setWarrantyDurationMonths}
            keyboardType="number-pad"
            style={styles.input}
            outlineStyle={styles.outline}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Override Standard End Date Manually</Text>
            <Switch
              value={customEndDateEnabled}
              onValueChange={setCustomEndDateEnabled}
              color={Palette.primary}
            />
          </View>

          {customEndDateEnabled ? (
            <DatePickerField
              label="Warranty End Date"
              value={customWarrantyEndDate}
              onChange={setCustomWarrantyEndDate}
            />
          ) : (
            <View style={styles.calcBox}>
              <Text style={styles.calcText}>
                Standard Expiry (leap-year adjusted):{' '}
                <Text style={styles.calcBold}>{warrantyEndDate}</Text>
              </Text>
            </View>
          )}

          {/* Extended Warranty */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Add Extended Warranty / Protection Plan</Text>
            <Switch
              value={hasExtendedWarranty}
              onValueChange={setHasExtendedWarranty}
              color={Palette.primary}
            />
          </View>
          {hasExtendedWarranty ? (
            <View style={styles.subBox}>
              <TextInput
                mode="outlined"
                label="Extended Provider (e.g. AppleCare+)"
                value={extendedWarrantyProvider}
                onChangeText={setExtendedWarrantyProvider}
                style={styles.input}
                outlineStyle={styles.outline}
              />
              <View style={styles.twoCol}>
                <TextInput
                  mode="outlined"
                  label="Extended Months"
                  value={extendedWarrantyMonths}
                  onChangeText={setExtendedWarrantyMonths}
                  keyboardType="number-pad"
                  style={[styles.input, styles.half]}
                  outlineStyle={styles.outline}
                />
                <TextInput
                  mode="outlined"
                  label="Plan Cost"
                  value={extendedWarrantyCost}
                  onChangeText={setExtendedWarrantyCost}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.half]}
                  outlineStyle={styles.outline}
                />
              </View>
            </View>
          ) : null}

          {/* Family Vault Assignment */}
          <Text style={styles.sectionHeading}>Family Product Vault</Text>
          {familyMembers.length === 0 ? (
            <Text style={styles.helperText}>
              No family members added yet. Add members from the Family Vault screen to assign products.
            </Text>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catRow}
              >
                <Chip
                  selected={!familyMemberId}
                  onPress={() => {
                    setFamilyMemberId('');
                    setSharedWithFamily(false);
                  }}
                  style={styles.chip}
                >
                  Personal (Owner Only)
                </Chip>
                {familyMembers.map((m) => (
                  <Chip
                    key={m._id}
                    selected={familyMemberId === m._id}
                    onPress={() => setFamilyMemberId(m._id)}
                    style={styles.chip}
                  >
                    {m.name} ({m.relationship})
                  </Chip>
                ))}
              </ScrollView>
              {familyMemberId ? (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Share with linked member account</Text>
                  <Switch
                    value={sharedWithFamily}
                    onValueChange={setSharedWithFamily}
                    color={Palette.primary}
                  />
                </View>
              ) : null}
            </>
          )}

          {/* Lifecycle, Transfer & Resale */}
          <Text style={styles.sectionHeading}>Lifecycle &amp; Warranty Transfer</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Warranty Transferable on Resale</Text>
            <Switch
              value={warrantyTransferable}
              onValueChange={setWarrantyTransferable}
              color={Palette.primary}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            {LIFECYCLE_STATUSES.map((st) => (
              <Chip
                key={st}
                selected={lifecycleStatus === st}
                onPress={() => setLifecycleStatus(st)}
                style={styles.chip}
              >
                {st}
              </Chip>
            ))}
          </ScrollView>

          {lifecycleStatus === 'Resold' ? (
            <View style={styles.subBox}>
              <View style={styles.twoCol}>
                <TextInput
                  mode="outlined"
                  label="Resale Price"
                  value={resalePrice}
                  onChangeText={setResalePrice}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.half]}
                  outlineStyle={styles.outline}
                />
                <TextInput
                  mode="outlined"
                  label="Buyer Name"
                  value={resaleBuyerName}
                  onChangeText={setResaleBuyerName}
                  style={[styles.input, styles.half]}
                  outlineStyle={styles.outline}
                />
              </View>
              <DatePickerField label="Resale Date" value={resaleDate} onChange={setResaleDate} />
              {warrantyTransferable ? (
                <>
                  <TextInput
                    mode="outlined"
                    label="Warranty Transferred To (Name)"
                    value={transferredToName}
                    onChangeText={setTransferredToName}
                    style={styles.input}
                    outlineStyle={styles.outline}
                  />
                  <TextInput
                    mode="outlined"
                    label="Warranty Transferred To (Email)"
                    value={transferredToEmail}
                    onChangeText={setTransferredToEmail}
                    autoCapitalize="none"
                    style={styles.input}
                    outlineStyle={styles.outline}
                  />
                </>
              ) : null}
            </View>
          ) : null}

          {lifecycleStatus === 'Disposed' ? (
            <TextInput
              mode="outlined"
              label="Disposal / Recycling Method"
              value={disposalMethod}
              onChangeText={setDisposalMethod}
              placeholder="e.g. Certified E-Waste Recycler"
              style={styles.input}
              outlineStyle={styles.outline}
            />
          ) : null}

          <Text style={styles.sectionHeading}>Attachments &amp; Notes</Text>
          <View style={styles.attachRow}>
            <Button
              mode="outlined"
              icon="image-plus"
              onPress={handlePickProductImage}
              style={styles.attachBtn}
            >
              {productImageAsset ? 'Change Photo' : 'Product Photo'}
            </Button>
            <Button
              mode="outlined"
              icon="file-document-plus-outline"
              onPress={handlePickInvoice}
              style={styles.attachBtn}
            >
              {invoiceAsset ? 'Change Invoice' : 'Attach Invoice'}
            </Button>
          </View>

          {productImageAsset?.uri || existingImageUrl ? (
            <Image
              source={{ uri: productImageAsset?.uri || existingImageUrl }}
              style={styles.previewImg}
            />
          ) : null}

          {invoiceAsset ? (
            <Text style={styles.attachedName}>Selected Invoice: {invoiceAsset.name}</Text>
          ) : existingInvoiceDocId ? (
            <Text style={styles.attachedName}>Purchase invoice already linked.</Text>
          ) : null}

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
            onPress={handleSubmit}
            loading={saving}
            disabled={saving}
            buttonColor={Palette.primary}
            style={styles.submitBtn}
            contentStyle={styles.submitContent}
          >
            {isEditing ? 'Save Changes' : 'Save Product'}
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
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.primary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  helperText: { fontSize: 12, color: Palette.textMuted, marginBottom: Spacing.sm },
  input: { marginBottom: Spacing.md, backgroundColor: Palette.surface },
  outline: { borderRadius: Radii.md },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
  half: { flex: 1 },
  label: { fontSize: 12, fontWeight: '600', color: Palette.textSecondary, marginBottom: 6 },
  catRow: { gap: 8, paddingBottom: Spacing.md },
  chip: { backgroundColor: Palette.background },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  switchLabel: { fontSize: 13, fontWeight: '500', color: Palette.textPrimary, flex: 1 },
  subBox: {
    backgroundColor: Palette.surfaceMuted,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: Spacing.md,
  },
  calcBox: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  calcText: { fontSize: 13, color: Palette.primary },
  calcBold: { fontWeight: '800' },
  attachRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  attachBtn: { flex: 1, borderRadius: Radii.md },
  previewImg: {
    width: '100%',
    height: 140,
    borderRadius: Radii.md,
    marginBottom: Spacing.md,
    backgroundColor: Palette.surfaceMuted,
  },
  attachedName: {
    fontSize: 12,
    color: Palette.success,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  submitBtn: { borderRadius: Radii.md, marginTop: Spacing.sm },
  submitContent: { height: 48 },
});
