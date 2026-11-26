import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActivityIndicator, Button, ProgressBar, TextInput } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import { AppCard, EmptyState, ErrorBanner, OfflineBanner, StatusBadge } from '../../components/ui/Common';
import { CostBreakdownChart } from '../../components/ui/CostBreakdownChart';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';
import { extractErrorMessage, productsApi, repairsApi } from '../../services/api';
import {
  generateResalePacketPdf,
  generateSingleProductPdf,
  shareDocumentRecord,
  sharePdfFile,
} from '../../services/pdfService';
import { loadCachedSlice, saveCachedSlice } from '../../services/storage';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { Product } from '../../types';
import { formatCurrency, formatFileSize, formatReadableDate } from '../../utils/dateUtils';

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id;
  const { isOnline, queueMutation } = useOffline();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingResale, setExportingResale] = useState(false);
  const [regenQrLoading, setRegenQrLoading] = useState(false);
  const [offlineNote, setOfflineNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setError(null);
      if (!isOnline && userId) {
        const cached = await loadCachedSlice<Product>(userId, `product_${id}`);
        if (cached) {
          setProduct(cached);
          setOfflineNote(cached.additionalNotes || '');
          return;
        }
      }
      const detail = await productsApi.getById(id);
      setProduct(detail);
      setOfflineNote(detail.additionalNotes || '');
      if (userId) {
        await saveCachedSlice(userId, `product_${id}`, detail);
      }
    } catch (err) {
      if (userId) {
        const cached = await loadCachedSlice<Product>(userId, `product_${id}`);
        if (cached) {
          setProduct(cached);
          setOfflineNote(cached.additionalNotes || '');
          return;
        }
      }
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, isOnline, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadProduct();
    }, [loadProduct])
  );

  const handleSaveMaintenanceNote = async () => {
    if (!product) return;
    setSavingNote(true);
    try {
      if (isOnline) {
        await productsApi.update(product.id, {
          additionalNotes: offlineNote,
          version: product.version,
        });
        await loadProduct();
        Alert.alert('Saved', 'Notes updated.');
      } else {
        await queueMutation({
          type: 'UPDATE_PRODUCT_NOTE',
          targetId: product.id,
          payload: { additionalNotes: offlineNote },
          baseVersion: product.version,
        });
        setProduct({ ...product, additionalNotes: offlineNote });
        Alert.alert('Queued Offline', 'Note saved locally and will sync automatically once online.');
      }
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err));
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteProduct = () => {
    if (!product) return;
    Alert.alert(
      'Delete Product',
      `Delete "${product.productName}" along with its repair history, AMC, maintenance, and linked documents?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await productsApi.remove(product.id);
              router.replace('/(tabs)/products');
            } catch (err) {
              Alert.alert('Delete Failed', extractErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  const handleDeleteRepair = (repairId: string) => {
    Alert.alert('Delete Repair Record', 'Remove this repair entry from the product timeline?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await repairsApi.remove(repairId);
            await loadProduct();
          } catch (err) {
            Alert.alert('Error', extractErrorMessage(err));
          }
        },
      },
    ]);
  };

  const handleExportPdf = async () => {
    if (!product) return;
    setExportingPdf(true);
    try {
      const pdfUri = await generateSingleProductPdf({
        product,
        repairs: product.repairs || [],
        documents: product.documents || [],
      });
      await sharePdfFile(pdfUri, `${product.productName} Warranty Report`);
    } catch (err) {
      Alert.alert('PDF Export Error', extractErrorMessage(err));
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportResalePacket = async () => {
    if (!product) return;
    setExportingResale(true);
    try {
      const summary = await productsApi.getResaleSummary(product.id);
      const pdfUri = await generateResalePacketPdf(summary);
      await sharePdfFile(pdfUri, `${product.productName} Resale History Packet`);
    } catch (err) {
      Alert.alert('Resale PDF Error', extractErrorMessage(err));
    } finally {
      setExportingResale(false);
    }
  };

  const handleRegenerateQr = () => {
    if (!product) return;
    Alert.alert(
      'Regenerate QR Identity',
      'Regenerating invalidates the previous QR code token. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: async () => {
            setRegenQrLoading(true);
            try {
              const res = await productsApi.regenerateQr(product.id);
              setProduct({ ...product, qrToken: res.qrToken, qrGeneratedAt: res.qrGeneratedAt });
            } catch (err) {
              Alert.alert('Error', extractErrorMessage(err));
            } finally {
              setRegenQrLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading && !product) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Palette.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerPad}>
        {error ? <ErrorBanner message={error} onRetry={loadProduct} /> : null}
      </View>
    );
  }

  const { warrantyMetrics, claimReadiness, healthScore, costAnalysis } = product;
  const repairs = product.repairs || [];
  const documents = product.documents || [];
  const lifecycle = product.lifecycle || [];
  const hideAmounts = Boolean(user?.privacyHideAmounts);
  const isOwner = product.isOwner !== false;

  const scoreColor =
    claimReadiness.score >= 80
      ? Palette.success
      : claimReadiness.score >= 50
        ? Palette.warning
        : Palette.danger;

  const healthColor =
    (healthScore?.score || 0) >= 80
      ? Palette.success
      : (healthScore?.score || 0) >= 60
        ? Palette.warning
        : Palette.danger;

  return (
    <>
      <Stack.Screen options={{ title: product.productName }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <OfflineBanner />
        {error ? <ErrorBanner message={error} onRetry={loadProduct} /> : null}

        {/* Product Header Card */}
        <AppCard>
          <View style={styles.headerRow}>
            {product.productImageUrl ? (
              <Image source={{ uri: product.productImageUrl }} style={styles.heroImg} />
            ) : (
              <View style={styles.heroPlaceholder}>
                <MaterialCommunityIcons name="devices" size={32} color={Palette.primary} />
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.productTitle}>{product.productName}</Text>
              <Text style={styles.brandText}>
                {product.brand} • {product.category}
              </Text>
              <View style={styles.badgeRow}>
                <StatusBadge status={warrantyMetrics.warrantyStatus} />
                {product.lifecycleStatus && product.lifecycleStatus !== 'Active' ? (
                  <StatusBadge status={product.lifecycleStatus} />
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.actionRow}>
            {isOwner ? (
              <Button
                mode="outlined"
                icon="pencil-outline"
                onPress={() =>
                  router.push({ pathname: '/products/form', params: { id: product.id } })
                }
                style={styles.actionBtn}
              >
                Edit
              </Button>
            ) : null}
            <Button
              mode="contained"
              icon="file-pdf-box"
              loading={exportingPdf}
              disabled={exportingPdf}
              buttonColor={Palette.primary}
              onPress={handleExportPdf}
              style={styles.actionBtn}
            >
              PDF Report
            </Button>
            {isOwner ? (
              <Button
                mode="outlined"
                icon="delete-outline"
                textColor={Palette.danger}
                onPress={handleDeleteProduct}
              >
                Delete
              </Button>
            ) : null}
          </View>

          {isOwner ? (
            <View style={styles.quickLinkBar}>
              <Button
                mode="text"
                compact
                icon="tools"
                onPress={() =>
                  router.push({ pathname: '/maintenance/form', params: { productId: product.id } })
                }
              >
                + Maintenance
              </Button>
              <Button
                mode="text"
                compact
                icon="file-certificate-outline"
                onPress={() =>
                  router.push({ pathname: '/amc/form', params: { productId: product.id } })
                }
              >
                + AMC
              </Button>
              <Button
                mode="text"
                compact
                icon="clipboard-check-outline"
                onPress={() =>
                  router.push({ pathname: '/claims/form', params: { productId: product.id } })
                }
              >
                + Claim
              </Button>
            </View>
          ) : null}
        </AppCard>

        {/* Standard & Extended Warranty */}
        <AppCard>
          <View style={styles.sectionTop}>
            <Text style={styles.cardTitle}>Warranty Coverage</Text>
            {warrantyMetrics.activeTier ? (
              <Text style={styles.tierLabel}>Active Tier: {warrantyMetrics.activeTier}</Text>
            ) : null}
          </View>
          <View style={styles.daysRow}>
            <Text style={styles.daysBig}>{warrantyMetrics.remainingDays}</Text>
            <Text style={styles.daysSub}>days remaining (combined coverage)</Text>
          </View>
          <ProgressBar
            progress={warrantyMetrics.progressPercent / 100}
            color={
              warrantyMetrics.warrantyStatus === 'Expired'
                ? Palette.danger
                : warrantyMetrics.warrantyStatus === 'Expiring Soon'
                  ? Palette.warning
                  : Palette.primary
            }
            style={styles.progressBar}
          />
          <View style={styles.kvGrid}>
            <KvItem label="Standard Start" value={formatReadableDate(product.warrantyStartDate)} />
            <KvItem label="Standard Expiry" value={formatReadableDate(product.warrantyEndDate)} />
            <KvItem label="Duration" value={`${product.warrantyDurationMonths} months`} />
            <KvItem
              label="Transferable"
              value={product.warrantyTransferable ? 'Yes' : 'No / Unknown'}
            />
          </View>

          {warrantyMetrics.extendedMetrics ? (
            <View style={styles.extBox}>
              <Text style={styles.extTitle}>
                Extended Warranty: {product.extendedWarrantyProvider || 'Protection Plan'}
              </Text>
              <Text style={styles.extMeta}>
                {formatReadableDate(warrantyMetrics.extendedMetrics.startDate)} →{' '}
                {formatReadableDate(warrantyMetrics.extendedMetrics.endDate)} (
                {warrantyMetrics.extendedMetrics.warrantyStatus} •{' '}
                {warrantyMetrics.extendedMetrics.remainingDays}d left)
              </Text>
            </View>
          ) : null}
        </AppCard>

        {/* Product Health Score (Informational) */}
        {healthScore ? (
          <AppCard>
            <View style={styles.readinessHeader}>
              <View>
                <Text style={styles.cardTitle}>Product Health Score</Text>
                <Text style={styles.readinessLevel}>Grade: {healthScore.grade}</Text>
              </View>
              <View style={[styles.scoreCircle, { borderColor: healthColor }]}>
                <Text style={[styles.scoreNumber, { color: healthColor }]}>
                  {healthScore.score}
                </Text>
                <Text style={styles.scoreDenom}>/100</Text>
              </View>
            </View>

            <View style={styles.checklist}>
              {healthScore.breakdown.map((b) => (
                <View key={b.key} style={styles.healthRow}>
                  <View style={styles.healthTop}>
                    <Text style={styles.checkLabel}>{b.label}</Text>
                    <Text style={styles.healthScoreVal}>
                      {b.score}/{b.maxScore}
                    </Text>
                  </View>
                  <Text style={styles.checkRec}>{b.summary}</Text>
                </View>
              ))}
            </View>

            {healthScore.suggestions.length > 0 ? (
              <View style={styles.sugBox}>
                <Text style={styles.sugTitle}>Suggestions</Text>
                {healthScore.suggestions.map((s, i) => (
                  <Text key={i} style={styles.sugText}>
                    • {s}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.disclaimerBox}>
              <MaterialCommunityIcons name="information-outline" size={16} color={Palette.textSecondary} />
              <Text style={styles.disclaimerText}>{healthScore.disclaimer}</Text>
            </View>
          </AppCard>
        ) : null}

        {/* Warranty Cost Analyzer */}
        {costAnalysis ? (
          <AppCard>
            <Text style={styles.cardTitle}>Ownership Cost Analyzer</Text>
            <View style={styles.costHeroRow}>
              <View style={styles.costHeroItem}>
                <Text style={styles.kvLabel}>Total Ownership Cost</Text>
                <Text style={styles.costHeroVal}>
                  {formatCurrency(costAnalysis.totalOwnershipCost, costAnalysis.currency, hideAmounts)}
                </Text>
              </View>
              <View style={styles.costHeroItem}>
                <Text style={styles.kvLabel}>Avg. Yearly Cost</Text>
                <Text style={styles.costHeroVal}>
                  {formatCurrency(
                    costAnalysis.averageYearlyOwnershipCost,
                    costAnalysis.currency,
                    hideAmounts
                  )}
                  /yr
                </Text>
              </View>
            </View>
            <CostBreakdownChart analysis={costAnalysis} hideAmounts={hideAmounts} />
          </AppCard>
        ) : null}

        {/* Resale Assistant */}
        <AppCard>
          <Text style={styles.cardTitle}>Product Resale Assistant</Text>
          <Text style={styles.mutedText}>
            Generate a verified resale packet containing purchase age, remaining warranty, repair
            history, maintenance logs, and attached invoice records (does not certify physical
            condition).
          </Text>
          <Button
            mode="contained-tonal"
            icon="tag-outline"
            loading={exportingResale}
            disabled={exportingResale}
            onPress={handleExportResalePacket}
            style={{ marginTop: Spacing.md, borderRadius: Radii.md }}
          >
            Generate Resale History PDF
          </Button>
        </AppCard>

        {/* QR Product Identity */}
        {product.qrToken ? (
          <AppCard>
            <View style={styles.sectionTop}>
              <Text style={styles.cardTitle}>QR Product Identity</Text>
              {isOwner ? (
                <Button mode="text" compact loading={regenQrLoading} onPress={handleRegenerateQr}>
                  Regenerate
                </Button>
              ) : null}
            </View>
            <View style={styles.qrRow}>
              <View style={styles.qrBox}>
                <QRCode value={`warrantywise://qr/${product.qrToken}`} size={110} color={Palette.primary} />
              </View>
              <View style={styles.qrInfo}>
                <Text style={styles.qrTokenText}>Token: {product.qrToken}</Text>
                <Text style={styles.mutedText}>
                  Scanning inside WarrantyWise shows verified identity &amp; repair history while
                  hiding private invoices and PII.
                </Text>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => router.push(`/qr/${encodeURIComponent(product.qrToken!)}`)}
                  style={{ marginTop: Spacing.sm, alignSelf: 'flex-start' }}
                >
                  Preview QR Card
                </Button>
              </View>
            </View>
          </AppCard>
        ) : null}

        {/* Warranty Claim Readiness Checker */}
        <AppCard>
          <View style={styles.readinessHeader}>
            <View>
              <Text style={styles.cardTitle}>Warranty Claim Readiness</Text>
              <Text style={styles.readinessLevel}>Status: {claimReadiness.level}</Text>
            </View>
            <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
              <Text style={[styles.scoreNumber, { color: scoreColor }]}>
                {claimReadiness.score}
              </Text>
              <Text style={styles.scoreDenom}>/100</Text>
            </View>
          </View>

          <View style={styles.checklist}>
            {claimReadiness.checklist.map((item) => (
              <View key={item.key} style={styles.checkRow}>
                <MaterialCommunityIcons
                  name={item.passed ? 'check-circle' : 'alert-circle-outline'}
                  size={20}
                  color={item.passed ? Palette.success : Palette.warning}
                />
                <View style={styles.checkBody}>
                  <Text style={styles.checkLabel}>
                    {item.label} ({item.earned}/{item.weight} pts)
                  </Text>
                  {item.recommendation ? (
                    <Text style={styles.checkRec}>{item.recommendation}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.disclaimerBox}>
            <MaterialCommunityIcons name="information-outline" size={16} color={Palette.textSecondary} />
            <Text style={styles.disclaimerText}>{claimReadiness.disclaimer}</Text>
          </View>
        </AppCard>

        {/* Visual Product Lifecycle Timeline */}
        <AppCard>
          <Text style={styles.cardTitle}>Product Lifecycle Timeline</Text>
          {lifecycle.length === 0 ? (
            <Text style={styles.mutedText}>No lifecycle events recorded yet.</Text>
          ) : (
            <View style={styles.timeline}>
              {lifecycle.map((ev) => (
                <View key={ev.id} style={styles.timelineItem}>
                  <View style={styles.timelineRail}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineLine} />
                  </View>
                  <View style={styles.timelineCard}>
                    <View style={styles.timelineHeader}>
                      <Text style={styles.timelineDate}>{formatReadableDate(ev.date)}</Text>
                      {ev.badge ? <StatusBadge status={ev.badge} /> : null}
                    </View>
                    <Text style={styles.timelineProblem}>{ev.title}</Text>
                    {ev.description ? (
                      <Text style={styles.timelineCenter}>{ev.description}</Text>
                    ) : null}
                    {ev.amount !== undefined && ev.amount > 0 ? (
                      <Text style={styles.timelineAmount}>
                        Amount: {formatCurrency(ev.amount, product.currency, hideAmounts)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </AppCard>

        {/* Repair History */}
        <AppCard>
          <View style={styles.sectionTop}>
            <Text style={styles.cardTitle}>Repair History ({repairs.length})</Text>
            {isOwner ? (
              <Button
                mode="contained-tonal"
                compact
                icon="plus"
                onPress={() =>
                  router.push({ pathname: '/repairs/form', params: { productId: product.id } })
                }
              >
                Add Repair
              </Button>
            ) : null}
          </View>

          {repairs.length === 0 ? (
            <EmptyState
              icon="wrench-outline"
              title="No repair records"
              subtitle="Record service visits, costs, and repair receipts here."
            />
          ) : (
            <View style={styles.timeline}>
              {repairs.map((repair) => (
                <View key={repair._id} style={styles.timelineCard}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineDate}>{formatReadableDate(repair.repairDate)}</Text>
                    <StatusBadge status={repair.repairStatus} />
                  </View>
                  <Text style={styles.timelineProblem}>{repair.problemDescription}</Text>
                  <Text style={styles.timelineCenter}>
                    Center: {repair.repairCenter} •{' '}
                    {formatCurrency(repair.repairCost, product.currency, hideAmounts)}
                  </Text>
                  {isOwner ? (
                    <View style={styles.repairActions}>
                      <Button
                        mode="text"
                        compact
                        onPress={() =>
                          router.push({
                            pathname: '/repairs/form',
                            params: { productId: product.id, repairId: repair._id },
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        mode="text"
                        compact
                        textColor={Palette.danger}
                        onPress={() => handleDeleteRepair(repair._id)}
                      >
                        Delete
                      </Button>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </AppCard>

        {/* Offline-Ready Maintenance / Product Notes */}
        {isOwner ? (
          <AppCard>
            <Text style={styles.cardTitle}>Maintenance &amp; Ownership Notes</Text>
            <Text style={styles.mutedText}>
              Editable offline—pending updates sync automatically when connectivity returns.
            </Text>
            <TextInput
              mode="outlined"
              value={offlineNote}
              onChangeText={setOfflineNote}
              multiline
              numberOfLines={3}
              placeholder="Add service notes, filter part numbers, or observations..."
              style={styles.noteInput}
              outlineStyle={styles.outline}
            />
            <Button
              mode="outlined"
              loading={savingNote}
              disabled={savingNote}
              onPress={handleSaveMaintenanceNote}
              style={{ borderRadius: Radii.md }}
            >
              {isOnline ? 'Save Note' : 'Save Note Offline'}
            </Button>
          </AppCard>
        ) : null}

        {/* Associated Documents */}
        <AppCard>
          <View style={styles.sectionTop}>
            <Text style={styles.cardTitle}>Associated Documents ({documents.length})</Text>
            <Button mode="text" compact onPress={() => router.push('/(tabs)/vault')}>
              Open Vault
            </Button>
          </View>
          {!product.canViewDocuments && !isOwner ? (
            <Text style={styles.mutedText}>
              Document access is restricted by the Family Vault owner.
            </Text>
          ) : documents.length === 0 ? (
            <Text style={styles.mutedText}>No documents linked to this product yet.</Text>
          ) : (
            documents.map((doc) => (
              <Pressable
                key={doc._id}
                onPress={() =>
                  shareDocumentRecord(doc).catch((e) =>
                    Alert.alert('Document Error', extractErrorMessage(e))
                  )
                }
                style={styles.docRow}
              >
                <MaterialCommunityIcons
                  name={doc.mimeType.includes('pdf') ? 'file-pdf-box' : 'file-image-outline'}
                  size={24}
                  color={Palette.primary}
                />
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle}>{doc.title}</Text>
                  <Text style={styles.docMeta}>
                    {doc.type} • {formatFileSize(doc.fileSize)}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="share-variant-outline"
                  size={20}
                  color={Palette.primaryAccent}
                />
              </Pressable>
            ))
          )}
        </AppCard>
      </ScrollView>
    </>
  );
}

function KvItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvItem}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerPad: { flex: 1, padding: Spacing.lg },
  container: { flex: 1, backgroundColor: Palette.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  headerRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  heroImg: { width: 68, height: 68, borderRadius: Radii.md, backgroundColor: Palette.surfaceMuted },
  heroPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: Radii.md,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1, gap: 4 },
  productTitle: { fontSize: 19, fontWeight: '800', color: Palette.textPrimary },
  brandText: { fontSize: 13, color: Palette.textSecondary },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, flexWrap: 'wrap' },
  actionBtn: { flex: 1 },
  quickLinkBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary, marginBottom: Spacing.xs },
  tierLabel: { fontSize: 12, fontWeight: '700', color: Palette.primaryAccent },
  daysRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: Spacing.sm },
  daysBig: { fontSize: 28, fontWeight: '800', color: Palette.primary },
  daysSub: { fontSize: 13, color: Palette.textSecondary },
  progressBar: { height: 8, borderRadius: 4, marginBottom: Spacing.md },
  kvGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  kvItem: { width: '46%' },
  kvLabel: { fontSize: 11, color: Palette.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  kvValue: { fontSize: 14, color: Palette.textPrimary, fontWeight: '600', marginTop: 2 },
  extBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radii.md,
  },
  extTitle: { fontSize: 13, fontWeight: '700', color: Palette.primary },
  extMeta: { fontSize: 12, color: Palette.textPrimary, marginTop: 2 },
  readinessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  readinessLevel: { fontSize: 13, fontWeight: '600', color: Palette.textSecondary },
  scoreCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: { fontSize: 20, fontWeight: '800' },
  scoreDenom: { fontSize: 10, color: Palette.textMuted },
  checklist: { gap: Spacing.md },
  checkRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkBody: { flex: 1 },
  checkLabel: { fontSize: 14, fontWeight: '600', color: Palette.textPrimary },
  checkRec: { fontSize: 12, color: Palette.textSecondary, marginTop: 2, lineHeight: 17 },
  healthRow: { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: Palette.border },
  healthTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthScoreVal: { fontSize: 13, fontWeight: '700', color: Palette.primary },
  sugBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radii.md,
  },
  sugTitle: { fontSize: 12, fontWeight: '700', color: Palette.primary, marginBottom: 4 },
  sugText: { fontSize: 12, color: Palette.textPrimary, lineHeight: 18 },
  disclaimerBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Palette.surfaceMuted,
    borderRadius: Radii.md,
  },
  disclaimerText: { flex: 1, fontSize: 11, color: Palette.textSecondary, lineHeight: 16 },
  costHeroRow: { flexDirection: 'row', gap: Spacing.md, marginVertical: Spacing.sm },
  costHeroItem: {
    flex: 1,
    backgroundColor: Palette.surfaceMuted,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  costHeroVal: { fontSize: 18, fontWeight: '800', color: Palette.primary, marginTop: 4 },
  qrRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  qrBox: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  qrInfo: { flex: 1 },
  qrTokenText: { fontSize: 12, fontWeight: '700', color: Palette.primary, marginBottom: 4 },
  sectionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  timeline: { gap: Spacing.md, marginTop: Spacing.sm },
  timelineItem: { flexDirection: 'row', gap: Spacing.sm },
  timelineRail: { alignItems: 'center', width: 16 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Palette.primary, marginTop: 4 },
  timelineLine: { flex: 1, width: 2, backgroundColor: Palette.border, marginTop: 4 },
  timelineCard: {
    flex: 1,
    backgroundColor: Palette.surfaceMuted,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineDate: { fontSize: 12, fontWeight: '700', color: Palette.primary },
  timelineProblem: { fontSize: 14, fontWeight: '700', color: Palette.textPrimary, marginBottom: 3 },
  timelineCenter: { fontSize: 12, color: Palette.textSecondary },
  timelineAmount: { fontSize: 12, fontWeight: '700', color: Palette.primary, marginTop: 4 },
  repairActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  mutedText: { fontSize: 13, color: Palette.textMuted, lineHeight: 19 },
  noteInput: { marginVertical: Spacing.sm, backgroundColor: Palette.surface },
  outline: { borderRadius: Radii.md },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: '600', color: Palette.textPrimary },
  docMeta: { fontSize: 12, color: Palette.textMuted },
});
