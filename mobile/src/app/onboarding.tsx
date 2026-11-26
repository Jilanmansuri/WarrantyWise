import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { CardShadow, Palette, Radii, Spacing } from '../theme/tokens';

const { width } = Dimensions.get('window');

interface Slide {
  id: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    icon: 'receipt-text-check',
    title: 'Never Lose an Invoice Again',
    description:
      'Snap or upload purchase invoices and warranty certificates into your encrypted Document Vault, organized by product.',
    accent: Palette.primary,
  },
  {
    id: '2',
    icon: 'bell-ring-outline',
    title: 'Smart Expiry Reminders',
    description:
      'Automatically track warranty start dates, leap-year expiry dates, and receive timely alerts 30, 7, and 1 day before coverage ends.',
    accent: Palette.primaryAccent,
  },
  {
    id: '3',
    icon: 'wrench-clock',
    title: 'Repairs & Claim Readiness',
    description:
      'Maintain full service timelines, verify warranty claim readiness scores, and export professional PDF reports in one tap.',
    accent: Palette.success,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const listRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
      if (viewableItems[0]?.index !== null && viewableItems[0]?.index !== undefined) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    []
  );

  const handleFinish = async () => {
    await completeOnboarding();
    router.replace('/(auth)/login');
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      void handleFinish();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>WarrantyWise</Text>
        <Button mode="text" compact textColor={Palette.textSecondary} onPress={handleFinish}>
          Skip
        </Button>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.card}>
              <View style={[styles.iconBox, { backgroundColor: Palette.primaryLight }]}>
                <MaterialCommunityIcons name={item.icon} size={56} color={item.accent} />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, idx) => (
            <View
              key={s.id}
              style={[styles.dot, idx === activeIndex && styles.dotActive]}
            />
          ))}
        </View>

        <Button
          mode="contained"
          onPress={handleNext}
          buttonColor={Palette.primary}
          style={styles.cta}
          contentStyle={styles.ctaContent}
        >
          {activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    color: Palette.primary,
  },
  slide: {
    width,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.xxxl,
    alignItems: 'center',
    ...CardShadow,
  },
  iconBox: {
    width: 110,
    height: 110,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Palette.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: 15,
    color: Palette.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: Palette.primary,
  },
  cta: {
    borderRadius: Radii.md,
  },
  ctaContent: {
    height: 50,
  },
});
