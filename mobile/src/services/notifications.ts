import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import { AmcRecord, MaintenanceRecord, NotificationPreference, Product } from '../types';

const CHANNEL_ID = 'warranty-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Warranty Reminders',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1E3A8A',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function sendProductAddedNotification(
  productName: string,
  warrantyEndDateIso: string,
  prefs?: NotificationPreference | null
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (prefs && (!prefs.enabled || !prefs.notifyNewProduct)) return;

  const granted = await ensureNotificationPermissions();
  if (!granted) return;

  const endStr = new Date(warrantyEndDateIso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Warranty Added to WarrantyWise',
      body: `${productName} is now tracked. Warranty expires on ${endStr}.`,
      data: { type: 'product_added' },
    },
    trigger: null,
  });
}

export async function syncWarrantyNotifications(
  products: Product[],
  prefs: NotificationPreference | null,
  extras?: { amcs?: AmcRecord[]; maintenances?: MaintenanceRecord[] }
): Promise<number> {
  if (Platform.OS === 'web') return 0;

  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!prefs || !prefs.enabled) {
    return 0;
  }

  const granted = await ensureNotificationPermissions();
  if (!granted) return 0;

  const offsets: { days: number; enabled: boolean; label: string }[] = [
    { days: 30, enabled: prefs.remind30Days, label: '30 days' },
    { days: 7, enabled: prefs.remind7Days, label: '7 days' },
    { days: 1, enabled: prefs.remind1Day, label: '1 day' },
  ];

  const now = Date.now();
  let scheduledCount = 0;

  for (const product of products) {
    if (product.warrantyMetrics.warrantyStatus === 'Expired') continue;

    const effectiveEndIso = product.extendedWarrantyEndDate || product.warrantyEndDate;
    const endMs = new Date(effectiveEndIso).getTime();
    if (Number.isNaN(endMs)) continue;

    for (const offset of offsets) {
      if (!offset.enabled) continue;

      const triggerDate = new Date(endMs - offset.days * 24 * 60 * 60 * 1000);
      triggerDate.setHours(9, 0, 0, 0);

      if (triggerDate.getTime() > now + 5000) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Warranty Expiring in ${offset.label}`,
            body: `${product.brand} ${product.productName} warranty expires in ${offset.label}. Review claim readiness if needed.`,
            data: { productId: product.id, offsetDays: offset.days },
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
          },
        });
        scheduledCount += 1;
      }
    }
  }

  if (prefs.amcRenewalAlerts && extras?.amcs) {
    for (const amc of extras.amcs) {
      if (amc.status === 'Expired' || amc.status === 'Cancelled') continue;
      const endMs = new Date(amc.endDate).getTime();
      if (Number.isNaN(endMs)) continue;
      const triggerDate = new Date(endMs - 14 * 24 * 60 * 60 * 1000);
      triggerDate.setHours(9, 0, 0, 0);
      if (triggerDate.getTime() > now + 5000) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'AMC Renewal Approaching',
            body: `${amc.providerName} AMC contract expires in 14 days.`,
            data: { amcId: amc._id },
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
          },
        });
        scheduledCount += 1;
      }
    }
  }

  if (prefs.maintenanceReminders && extras?.maintenances) {
    for (const maint of extras.maintenances) {
      if (maint.status !== 'Scheduled') continue;
      const dueMs = new Date(maint.nextServiceDate).getTime();
      if (Number.isNaN(dueMs)) continue;
      const triggerDate = new Date(dueMs - 24 * 60 * 60 * 1000);
      triggerDate.setHours(9, 0, 0, 0);
      if (triggerDate.getTime() > now + 5000) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Maintenance Due Tomorrow',
            body: `${maint.title} (${maint.serviceType}) is scheduled for tomorrow.`,
            data: { maintenanceId: maint._id },
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
          },
        });
        scheduledCount += 1;
      }
    }
  }

  return scheduledCount;
}

export async function getScheduledNotificationCount(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const list = await Notifications.getAllScheduledNotificationsAsync();
  return list.length;
}

export async function clearAllScheduledNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
