import { createWorker } from 'tesseract.js';
import { env } from '../config/env';

export interface ParsedInvoiceResult {
  rawText: string;
  ocrEngine: 'tesseract' | 'ocr_space';
  confidence: number;
  extracted: {
    invoiceNumber?: string;
    suggestedPurchaseDate?: string;
    candidateDates: string[];
    productName?: string;
    brand?: string;
    amount?: number;
    currency?: string;
    sellerName?: string;
  };
  requiresUserVerification: true;
  verificationNotice: string;
}

const KNOWN_BRANDS = [
  'Apple',
  'Samsung',
  'Sony',
  'LG',
  'Dell',
  'HP',
  'Lenovo',
  'Asus',
  'Acer',
  'Microsoft',
  'Google',
  'OnePlus',
  'Xiaomi',
  'Motorola',
  'Nothing',
  'Bosch',
  'Whirlpool',
  'Dyson',
  'Philips',
  'Panasonic',
  'Canon',
  'Nikon',
  'Fujifilm',
  'GoPro',
  'Bose',
  'JBL',
  'Sennheiser',
  'Logitech',
  'Razer',
  'Nintendo',
  'PlayStation',
  'Xbox',
  'Breville',
  'KitchenAid',
  'Shark',
  'Braun',
  'Garmin',
  'Fitbit',
];

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function normalizeIsoDate(year: number, month: number, day: number): string | null {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function extractDatesOnly(text: string): string[] {
  const found = new Set<string>();

  // Match YYYY-MM-DD or YYYY/MM/DD
  const isoRegex = /\b(20\d{2}|19\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g;
  for (const m of text.matchAll(isoRegex)) {
    const iso = normalizeIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) found.add(iso);
  }

  // Match DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  const slashRegex = /\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|[12]\d|3[01])[-/](20\d{2}|19\d{2})\b/g;
  for (const m of text.matchAll(slashRegex)) {
    const first = Number(m[1]);
    const second = Number(m[2]);
    const year = Number(m[3]);
    if (first > 12 && second <= 12) {
      const iso = normalizeIsoDate(year, second, first);
      if (iso) found.add(iso);
    } else if (second > 12 && first <= 12) {
      const iso = normalizeIsoDate(year, first, second);
      if (iso) found.add(iso);
    } else {
      const md = normalizeIsoDate(year, first, second);
      const dm = normalizeIsoDate(year, second, first);
      if (md) found.add(md);
      if (dm) found.add(dm);
    }
  }

  // Match "15 Nov 2024" or "Nov 15, 2024"
  const monthNameFirst =
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(0?[1-9]|[12]\d|3[01]),?\s+(20\d{2}|19\d{2})\b/gi;
  for (const m of text.matchAll(monthNameFirst)) {
    const month = Number(MONTH_MAP[m[1].toLowerCase()]);
    const iso = normalizeIsoDate(Number(m[3]), month, Number(m[2]));
    if (iso) found.add(iso);
  }

  const dayFirst =
    /\b(0?[1-9]|[12]\d|3[01])\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?),?\s+(20\d{2}|19\d{2})\b/gi;
  for (const m of text.matchAll(dayFirst)) {
    const month = Number(MONTH_MAP[m[2].toLowerCase()]);
    const iso = normalizeIsoDate(Number(m[3]), month, Number(m[1]));
    if (iso) found.add(iso);
  }

  return Array.from(found);
}

export function extractCandidateDates(text: string): {
  candidateDates: string[];
  suggestedPurchaseDate?: string;
} {
  const candidateDates = extractDatesOnly(text);
  let suggestedPurchaseDate: string | undefined;

  // Only suggest a candidate date if explicitly near a purchase/invoice/order date label
  // Prioritizing explicit Purchase/Order Date over generic Date, and ignoring Print/Due Date
  const lines = text.split(/\r?\n/);
  const priorityPatterns = [
    /\bpurchase\s*date\b[:\s-]/i,
    /\border\s*date\b[:\s-]/i,
    /\binvoice\s*date\b[:\s-]/i,
    /\bbill\s*date\b[:\s-]/i,
  ];

  for (const pattern of priorityPatterns) {
    for (const line of lines) {
      if (pattern.test(line)) {
        const lineDates = extractDatesOnly(line);
        if (lineDates.length > 0) {
          suggestedPurchaseDate = lineDates[0];
          break;
        }
      }
    }
    if (suggestedPurchaseDate) break;
  }

  if (!suggestedPurchaseDate && candidateDates.length === 1) {
    suggestedPurchaseDate = candidateDates[0];
  }

  return { candidateDates, suggestedPurchaseDate };
}

