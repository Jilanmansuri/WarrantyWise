import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Palette, Radii, Spacing } from '../../theme/tokens';
import { CostAnalysisResult } from '../../types';
import { formatCurrency } from '../../utils/dateUtils';

interface CostBreakdownChartProps {
  analysis: CostAnalysisResult;
  hideAmounts?: boolean;
}

export function CostBreakdownChart({ analysis, hideAmounts = false }: CostBreakdownChartProps) {
  const nonZero = analysis.breakdown.filter((b) => b.amount > 0);
  const total = analysis.totalOwnershipCost || 1;
  const barWidth = 300;

  const segments = nonZero.reduce<
    { key: string; x: number; width: number; color: string }[]
  >((acc, item) => {
    const prev = acc[acc.length - 1];
    const x = prev ? prev.x + prev.width : 0;
    const width = Math.max(4, (item.amount / total) * barWidth);
    acc.push({ key: item.key, x, width, color: item.color });
    return acc;
  }, []);

  return (
    <View style={styles.container}>
      {segments.length > 0 ? (
        <View style={styles.svgWrap}>
          <Svg width="100%" height={18} viewBox={`0 0 ${barWidth} 18`}>
            {segments.map((seg) => (
              <Rect
                key={seg.key}
                x={seg.x}
                y={0}
                width={seg.width}
                height={18}
                rx={3}
                fill={seg.color}
              />
            ))}
          </Svg>
        </View>
      ) : (
        <View style={styles.emptyBar} />
      )}

      <View style={styles.legend}>
        {analysis.breakdown.map((item) => (
          <View key={item.key} style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <View style={[styles.swatch, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
            <Text style={styles.legendVal}>
              {formatCurrency(item.amount, analysis.currency, hideAmounts)} ({item.percent}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: Spacing.sm },
  svgWrap: {
    borderRadius: Radii.sm,
    overflow: 'hidden',
    backgroundColor: Palette.surfaceMuted,
    marginBottom: Spacing.md,
  },
  emptyBar: {
    height: 14,
    borderRadius: Radii.sm,
    backgroundColor: Palette.border,
    marginBottom: Spacing.md,
  },
  legend: { gap: 8 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { fontSize: 13, color: Palette.textSecondary, fontWeight: '500' },
  legendVal: { fontSize: 13, color: Palette.textPrimary, fontWeight: '700' },
});
