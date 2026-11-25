const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns true if the given 4-digit year is a Gregorian leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the number of days in the specified month (0-indexed: 0 = Jan, 11 = Dec).
 */
export function daysInMonth(year: number, monthIndex: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  return days[normalizedMonth];
}

/**
 * Normalizes a Date to UTC midnight (00:00:00.000Z) preserving its UTC year/month/day.
 */
export function toUtcDateOnly(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date value: ${String(date)}`);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Adds a whole number of calendar months to a date, clamping day-of-month
 * to the target month's length (properly handling Feb 28 / Feb 29 leap years).
 */
export function addMonthsUtc(startDate: Date | string, months: number): Date {
  const base = toUtcDateOnly(startDate);
  const startYear = base.getUTCFullYear();
  const startMonth = base.getUTCMonth();
  const startDay = base.getUTCDate();

  const totalMonths = startYear * 12 + startMonth + Math.trunc(months);
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const maxDay = daysInMonth(targetYear, targetMonth);
  const clampedDay = Math.min(startDay, maxDay);

  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
}

/**
 * Computes signed calendar day difference (toDate - fromDate) in UTC days.
 */
export function diffCalendarDays(fromDate: Date | string, toDate: Date | string): number {
  const fromUtc = toUtcDateOnly(fromDate).getTime();
  const toUtc = toUtcDateOnly(toDate).getTime();
  return Math.round((toUtc - fromUtc) / MS_PER_DAY);
}
