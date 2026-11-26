import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Chip, Searchbar, TextInput } from 'react-native-paper';
import { AppCard, EmptyState, ErrorBanner, OfflineBanner } from '../../components/ui/Common';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';
import {
  FileUploadAsset,
  documentsApi,
  extractErrorMessage,
  productsApi,
} from '../../services/api';
import { downloadDocumentToDevice, shareDocumentRecord } from '../../services/pdfService';
import { loadCachedSlice, saveCachedSlice } from '../../services/storage';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { DOCUMENT_TYPES, DocumentRecord, DocumentType, Product } from '../../types';
import { formatFileSize, formatReadableDate } from '../../utils/dateUtils';

export default function DocumentVaultScreen() {
  const { user } = useAuth();
  const userId = user?.id;
  const { isOnline } = useOffline();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filterType, setFilterType] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadAsset, setUploadAsset] = useState<FileUploadAsset | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState<DocumentType>('Purchase Invoice');
  const [uploadProductId, setUploadProductId] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadVault = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        setError(null);
        const filterCached = (list: DocumentRecord[]) => {
          const q = search.trim().toLowerCase();
          return list.filter((d) => {
            if (filterType !== 'All' && d.type !== filterType) return false;
            if (q && !d.title.toLowerCase().includes(q) && !d.fileName.toLowerCase().includes(q)) {
              return false;
            }
            return true;
          });
        };

        if (!isOnline && userId) {
          const cachedDocs = await loadCachedSlice<DocumentRecord[]>(userId, 'documents');
          if (cachedDocs) {
            setDocuments(filterCached(cachedDocs));
            return;
          }
        }
        const [docs, prods] = await Promise.all([
          documentsApi.list({
            type: filterType !== 'All' ? filterType : undefined,
            search: search.trim() || undefined,
          }),
          productsApi.list({ sort: 'recent' }),
        ]);
        setDocuments(docs);
        setProducts(prods);
        if (userId && filterType === 'All' && !search.trim()) {
          await saveCachedSlice(userId, 'documents', docs);
        }
      } catch (err) {
        if (userId) {
          const cachedDocs = await loadCachedSlice<DocumentRecord[]>(userId, 'documents');
          if (cachedDocs) {
            const q = search.trim().toLowerCase();
            setDocuments(
              cachedDocs.filter(
                (d) =>
                  (filterType === 'All' || d.type === filterType) &&
                  (!q || d.title.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q))
              )
            );
            return;
          }
        }
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filterType, isOnline, search, userId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadVault(false);
    }, [loadVault])
  );

  const handlePickDocument = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!picked.canceled && picked.assets[0]) {
      const a = picked.assets[0];
      setUploadAsset({
        uri: a.uri,
        name: a.name || `doc-${Date.now()}`,
        mimeType: a.mimeType || 'application/octet-stream',
      });
      if (!uploadTitle) setUploadTitle(a.name?.replace(/\.[^/.]+$/, '') || 'Product Document');
      setUploadModalOpen(true);
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadAsset || !uploadTitle.trim()) {
      Alert.alert('Missing Details', 'Please choose a file and enter a document title.');
      return;
    }
    setUploading(true);
    try {
      await documentsApi.upload({
        file: uploadAsset,
        title: uploadTitle.trim(),
        type: uploadType,
        productId: uploadProductId || undefined,
      });
      setUploadModalOpen(false);
      setUploadAsset(null);
      setUploadTitle('');
      setUploadProductId('');
      await loadVault(false);
    } catch (err) {
      Alert.alert('Upload Failed', extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async (doc: DocumentRecord) => {
    setPreviewDoc(doc);
    setPreviewUri(null);
    if (doc.mimeType.startsWith('image/')) {
      setPreviewLoading(true);
      try {
        const localUri = await downloadDocumentToDevice(doc);
        setPreviewUri(localUri);
      } catch (err) {
        Alert.alert('Preview Failed', extractErrorMessage(err));
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  const handleDownload = async (doc: DocumentRecord) => {
    try {
      await downloadDocumentToDevice(doc);
      Alert.alert('Saved', `${doc.fileName} downloaded. Tap Share to open or save externally.`);
    } catch (err) {
      Alert.alert('Download Failed', extractErrorMessage(err));
    }
  };

  const handleShare = async (doc: DocumentRecord) => {
    try {
      await shareDocumentRecord(doc);
    } catch (err) {
      Alert.alert('Share Failed', extractErrorMessage(err));
    }
  };

  const handleDelete = (doc: DocumentRecord) => {
    Alert.alert('Delete Document', `Delete "${doc.title}" permanently from your vault?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await documentsApi.remove(doc._id);
            await loadVault(false);
          } catch (err) {
            Alert.alert('Error', extractErrorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerPanel}>
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <OfflineBanner />
        </View>
        <View style={styles.searchRow}>
          <Searchbar
            placeholder="Search invoices, certificates..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            elevation={0}
          />
          <Pressable onPress={handlePickDocument} style={styles.uploadBtn}>
            <MaterialCommunityIcons name="file-plus-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {['All', ...DOCUMENT_TYPES].map((t) => (
            <Chip
              key={t}
              selected={filterType === t}
              onPress={() => setFilterType(t)}
              style={[styles.chip, filterType === t && styles.chipSelected]}
              textStyle={[styles.chipText, filterType === t && styles.chipTextSelected]}
            >
              {t}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.errPad}>
          <ErrorBanner message={error} onRetry={() => void loadVault(false)} />
        </View>
      ) : null}

      {loading && documents.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadVault(true)}
              tintColor={Palette.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="folder-lock-outline"
              title="Your Document Vault is empty"
              subtitle="Store purchase invoices, warranty certificates, and repair receipts safely in one place."
              actionLabel="Upload Document"
              onAction={handlePickDocument}
            />
          }
          renderItem={({ item }) => {
            const productObj =
              typeof item.productId === 'object' && item.productId ? item.productId : null;
            return (
              <AppCard style={styles.docCard}>
                <View style={styles.docHeader}>
                  <View style={styles.docIconBox}>
                    <MaterialCommunityIcons
                      name={item.mimeType.includes('pdf') ? 'file-pdf-box' : 'file-image-outline'}
                      size={26}
                      color={Palette.primary}
                    />
                  </View>
                  <View style={styles.docInfo}>
                    <Text style={styles.docTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.docMeta}>
                      {item.type} • {formatFileSize(item.fileSize)} •{' '}
                      {formatReadableDate(item.createdAt)}
                    </Text>
                    {productObj ? (
                      <Text style={styles.linkedProd}>
                        Product: {productObj.brand} {productObj.productName}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.docActions}>
                  <Button
                    mode="text"
                    compact
                    icon="eye-outline"
                    onPress={() => void handlePreview(item)}
                  >
                    Preview
                  </Button>
                  <Button
                    mode="text"
                    compact
                    icon="download-outline"
                    onPress={() => void handleDownload(item)}
                  >
                    Download
                  </Button>
                  <Button
                    mode="text"
                    compact
                    icon="share-variant-outline"
                    onPress={() => void handleShare(item)}
                  >
                    Share
                  </Button>
                  <Button
                    mode="text"
                    compact
                    textColor={Palette.danger}
                    onPress={() => handleDelete(item)}
                  >
                    Delete
                  </Button>
                </View>
              </AppCard>
            );
          }}
        />
      )}

      {/* Upload Metadata Modal */}
      <Modal visible={uploadModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Upload to Document Vault</Text>
            <Text style={styles.modalSub}>{uploadAsset?.name}</Text>

            <TextInput
              mode="outlined"
              label="Document Title *"
              value={uploadTitle}
              onChangeText={setUploadTitle}
              style={styles.modalInput}
              outlineStyle={styles.outline}
            />

            <Text style={styles.label}>Document Type</Text>
            <View style={styles.typeWrap}>
              {DOCUMENT_TYPES.map((t) => (
                <Chip
                  key={t}
                  selected={uploadType === t}
                  onPress={() => setUploadType(t)}
                  style={styles.chip}
                >
                  {t}
                </Chip>
              ))}
            </View>

            <Text style={styles.label}>Associate with Product (Optional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.prodChips}
            >
              <Chip
                selected={uploadProductId === ''}
                onPress={() => setUploadProductId('')}
                style={styles.chip}
              >
                None
              </Chip>
              {products.map((p) => (
                <Chip
                  key={p.id}
                  selected={uploadProductId === p.id}
                  onPress={() => setUploadProductId(p.id)}
                  style={styles.chip}
                >
                  {p.brand} {p.productName}
                </Chip>
              ))}
            </ScrollView>

            <View style={styles.modalBtns}>
              <Button mode="text" onPress={() => setUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button
                mode="contained"
                loading={uploading}
                disabled={uploading}
                buttonColor={Palette.primary}
                onPress={handleUploadSubmit}
              >
                Upload
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal visible={Boolean(previewDoc)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.previewCard}>
            <Text style={styles.modalTitle}>{previewDoc?.title}</Text>
            <Text style={styles.modalSub}>{previewDoc?.fileName}</Text>

            {previewLoading ? (
              <ActivityIndicator style={{ marginVertical: 40 }} color={Palette.primary} />
            ) : previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.previewImg} resizeMode="contain" />
            ) : (
              <View style={styles.pdfNotice}>
                <MaterialCommunityIcons name="file-pdf-box" size={48} color={Palette.primary} />
                <Text style={styles.pdfNoticeText}>
                  PDF preview opens using your device&apos;s document viewer via Share / Open.
                </Text>
              </View>
            )}

            <View style={styles.modalBtns}>
              <Button mode="text" onPress={() => setPreviewDoc(null)}>
                Close
              </Button>
              {previewDoc ? (
                <Button
                  mode="contained"
                  buttonColor={Palette.primary}
                  onPress={() => void handleShare(previewDoc)}
                >
                  Open / Share
                </Button>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.background },
  headerPanel: {
    backgroundColor: Palette.surface,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchBar: { flex: 1, backgroundColor: Palette.background, borderRadius: Radii.md, height: 46 },
  searchInput: { fontSize: 14, minHeight: 0 },
  uploadBtn: {
    width: 46,
    height: 46,
    borderRadius: Radii.md,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: { paddingHorizontal: Spacing.lg, gap: 8, paddingVertical: 4 },
  chip: { backgroundColor: Palette.background, borderRadius: Radii.pill },
  chipSelected: { backgroundColor: Palette.primaryLight },
  chipText: { fontSize: 12, color: Palette.textSecondary },
  chipTextSelected: { color: Palette.primary, fontWeight: '700' },
  errPad: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  docCard: { marginBottom: Spacing.md },
  docHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  docIconBox: {
    width: 46,
    height: 46,
    borderRadius: Radii.md,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: '700', color: Palette.textPrimary },
  docMeta: { fontSize: 12, color: Palette.textSecondary, marginTop: 2 },
  linkedProd: { fontSize: 12, color: Palette.primaryAccent, fontWeight: '600', marginTop: 2 },
  docActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
  },
  previewCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Palette.textPrimary },
  modalSub: { fontSize: 12, color: Palette.textMuted, marginBottom: Spacing.md },
  modalInput: { marginBottom: Spacing.md, backgroundColor: Palette.surface },
  outline: { borderRadius: Radii.md },
  label: { fontSize: 12, fontWeight: '600', color: Palette.textSecondary, marginBottom: 6 },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
  prodChips: { gap: 6, paddingBottom: Spacing.md },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.md },
  previewImg: { width: '100%', height: 280, borderRadius: Radii.md, backgroundColor: Palette.surfaceMuted },
  pdfNotice: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  pdfNoticeText: { fontSize: 13, color: Palette.textSecondary, textAlign: 'center' },
});
