import { addMonthsUtc, diffCalendarDays, toUtcDateOnly } from '../utils/dateUtils';
import { AppError } from '../utils/AppError';

export type WarrantyStatus = 'Active' | 'Expiring Soon' | 'Expired';

export interface WarrantyDateInput {
  purchaseDate: Date | string;
  warrantyDurationMonths: number;
  warrantyStartDate?: Date | string;
  warrantyEndDate?: Date | string;
}

export interface CalculatedWarrantyDates {
  purchaseDate: Date;
  warrantyStartDate: Date;
  warrantyEndDate: Date;
  warrantyDurationMonths: number;
}

export interface WarrantyMetrics {
  warrantyStatus: WarrantyStatus;
  remainingDays: number;
  daysUntilExpiry: number;
  totalWarrantyDays: number;
  elapsedDays: number;
  progressPercent: number;
}

export const EXPIRING_SOON_THRESHOLD_DAYS = 30;

export function calculateWarrantyDates(input: WarrantyDateInput): CalculatedWarrantyDates {
  const purchaseDate = toUtcDateOnly(input.purchaseDate);
  const warrantyStartDate = input.warrantyStartDate
    ? toUtcDateOnly(input.warrantyStartDate)
    : purchaseDate;

  const warrantyEndDate = input.warrantyEndDate
    ? toUtcDateOnly(input.warrantyEndDate)
    : addMonthsUtc(warrantyStartDate, input.warrantyDurationMonths);

  if (warrantyEndDate.getTime() < warrantyStartDate.getTime()) {
    throw new AppError(
      'Warranty end date cannot be earlier than warranty start date.',
      400,
      'INVALID_WARRANTY_DATES'
    );
  }

  return {
    purchaseDate,
    warrantyStartDate,
    warrantyEndDate,
    warrantyDurationMonths: input.warrantyDurationMonths,
  };
}

export function computeWarrantyMetrics(
  warrantyStartDate: Date | string,
  warrantyEndDate: Date | string,
  referenceDate: Date | string = new Date()
): WarrantyMetrics {
  const start = toUtcDateOnly(warrantyStartDate);
  const end = toUtcDateOnly(warrantyEndDate);
  const now = toUtcDateOnly(referenceDate);

  const daysUntilExpiry = diffCalendarDays(now, end);
  const remainingDays = Math.max(0, daysUntilExpiry);
  const totalWarrantyDays = Math.max(1, diffCalendarDays(start, end));
  const rawElapsed = diffCalendarDays(start, now);
  const elapsedDays = Math.min(totalWarrantyDays, Math.max(0, rawElapsed));
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalWarrantyDays) * 100)));

  let warrantyStatus: WarrantyStatus = 'Active';
  if (daysUntilExpiry < 0) {
    warrantyStatus = 'Expired';
  } else if (daysUntilExpiry <= EXPIRING_SOON_THRESHOLD_DAYS) {
    warrantyStatus = 'Expiring Soon';
  }

  return {
    warrantyStatus,
    remainingDays,
    daysUntilExpiry,
    totalWarrantyDays,
    elapsedDays,
    progressPercent,
  };
}
