import { describe, expect, it } from 'vitest';
import { addMonthsUtc, diffCalendarDays, isLeapYear } from '../src/utils/dateUtils';
import { calculateWarrantyDates, computeWarrantyMetrics } from '../src/services/warrantyService';
import { CLAIM_READINESS_DISCLAIMER, evaluateClaimReadiness } from '../src/services/claimReadinessService';
import { parseInvoiceText } from '../src/services/ocrService';

describe('Leap-year & warranty date calculations', () => {
  it('identifies leap years correctly', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });

  it('handles Feb 29 leap-day warranty additions cleanly', () => {
    const end = addMonthsUtc('2024-02-29', 12);
    expect(end.toISOString().slice(0, 10)).toBe('2025-02-28');

    const jan31Leap = addMonthsUtc('2024-01-31', 1);
    expect(jan31Leap.toISOString().slice(0, 10)).toBe('2024-02-29');

    const jan31NonLeap = addMonthsUtc('2025-01-31', 1);
    expect(jan31NonLeap.toISOString().slice(0, 10)).toBe('2025-02-28');
  });

  it('counts 366 days across leap-year span', () => {
    expect(diffCalendarDays('2024-01-01', '2025-01-01')).toBe(366);
    expect(diffCalendarDays('2025-01-01', '2026-01-01')).toBe(365);
  });

  it('calculates warranty statuses accurately', () => {
    const dates = calculateWarrantyDates({
      purchaseDate: '2025-01-01',
      warrantyDurationMonths: 12,
    });
    expect(dates.warrantyEndDate.toISOString().slice(0, 10)).toBe('2026-01-01');

    const active = computeWarrantyMetrics('2025-01-01', '2026-01-01', '2025-06-01');
    expect(active.warrantyStatus).toBe('Active');
    expect(active.remainingDays).toBeGreaterThan(30);

    const expiringSoon = computeWarrantyMetrics('2025-01-01', '2026-01-01', '2025-12-15');
    expect(expiringSoon.warrantyStatus).toBe('Expiring Soon');
    expect(expiringSoon.remainingDays).toBe(17);

    const expired = computeWarrantyMetrics('2025-01-01', '2026-01-01', '2026-02-01');
    expect(expired.warrantyStatus).toBe('Expired');
    expect(expired.remainingDays).toBe(0);
  });
});

describe('Claim Readiness Checker', () => {
  it('scores 100 when all details and active warranty + invoice are present', () => {
    const metrics = computeWarrantyMetrics('2026-01-01', '2028-01-01', '2026-06-01');
    const report = evaluateClaimReadiness(
      {
        productName: 'MacBook Pro 14',
        brand: 'Apple',
        modelNumber: 'A2992',
        serialNumber: 'C02XYZ1234',
        purchaseDate: new Date('2026-01-01'),
        purchasePrice: 1999,
        sellerName: 'Apple Store',
        invoiceDocumentId: undefined,
      },
      metrics,
      true
    );

    expect(report.score).toBe(100);
    expect(report.level).toBe('Ready');
    expect(report.missingItems).toHaveLength(0);
    expect(report.disclaimer).toBe(CLAIM_READINESS_DISCLAIMER);
  });

  it('flags missing invoice and serial number with actionable recommendations', () => {
    const metrics = computeWarrantyMetrics('2026-01-01', '2027-01-01', '2026-06-01');
    const report = evaluateClaimReadiness(
      {
        productName: 'Smart TV',
        brand: 'Samsung',
        modelNumber: '',
        serialNumber: '',
        purchaseDate: new Date('2026-01-01'),
        purchasePrice: undefined,
        sellerName: '',
        invoiceDocumentId: undefined,
      },
      metrics,
      false
    );

    expect(report.score).toBeLessThan(60);
    expect(report.missingItems).toContain('Purchase invoice uploaded');
    expect(report.missingItems).toContain('Serial number recorded');
    expect(report.recommendations.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Invoice OCR text parser', () => {
  it('extracts invoice details and requires user verification for dates', () => {
    const sampleText = `
      BestBuy Electronics Store
      TAX INVOICE
      Invoice No: BB-2026-8841
      Print Date: 2026-03-12
      Purchase Date: 2026-03-10
      Item: Sony WH-1000XM5 Wireless Headphones
      Grand Total: $399.99
    `;

    const parsed = parseInvoiceText(sampleText, 92, 'tesseract');
    expect(parsed.requiresUserVerification).toBe(true);
    expect(parsed.extracted.invoiceNumber).toBe('BB-2026-8841');
    expect(parsed.extracted.brand).toBe('Sony');
    expect(parsed.extracted.amount).toBe(399.99);
    expect(parsed.extracted.candidateDates).toContain('2026-03-10');
    expect(parsed.extracted.candidateDates).toContain('2026-03-12');
    expect(parsed.extracted.suggestedPurchaseDate).toBe('2026-03-10');
  });
});
