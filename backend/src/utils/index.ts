import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signAuthToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyAuthToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (typeof decoded === 'string' || !decoded.userId || !decoded.email) {
    throw new Error('Invalid token payload');
  }
  return {
    userId: String(decoded.userId),
    email: String(decoded.email),
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, monthIndex: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  return days[normalizedMonth];
}

export function toUtcDateOnly(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date value: ${String(date)}`);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addMonthsUtc(startDate: Date | string, months: number): Date {
  const base = toUtcDateOnly(startDate);
  const startYear = base.getUTCFullYear();
  const startMonth = base.getUTCMonth();
  const startDay = base.getUTCDate();

  const totalMonths = startYear * 12 + startMonth + Math.trunc(months);
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const clampedDay = Math.min(startDay, daysInMonth(targetYear, targetMonth));

  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
}

export function diffCalendarDays(fromDate: Date | string, toDate: Date | string): number {
  const fromUtc = toUtcDateOnly(fromDate).getTime();
  const toUtc = toUtcDateOnly(toDate).getTime();
  return Math.round((toUtc - fromUtc) / MS_PER_DAY);
}
