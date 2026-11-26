import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button } from 'react-native-paper';
import { AppCard } from '../../components/ui/AppCard';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { extractErrorMessage, productsApi } from '../../services/api';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { QrProductIdentity } from '../../types';
import { formatReadableDate } from '../../utils/dateUtils';

export default function QrIdentityScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [identity, setIdentity] = useState<QrProductIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        const res = await productsApi.lookupByQr(decodeURIComponent(token));
        if (mounted) setIdentity(res);
      } catch (err) {
        if (mounted) setError(extractErrorMessage(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Palette.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'QR Product Identity' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {error ? <ErrorBanner message={error} /> : null}

        {identity ? (
          <>
            <AppCard>
              <View style={styles.topRow}>
                <View style={styles.iconBox}>
                  <MaterialCommunityIcons name="qrcode-scan" size={28} color={Palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{identity.productName}</Text>
                  <Text style={styles.sub}>
                    {identity.brand} • {identity.category}
                  </Text>
                </View>
                <StatusBadge status={identity.warrantyStatus} />
              </View>

              <View style={styles.kvGrid}>
                <Kv label="Model Number" value={identity.modelNumber} />
                <Kv label="Serial (Masked)" value={identity.maskedSerialNumber} />
                <Kv label="Purchase Date" value={formatReadableDate(identity.purchaseDate)} />
                <Kv
                  label="Warranty Expiry"
                  value={`${formatReadableDate(identity.warrantyEndDate)} (${identity.remainingDays}d)`}
                />
              </View>

              <View style={styles.secBox}>
                <MaterialCommunityIcons name="shield-lock-outline" size={16} color={Palette.primary} />
                <Text style={styles.secText}>
                  Privacy Protected: Private purchase invoices, prices, and owner contact info are
                  never exposed via QR identity.
                </Text>
              </View>

              <Button
                mode="contained"
                buttonColor={Palette.primary}
                onPress={() => router.push(`/products/${identity.id}`)}
                style={{ marginTop: Spacing.md, borderRadius: Radii.md }}
              >
                Open Full Product Lifecycle
              </Button>
            </AppCard>

            <AppCard>
              <Text style={styles.sectionTitle}>
                Recorded Repair History ({identity.repairs.length})
              </Text>
              {identity.repairs.length === 0 ? (
                <Text style={styles.muted}>No repairs recorded for this product.</Text>
              ) : (
                identity.repairs.map((r) => (
                  <View key={r._id} style={styles.repairRow}>
                    <View style={styles.repairTop}>
                      <Text style={styles.repairDate}>{formatReadableDate(r.repairDate)}</Text>
                      <StatusBadge status={r.repairStatus} />
                    </View>
                    <Text style={styles.repairProb}>{r.problemDescription}</Text>
                    <Text style={styles.muted}>{r.repairCenter}</Text>
                  </View>
                ))
              )}
            </AppCard>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvItem}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: Palette.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: Radii.md,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: Palette.textPrimary },
  sub: { fontSize: 13, color: Palette.textSecondary },
  kvGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.lg },
  kvItem: { width: '46%' },
  kvLabel: { fontSize: 11, color: Palette.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  kvVal: { fontSize: 14, color: Palette.textPrimary, fontWeight: '600', marginTop: 2 },
  secBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radii.md,
  },
  secText: { flex: 1, fontSize: 12, color: Palette.primary, lineHeight: 17 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary, marginBottom: Spacing.sm },
  muted: { fontSize: 13, color: Palette.textMuted },
  repairRow: {
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  repairTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  repairDate: { fontSize: 12, fontWeight: '700', color: Palette.primary },
  repairProb: { fontSize: 14, fontWeight: '600', color: Palette.textPrimary, marginTop: 2 },
});
