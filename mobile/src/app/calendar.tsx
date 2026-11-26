import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { AppCard, EmptyState, ErrorBanner } from '../components/ui/Common';
import { calendarApi, extractErrorMessage } from '../services/api';
import { Palette, Radii, Spacing } from '../theme/tokens';
import { CalendarEventItem } from '../types';
import { formatReadableDate } from '../utils/dateUtils';

const EVENT_COLORS: Record<CalendarEventItem['type'], string> = {
  warranty_expiry: '#0F295C',
  extended_expiry: '#1E40AF',
  maintenance: '#D97706',
  amc_expiry: '#0D9488',
  amc_visit: '#0F766E',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

export default function CalendarScreen() {
  const router = useRouter();
  const today = useMemo(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }, []);

  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [cursorDate, setCursorDate] = useState<Date>(today);
  const [selectedDate, setSelectedDate] = useState<string>(toYmd(today));
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const list = await calendarApi.getEvents();
      setEvents(list);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
    }, [loadEvents])
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const ev of events) {
      const existing = map.get(ev.date) || [];
      existing.push(ev);
      map.set(ev.date, existing);
    }
    return map;
  }, [events]);

  const monthCells = useMemo(() => {
    const year = cursorDate.getUTCFullYear();
    const month = cursorDate.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1));
    const startOffset = firstDay.getUTCDay();
    const daysInM = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const cells: ({ dateStr: string; day: number } | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInM; d++) {
      cells.push({
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
      });
    }
    return cells;
  }, [cursorDate]);

  const weekCells = useMemo(() => {
    const dayOfWeek = cursorDate.getUTCDay();
    const sunday = new Date(cursorDate.getTime() - dayOfWeek * 86400000);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday.getTime() + i * 86400000);
      return { dateStr: toYmd(d), day: d.getUTCDate() };
    });
  }, [cursorDate]);

  const stepPeriod = (dir: -1 | 1) => {
    if (viewMode === 'month') {
      setCursorDate(
        new Date(Date.UTC(cursorDate.getUTCFullYear(), cursorDate.getUTCMonth() + dir, 1))
      );
    } else {
      setCursorDate(new Date(cursorDate.getTime() + dir * 7 * 86400000));
    }
  };

  const selectedDayEvents = eventsByDate.get(selectedDate) || [];
  const monthLabel = cursorDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const openEventDetail = (ev: CalendarEventItem) => {
    if (ev.type === 'maintenance') {
      router.push('/maintenance');
    } else if (ev.type === 'amc_expiry' || ev.type === 'amc_visit') {
      router.push('/amc');
    } else {
      router.push(`/products/${ev.productId}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error ? <ErrorBanner message={error} onRetry={loadEvents} /> : null}

      <SegmentedButtons
        value={viewMode}
        onValueChange={(v) => setViewMode(v as 'month' | 'week')}
        buttons={[
          { value: 'month', label: 'Monthly View', icon: 'calendar-month' },
          { value: 'week', label: 'Weekly View', icon: 'calendar-week' },
        ]}
      />

      <AppCard>
        <View style={styles.calHeader}>
          <Pressable onPress={() => stepPeriod(-1)} style={styles.navBtn}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={Palette.primary} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable onPress={() => stepPeriod(1)} style={styles.navBtn}>
            <MaterialCommunityIcons name="chevron-right" size={24} color={Palette.primary} />
          </Pressable>
        </View>

        <View style={styles.weekHeader}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={styles.weekHeaderText}>
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {(viewMode === 'month' ? monthCells : weekCells).map((cell, idx) => {
            if (!cell) {
              return <View key={`empty-${idx}`} style={styles.cell} />;
            }
            const dayEvents = eventsByDate.get(cell.dateStr) || [];
            const isSelected = selectedDate === cell.dateStr;
            const isToday = toYmd(today) === cell.dateStr;

            return (
              <Pressable
                key={cell.dateStr}
                onPress={() => setSelectedDate(cell.dateStr)}
                style={[
                  styles.cell,
                  isSelected && styles.cellSelected,
                  isToday && !isSelected && styles.cellToday,
                ]}
              >
                <Text
                  style={[
                    styles.cellDay,
                    isSelected && styles.cellDaySelected,
                  ]}
                >
                  {cell.day}
                </Text>
                <View style={styles.dotsRow}>
                  {dayEvents.slice(0, 3).map((ev) => (
                    <View
                      key={ev.id}
                      style={[
                        styles.evDot,
                        { backgroundColor: isSelected ? '#FFFFFF' : EVENT_COLORS[ev.type] },
                      ]}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legendRow}>
          <LegendDot color={EVENT_COLORS.warranty_expiry} label="Warranty" />
          <LegendDot color={EVENT_COLORS.extended_expiry} label="Extended" />
          <LegendDot color={EVENT_COLORS.maintenance} label="Maintenance" />
          <LegendDot color={EVENT_COLORS.amc_expiry} label="AMC" />
        </View>
      </AppCard>

      <Text style={styles.sectionTitle}>
        Events on {formatReadableDate(selectedDate)} ({selectedDayEvents.length})
      </Text>

      {loading && events.length === 0 ? (
        <ActivityIndicator color={Palette.primary} style={{ marginTop: 20 }} />
      ) : selectedDayEvents.length === 0 ? (
        <EmptyState
          icon="calendar-blank-outline"
          title="No events on this date"
          subtitle="Tap highlighted dates with colored indicators to inspect scheduled warranties, maintenance, or AMC renewals."
        />
      ) : (
        selectedDayEvents.map((ev) => (
          <Pressable key={ev.id} onPress={() => openEventDetail(ev)}>
            <AppCard style={styles.eventCard}>
              <View style={styles.eventRow}>
                <View style={[styles.eventBar, { backgroundColor: EVENT_COLORS[ev.type] }]} />
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  <Text style={styles.eventSub}>{ev.subtitle}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={Palette.textMuted} />
              </View>
            </AppCard>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  navBtn: { padding: 4 },
  monthLabel: { fontSize: 16, fontWeight: '800', color: Palette.textPrimary },
  weekHeader: { flexDirection: 'row', marginBottom: 6 },
  weekHeaderText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: Palette.textMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.sm,
  },
  cellSelected: { backgroundColor: Palette.primary },
  cellToday: { backgroundColor: Palette.primaryLight },
  cellDay: { fontSize: 13, fontWeight: '600', color: Palette.textPrimary },
  cellDaySelected: { color: '#FFFFFF', fontWeight: '800' },
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 3, height: 6 },
  evDot: { width: 5, height: 5, borderRadius: 2.5 },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Palette.textSecondary, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary, marginTop: 4 },
  eventCard: { marginBottom: Spacing.sm },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  eventBar: { width: 4, height: 38, borderRadius: 2 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: '700', color: Palette.textPrimary },
  eventSub: { fontSize: 12, color: Palette.textSecondary, marginTop: 2 },
});
