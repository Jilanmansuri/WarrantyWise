import { AppError, addMonthsUtc, diffCalendarDays, toUtcDateOnly } from '../utils';

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

export interface ExtendedWarrantyInput {
  standardEndDate: Date | string;
  extendedWarrantyMonths?: number;
  extendedWarrantyStartDate?: Date | string;
  extendedWarrantyEndDate?: Date | string;
}

export interface CalculatedExtendedDates {
  extendedWarrantyStartDate?: Date;
  extendedWarrantyEndDate?: Date;
  extendedWarrantyMonths?: number;
}

export interface WarrantyMetrics {
  warrantyStatus: WarrantyStatus;
  remainingDays: number;
  daysUntilExpiry: number;
  totalWarrantyDays: number;
  elapsedDays: number;
  progressPercent: number;
  activeTier?: 'Standard' | 'Extended' | 'Expired';
  standardMetrics?: {
    warrantyStatus: WarrantyStatus;
    remainingDays: number;
    endDate: Date;
  };
  extendedMetrics?: {
    warrantyStatus: WarrantyStatus;
    remainingDays: number;
    startDate: Date;
    endDate: Date;
  };
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

export function calculateExtendedWarrantyDates(
  input: ExtendedWarrantyInput
): CalculatedExtendedDates {
  const months = input.extendedWarrantyMonths;
  if ((!months || months <= 0) && !input.extendedWarrantyEndDate) {
    return {};
  }

  const start = input.extendedWarrantyStartDate
    ? toUtcDateOnly(input.extendedWarrantyStartDate)
    : toUtcDateOnly(input.standardEndDate);

  const end = input.extendedWarrantyEndDate
    ? toUtcDateOnly(input.extendedWarrantyEndDate)
    : addMonthsUtc(start, months || 0);

  if (end.getTime() < start.getTime()) {
    throw new AppError(
      'Extended warranty end date cannot be earlier than extended warranty start date.',
      400,
      'INVALID_EXTENDED_WARRANTY_DATES'
    );
  }

  return {
    extendedWarrantyStartDate: start,
    extendedWarrantyEndDate: end,
    extendedWarrantyMonths: months,
  };
}

export function computeWarrantyMetrics(
  warrantyStartDate: Date | string,
  warrantyEndDate: Date | string,
  referenceDate: Date | string = new Date(),
  extendedStartDate?: Date | string,
  extendedEndDate?: Date | string
): WarrantyMetrics {
  const start = toUtcDateOnly(warrantyStartDate);
  const stdEnd = toUtcDateOnly(warrantyEndDate);
  const now = toUtcDateOnly(referenceDate);

  const stdDaysUntil = diffCalendarDays(now, stdEnd);
  const stdStatus: WarrantyStatus =
    stdDaysUntil < 0
      ? 'Expired'
      : stdDaysUntil <= EXPIRING_SOON_THRESHOLD_DAYS
        ? 'Expiring Soon'
        : 'Active';

  let effectiveEnd = stdEnd;
  let extendedMetrics: WarrantyMetrics['extendedMetrics'];

  if (extendedEndDate) {
    const extEnd = toUtcDateOnly(extendedEndDate);
    const extStart = extendedStartDate ? toUtcDateOnly(extendedStartDate) : stdEnd;
    const extDaysUntil = diffCalendarDays(now, extEnd);
    const extStatus: WarrantyStatus =
      extDaysUntil < 0
        ? 'Expired'
        : extDaysUntil <= EXPIRING_SOON_THRESHOLD_DAYS
          ? 'Expiring Soon'
          : 'Active';

    extendedMetrics = {
      warrantyStatus: extStatus,
      remainingDays: Math.max(0, extDaysUntil),
      startDate: extStart,
      endDate: extEnd,
    };

    if (extEnd.getTime() > effectiveEnd.getTime()) {
      effectiveEnd = extEnd;
    }
  }

  const daysUntilExpiry = diffCalendarDays(now, effectiveEnd);
  const remainingDays = Math.max(0, daysUntilExpiry);
  const totalWarrantyDays = Math.max(1, diffCalendarDays(start, effectiveEnd));
  const rawElapsed = diffCalendarDays(start, now);
  const elapsedDays = Math.min(totalWarrantyDays, Math.max(0, rawElapsed));
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((elapsedDays / totalWarrantyDays) * 100))
  );

  let warrantyStatus: WarrantyStatus = 'Active';
  if (daysUntilExpiry < 0) {
    warrantyStatus = 'Expired';
  } else if (daysUntilExpiry <= EXPIRING_SOON_THRESHOLD_DAYS) {
    warrantyStatus = 'Expiring Soon';
  }

  let activeTier: WarrantyMetrics['activeTier'] = 'Expired';
  if (warrantyStatus !== 'Expired') {
    activeTier =
      stdDaysUntil < 0 && extendedMetrics && extendedMetrics.warrantyStatus !== 'Expired'
        ? 'Extended'
        : 'Standard';
  }

  return {
    warrantyStatus,
    remainingDays,
    daysUntilExpiry,
    totalWarrantyDays,
    elapsedDays,
    progressPercent,
    activeTier,
    standardMetrics: {
      warrantyStatus: stdStatus,
      remainingDays: Math.max(0, stdDaysUntil),
      endDate: stdEnd,
    },
    extendedMetrics,
  };
}