export function parseInvoiceText(rawText: string, confidence = 0, ocrEngine: 'tesseract' | 'ocr_space' = 'tesseract'): ParsedInvoiceResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Invoice Number
  let invoiceNumber: string | undefined;
  const invMatch = rawText.match(
    /(?:invoice\s*(?:no|number|#)|inv\s*(?:no|#)|receipt\s*(?:no|#)|bill\s*(?:no|#)|order\s*(?:no|id|#))[:.\s#-]*([A-Z0-9][A-Z0-9-_/]{2,24})/i
  );
  if (invMatch?.[1]) {
    invoiceNumber = invMatch[1].trim();
  }

  // 2. Dates (never blindly assumed; returned as candidates + unverified suggestion)
  const { candidateDates, suggestedPurchaseDate } = extractCandidateDates(rawText);

  // 3. Total / Amount
  let amount: number | undefined;
  let currency: string | undefined;
  const totalRegex =
    /(?:grand\s*total|total\s*amount|amount\s*paid|net\s*amount|invoice\s*total|total)\s*[:\s-]*([$₹€£]|USD|INR|EUR|GBP)?\s*([\d,]+(?:\.\d{1,2})?)/i;
  const totalMatch = rawText.match(totalRegex);
  if (totalMatch?.[2]) {
    const parsedNum = Number(totalMatch[2].replace(/,/g, ''));
    if (!Number.isNaN(parsedNum) && parsedNum > 0) {
      amount = parsedNum;
      const sym = totalMatch[1];
      currency =
        sym === '₹' || sym === 'INR'
          ? 'INR'
          : sym === '€' || sym === 'EUR'
            ? 'EUR'
            : sym === '£' || sym === 'GBP'
              ? 'GBP'
              : 'USD';
    }
  } else {
    const fallbackMoney = rawText.match(/([$₹€£])\s*([\d,]+\.\d{2})/);
    if (fallbackMoney?.[2]) {
      const parsedNum = Number(fallbackMoney[2].replace(/,/g, ''));
      if (!Number.isNaN(parsedNum) && parsedNum > 0) {
        amount = parsedNum;
      }
    }
  }

  // 4. Brand
  let brand: string | undefined;
  const explicitBrand = rawText.match(/brand\s*[:\-]\s*([A-Za-z0-9 &_-]{2,40})/i);
  if (explicitBrand?.[1]) {
    brand = explicitBrand[1].trim();
  } else {
    for (const candidate of KNOWN_BRANDS) {
      const regex = new RegExp(`\\b${candidate}\\b`, 'i');
      if (regex.test(rawText)) {
        brand = candidate;
        break;
      }
    }
  }

  // 5. Seller Name
  let sellerName: string | undefined;
  const sellerLabel = rawText.match(/(?:sold\s*by|seller|merchant|store|retailer|vendor)\s*[:\-]\s*([^\n]{2,80})/i);
  if (sellerLabel?.[1]) {
    sellerName = sellerLabel[1].trim();
  } else if (lines.length > 0) {
    const headerCandidate = lines.find(
      (line) =>
        line.length >= 3 &&
        line.length <= 60 &&
        !/^(tax\s*)?invoice$/i.test(line) &&
        !/^receipt$/i.test(line) &&
        !/\d{4}-\d{2}-\d{2}/.test(line)
    );
    if (headerCandidate) {
      sellerName = headerCandidate;
    }
  }

  // 6. Product Name
  let productName: string | undefined;
  const productLabel = rawText.match(/(?:product|item|description|model)\s*[:\-]\s*([^\n]{3,100})/i);
  if (productLabel?.[1]) {
    productName = productLabel[1].trim();
  } else if (brand) {
    const brandLine = lines.find((l) => new RegExp(`\\b${brand}\\b`, 'i').test(l) && l.length <= 100);
    if (brandLine) {
      productName = brandLine.replace(/\s+[$₹€£]?[\d,]+\.\d{2}.*$/, '').trim();
    }
  }

  return {
    rawText,
    ocrEngine,
    confidence: Math.round(confidence),
    extracted: {
      invoiceNumber,
      suggestedPurchaseDate,
      candidateDates,
      productName,
      brand,
      amount,
      currency,
      sellerName,
    },
    requiresUserVerification: true,
    verificationNotice:
      'Please verify all extracted fields—especially the Purchase Date—before saving, as invoices often contain multiple dates (order, invoice, print, or due dates).',
  };
}

export async function runInvoiceOcr(imageBuffer: Buffer): Promise<ParsedInvoiceResult> {
  if (env.ocrSpaceApiKey) {
    try {
      const formData = new FormData();
      formData.append('apikey', env.ocrSpaceApiKey);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('file', new Blob([new Uint8Array(imageBuffer)]), 'invoice.jpg');

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        const json = (await response.json()) as {
          ParsedResults?: Array<{ ParsedText?: string }>;
          IsErroredOnProcessing?: boolean;
        };
        const text = json.ParsedResults?.[0]?.ParsedText || '';
        if (text.trim().length > 0 && !json.IsErroredOnProcessing) {
          return parseInvoiceText(text, 85, 'ocr_space');
        }
      }
    } catch {
      // Fall through cleanly to local Tesseract.js OCR
    }
  }

  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(imageBuffer);
    const rawText = result.data.text || '';
    const confidence = typeof result.data.confidence === 'number' ? result.data.confidence : 0;
    return parseInvoiceText(rawText, confidence, 'tesseract');
  } finally {
    await worker.terminate();
  }
}
