import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Checkbox,
  Chip,
  SegmentedButtons,
  TextInput,
} from 'react-native-paper';
import { AppCard } from '../../components/ui/AppCard';
import { DatePickerField } from '../../components/ui/DatePickerField';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormContainer } from '../../components/ui/FormContainer';
import { useAuth } from '../../context/AuthContext';
import {
  documentsApi,
  extractErrorMessage,
  ocrApi,
  productsApi,
} from '../../services/api';
import { sendProductAddedNotification } from '../../services/notifications';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { OcrParseResult, PRODUCT_CATEGORIES, ProductCategory } from '../../types';
import { addMonthsIso, toIsoDateOnly } from '../../utils/dateUtils';

export default function InvoiceAndQrScannerScreen() {
  const router = useRouter();
  const { notificationPreferences } = useAuth();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [scanMode, setScanMode] = useState<'invoice' | 'qr'>('invoice');
  const [qrScanningActive, setQrScanningActive] = useState(false);
  const [manualQrToken, setManualQrToken] = useState('');

  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageName, setImageName] = useState('invoice.jpg');
  const [imageMime, setImageMime] = useState('image/jpeg');

  const [scanningOcr, setScanningOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrParseResult | null>(null);
  const [ocrFailedMsg, setOcrFailedMsg] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);

  // Editable verified fields
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Other');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(toIsoDateOnly(new Date()));
  const [dateVerified, setDateVerified] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [sellerName, setSellerName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('12');
  const [extendedWarrantyMonths, setExtendedWarrantyMonths] = useState('');
  const [extendedWarrantyProvider, setExtendedWarrantyProvider] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenQrScanner = async () => {
    const perm = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!perm.granted) {
      Alert.alert('Camera Permission Required', 'Allow camera access to scan WarrantyWise QR codes.');
      return;
    }
    setQrScanningActive(true);
  };

  const handleQrBarcodeScanned = (rawValue: string) => {
    setQrScanningActive(false);
    const cleaned = rawValue.replace(/^warrantywise:\/\/qr\//i, '').trim();
    if (!cleaned) return;
    router.push(`/qr/${encodeURIComponent(cleaned)}`);
  };

  const processSelectedImage = async (uri: string, fileName?: string | null, mime?: string | null) => {
    const resolvedName = fileName || `invoice-${Date.now()}.jpg`;
    const resolvedMime = mime || 'image/jpeg';

    setImageUri(uri);
    setImageName(resolvedName);
    setImageMime(resolvedMime);
    setOcrResult(null);
    setOcrFailedMsg(null);
    setError(null);
    setDateVerified(false);
    setScanningOcr(true);

    try {
      const result = await ocrApi.parseInvoiceImage({
        uri,
        name: resolvedName,
        mimeType: resolvedMime,
      });

      setOcrResult(result);
      if (result.extracted.invoiceNumber) setInvoiceNumber(result.extracted.invoiceNumber);
      if (result.extracted.productName) setProductName(result.extracted.productName);
      if (result.extracted.brand) setBrand(result.extracted.brand);
      if (result.extracted.modelNumber) setModelNumber(result.extracted.modelNumber);
      if (result.extracted.serialNumber) setSerialNumber(result.extracted.serialNumber);
      if (result.extracted.amount !== undefined) setPurchasePrice(String(result.extracted.amount));
      if (result.extracted.currency) setCurrency(result.extracted.currency);
      if (result.extracted.sellerName) setSellerName(result.extracted.sellerName);
      if (result.extracted.warrantyDurationMonths) {
        setWarrantyMonths(String(result.extracted.warrantyDurationMonths));
      }
      if (result.extracted.extendedWarrantyMonths) {
        setExtendedWarrantyMonths(String(result.extracted.extendedWarrantyMonths));
      }
      if (result.extracted.suggestedPurchaseDate) {
        setPurchaseDate(result.extracted.suggestedPurchaseDate);
      }

      if (!result.rawText.trim()) {
        setOcrFailedMsg(
          'No readable text could be extracted from this image. Please fill in the fields manually below.'
        );
      }
    } catch (err) {
      setOcrFailedMsg(
        `OCR processing could not complete (${extractErrorMessage(err)}). You can still enter details manually and save the invoice image.`
      );
    } finally {
      setScanningOcr(false);
    }
  };

  const handleOpenCamera = async () => {
    const perm = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!perm.granted) {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access in device settings to scan invoices.'
      );
      return;
    }
    setCameraModalVisible(true);
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      setCameraModalVisible(false);
      if (photo?.uri) {
        await processSelectedImage(photo.uri, `invoice-cam-${Date.now()}.jpg`, 'image/jpeg');
      }
    } catch {
      Alert.alert('Camera Error', 'Could not capture photo. Please try again or pick from gallery.');
    }
  };

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Gallery Permission Required',
        'Please allow photo library access to select an invoice image.'
      );
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
    });

    if (!picked.canceled && picked.assets[0]) {
      const asset = picked.assets[0];
      await processSelectedImage(asset.uri, asset.fileName, asset.mimeType);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!productName.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!brand.trim()) {
      setError('Brand is required.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      setError('Please select a valid purchase date.');
      return;
    }
    if (ocrResult && !dateVerified) {
      setError('Please confirm that you verified the extracted Purchase Date.');
      return;
    }

    const duration = Number(warrantyMonths);
    if (!Number.isFinite(duration) || duration < 0) {
      setError('Please enter a valid warranty duration in months.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      let invoiceDocumentId: string | undefined;

      if (imageUri) {
        const uploadedDoc = await documentsApi.upload({
          file: { uri: imageUri, name: imageName, mimeType: imageMime },
          title: `${brand.trim()} ${productName.trim()} Invoice`,
          type: 'Purchase Invoice',
        });
        invoiceDocumentId = uploadedDoc._id;
      }

      const extMonths = Number(extendedWarrantyMonths);
      const created = await productsApi.create({
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
        warrantyDurationMonths: Math.round(duration),
        extendedWarrantyMonths:
          Number.isFinite(extMonths) && extMonths > 0 ? Math.round(extMonths) : undefined,
        extendedWarrantyProvider: extendedWarrantyProvider.trim() || undefined,
        invoiceDocumentId,
      });

      await sendProductAddedNotification(
        created.productName,
        created.warrantyEndDate,
        notificationPreferences
      );

      router.replace(`/products/${created.id}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const calculatedEnd = addMonthsIso(purchaseDate, Number(warrantyMonths) || 0);

  return (
    <FormContainer contentContainerStyle={{ gap: Spacing.md }}>
      <SegmentedButtons
        value={scanMode}
        onValueChange={(v) => setScanMode(v as 'invoice' | 'qr')}
        buttons={[
          { value: 'invoice', label: 'Invoice OCR', icon: 'receipt' },
          { value: 'qr', label: 'QR Identity', icon: 'qrcode-scan' },
        ]}
        style={{ marginBottom: Spacing.xs }}
      />

      {scanMode === 'qr' ? (
        <AppCard>
          <Text style={styles.heading}>Scan QR Product Identity</Text>
          <Text style={styles.sub}>
            Scan a WarrantyWise product QR code to view its verified identity, warranty status, and
            repair history (requires account authorization).
          </Text>
          <Button
            mode="contained"
            icon="qrcode-scan"
            buttonColor={Palette.primary}
            onPress={handleOpenQrScanner}
            style={{ marginTop: Spacing.lg, borderRadius: Radii.md }}
            contentStyle={{ height: 48 }}
          >
            Open QR Camera Scanner
          </Button>

          <Text style={[styles.fieldLabel, { marginTop: Spacing.xl }]}>
            Or enter QR Token manually
          </Text>
          <TextInput
            mode="outlined"
            label="QR Token (e.g. WW-...)"
            value={manualQrToken}
            onChangeText={setManualQrToken}
            autoCapitalize="none"
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <Button
            mode="outlined"
            disabled={!manualQrToken.trim()}
            onPress={() => handleQrBarcodeScanned(manualQrToken)}
            style={{ borderRadius: Radii.md }}
          >
            Look Up Product
          </Button>
        </AppCard>
      ) : (
        <>
          <AppCard>
            <Text style={styles.heading}>Smart Invoice Scanner</Text>
            <Text style={styles.sub}>
              Capture or upload a receipt. OCR extracts candidate dates, price, brand, and warranty
              terms for your review.
            </Text>

            <View style={styles.captureButtons}>
              <Button
                mode="contained"
                icon="camera"
                buttonColor={Palette.primary}
                onPress={handleOpenCamera}
                style={styles.flexBtn}
              >
                Camera
              </Button>
              <Button
                mode="outlined"
                icon="image-outline"
                textColor={Palette.primary}
                onPress={handlePickImage}
                style={styles.flexBtn}
              >
                Gallery
              </Button>
            </View>

            {imageUri ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: imageUri }} style={styles.previewImg} resizeMode="contain" />
              </View>
            ) : null}

            {scanningOcr ? (
              <View style={styles.ocrLoading}>
                <ActivityIndicator color={Palette.primary} />
                <Text style={styles.ocrLoadingText}>Extracting invoice &amp; warranty info...</Text>
              </View>
            ) : null}
          </AppCard>

          {ocrResult ? (
            <View style={styles.noticeBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={Palette.warning} />
              <View style={styles.noticeBody}>
                <Text style={styles.noticeTitle}>Verify Extracted Details</Text>
                <Text style={styles.noticeText}>{ocrResult.verificationNotice}</Text>
                {ocrResult.extracted.warrantySummary ? (
                  <Text style={styles.detectedWarranty}>
                    Detected Warranty: {ocrResult.extracted.warrantySummary}
                  </Text>
                ) : null}
                {ocrResult.rawText ? (
                  <Pressable onPress={() => setShowRawText((p) => !p)}>
                    <Text style={styles.toggleRaw}>
                      {showRawText ? 'Hide raw OCR text' : 'View raw OCR text'}
                    </Text>
                  </Pressable>
                ) : null}
                {showRawText ? <Text style={styles.rawText}>{ocrResult.rawText}</Text> : null}
              </View>
            </View>
          ) : null}

          {ocrFailedMsg ? (
            <View style={styles.fallbackBox}>
              <Text style={styles.fallbackText}>{ocrFailedMsg}</Text>
            </View>
          ) : null}

          <AppCard>
            <Text style={styles.formTitle}>
              {ocrResult ? 'Review & Edit Extracted Product Info' : 'Manual Product & Invoice Entry'}
            </Text>

            {error ? <ErrorBanner message={error} /> : null}

            {ocrResult && ocrResult.extracted.candidateDates.length > 0 ? (
              <View style={styles.candidateWrap}>
                <Text style={styles.candidateLabel}>Dates detected on invoice (tap to select):</Text>
                <View style={styles.candidateRow}>
                  {ocrResult.extracted.candidateDates.map((d) => (
                    <Chip
                      key={d}
                      selected={purchaseDate === d}
                      onPress={() => {
                        setPurchaseDate(d);
                        setDateVerified(true);
                      }}
                      style={styles.candidateChip}
                    >
                      {d}
                    </Chip>
                  ))}
                </View>
              </View>
            ) : null}

            <DatePickerField
              label="Purchase Date *"
              value={purchaseDate}
              onChange={(d) => {
                setPurchaseDate(d);
                setDateVerified(true);
              }}
            />

            {ocrResult ? (
              <Pressable onPress={() => setDateVerified((prev) => !prev)} style={styles.verifyRow}>
                <Checkbox
                  status={dateVerified ? 'checked' : 'unchecked'}
                  onPress={() => setDateVerified((prev) => !prev)}
                  color={Palette.primary}
                />
                <Text style={styles.verifyLabel}>
                  I verified that {purchaseDate} is the actual Purchase Date on the invoice
                </Text>
              </Pressable>
            ) : null}

            <TextInput
              mode="outlined"
              label="Product Name *"
              value={productName}
              onChangeText={setProductName}
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <View style={styles.twoCol}>
              <TextInput
                mode="outlined"
                label="Brand *"
                value={brand}
                onChangeText={setBrand}
                style={[styles.input, styles.half]}
                outlineStyle={styles.outline}
              />
              <TextInput
                mode="outlined"
                label="Model Number"
                value={modelNumber}
                onChangeText={setModelNumber}
                style={[styles.input, styles.half]}
                outlineStyle={styles.outline}
              />
            </View>

            <Text style={styles.fieldLabel}>Category</Text>
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
                  style={styles.catChip}
                >
                  {cat}
                </Chip>
              ))}
            </ScrollView>

            <View style={styles.twoCol}>
              <TextInput
                mode="outlined"
                label="Invoice Number"
                value={invoiceNumber}
                onChangeText={setInvoiceNumber}
                style={[styles.input, styles.half]}
                outlineStyle={styles.outline}
              />
              <TextInput
                mode="outlined"
                label={`Amount (${currency})`}
                value={purchasePrice}
                onChangeText={setPurchasePrice}
                keyboardType="decimal-pad"
                style={[styles.input, styles.half]}
                outlineStyle={styles.outline}
              />
            </View>

            <TextInput
              mode="outlined"
              label="Seller / Store Name"
              value={sellerName}
              onChangeText={setSellerName}
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <View style={styles.twoCol}>
              <TextInput
                mode="outlined"
                label="Serial Number"
                value={serialNumber}
                onChangeText={setSerialNumber}
                style={[styles.input, styles.half]}
                outlineStyle={styles.outline}
              />
              <TextInput
                mode="outlined"
                label="Standard Warranty (Mo) *"
                value={warrantyMonths}
                onChangeText={setWarrantyMonths}
                keyboardType="number-pad"
                style={[styles.input, styles.half]}
                outlineStyle={styles.outline}
              />
            </View>

            <View style={styles.twoCol}>
              <TextInput
                mode="outlined"
                label="Extended Warranty (Mo)"
                value={extendedWarrantyMonths}
                onChangeText={setExtendedWarrantyMonths}
                keyboardType="number-pad"
                style={[styles.input, styles.half]}
                outlineStyle={styles.outline}
              />
              <TextInput
                mode="outlined"
                label="Extended Provider"
                value={extendedWarrantyProvider}
                onChangeText={setExtendedWarrantyProvider}
                style={[styles.input, styles.half]}
                outlineStyle={styles.outline}
              />
            </View>

            <View style={styles.calcBanner}>
              <Text style={styles.calcText}>
                Standard Warranty Expiry: <Text style={styles.calcBold}>{calculatedEnd}</Text>
              </Text>
            </View>

            <Button
              mode="contained"
              onPress={handleConfirmAndSave}
              loading={saving}
              disabled={saving || scanningOcr}
              buttonColor={Palette.primary}
              style={styles.saveBtn}
              contentStyle={styles.saveContent}
            >
              Confirm &amp; Save Product
            </Button>
          </AppCard>
        </>
      )}

      {/* Invoice Photo Camera Modal */}
      <Modal visible={cameraModalVisible} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.cameraView} facing="back" />
          <View style={styles.cameraOverlay}>
            <Button
              mode="contained"
              buttonColor="rgba(15, 23, 42, 0.75)"
              onPress={() => setCameraModalVisible(false)}
            >
              Cancel
            </Button>
            <Pressable onPress={handleTakePhoto} style={styles.shutterOuter}>
              <View style={styles.shutterInner} />
            </Pressable>
            <View style={{ width: 76 }} />
          </View>
        </View>
      </Modal>

      {/* QR Code Scanner Modal */}
      <Modal visible={qrScanningActive} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.cameraView}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(res) => {
              if (res?.data) {
                handleQrBarcodeScanned(res.data);
              }
            }}
          />
          <View style={styles.qrGuide}>
            <Text style={styles.qrGuideText}>Point camera at a WarrantyWise QR code</Text>
          </View>
          <View style={styles.cameraOverlay}>
            <Button
              mode="contained"
              buttonColor="rgba(15, 23, 42, 0.85)"
              onPress={() => setQrScanningActive(false)}
            >
              Close Scanner
            </Button>
          </View>
        </View>
      </Modal>
    </FormContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  heading: { fontSize: 19, fontWeight: '800', color: Palette.textPrimary },
  sub: { fontSize: 13, color: Palette.textSecondary, marginTop: 4, lineHeight: 19 },
  captureButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  flexBtn: { flex: 1, borderRadius: Radii.md },
  previewWrap: {
    marginTop: Spacing.md,
    borderRadius: Radii.md,
    overflow: 'hidden',
    backgroundColor: Palette.surfaceMuted,
    borderWidth: 1,
    borderColor: Palette.border,
    height: 190,
  },
  previewImg: { width: '100%', height: '100%' },
  ocrLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radii.md,
  },
  ocrLoadingText: { color: Palette.primary, fontWeight: '600', fontSize: 13 },
  noticeBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Palette.warningBg,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  noticeBody: { flex: 1 },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: Palette.warning },
  noticeText: { fontSize: 12, color: Palette.textPrimary, marginTop: 2, lineHeight: 17 },
  detectedWarranty: { fontSize: 12, fontWeight: '700', color: Palette.success, marginTop: 4 },
  toggleRaw: { fontSize: 12, color: Palette.primaryAccent, fontWeight: '700', marginTop: 6 },
  rawText: {
    marginTop: 8,
    padding: 8,
    backgroundColor: Palette.surface,
    borderRadius: Radii.sm,
    fontSize: 11,
    color: Palette.textSecondary,
  },
  fallbackBox: { backgroundColor: Palette.infoBg, borderRadius: Radii.md, padding: Spacing.md },
  fallbackText: { color: Palette.info, fontSize: 13, fontWeight: '500' },
  formTitle: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary, marginBottom: Spacing.md },
  candidateWrap: { marginBottom: Spacing.md },
  candidateLabel: { fontSize: 12, fontWeight: '600', color: Palette.textSecondary, marginBottom: 6 },
  candidateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  candidateChip: { backgroundColor: Palette.primaryLight },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surfaceMuted,
    borderRadius: Radii.md,
    paddingRight: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  verifyLabel: { flex: 1, fontSize: 13, color: Palette.textPrimary, fontWeight: '500' },
  input: { marginBottom: Spacing.md, backgroundColor: Palette.surface },
  outline: { borderRadius: Radii.md },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Palette.textSecondary, marginBottom: 6 },
  catRow: { gap: 8, paddingBottom: Spacing.md },
  catChip: { backgroundColor: Palette.background },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
  half: { flex: 1 },
  calcBanner: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  calcText: { color: Palette.primary, fontSize: 13 },
  calcBold: { fontWeight: '800' },
  saveBtn: { borderRadius: Radii.md },
  saveContent: { height: 48 },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraView: { flex: 1 },
  cameraOverlay: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF' },
  qrGuide: {
    position: 'absolute',
    top: 64,
    left: 24,
    right: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    padding: Spacing.md,
    borderRadius: Radii.md,
  },
  qrGuideText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
