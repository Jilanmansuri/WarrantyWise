import { IProduct } from '../models/Product';
import { WarrantyMetrics } from './warrantyService';

export interface ClaimChecklistItem {
  key:
    | 'purchase_invoice'
    | 'serial_number'
    | 'purchase_date'
    | 'warranty_active'
    | 'product_details';
  label: string;
  passed: boolean;
  weight: number;
  earned: number;
  recommendation?: string;
}

export interface ClaimReadinessReport {
  score: number;
  level: 'Ready' | 'Needs Attention' | 'Incomplete';
  checklist: ClaimChecklistItem[];
  missingItems: string[];
  recommendations: string[];
  disclaimer: string;
}

export const CLAIM_READINESS_DISCLAIMER =
  'This readiness score evaluates completeness of your stored warranty records and does not guarantee manufacturer or seller claim approval.';

export function evaluateClaimReadiness(
  product: Pick<
    IProduct,
    | 'productName'
    | 'brand'
    | 'modelNumber'
    | 'serialNumber'
    | 'purchaseDate'
    | 'purchasePrice'
    | 'sellerName'
    | 'invoiceDocumentId'
  >,
  metrics: WarrantyMetrics,
  hasLinkedPurchaseInvoiceDoc: boolean
): ClaimReadinessReport {
  const hasInvoice = Boolean(product.invoiceDocumentId) || hasLinkedPurchaseInvoiceDoc;
  const hasSerial = Boolean(product.serialNumber && product.serialNumber.trim().length > 0);
  const hasPurchaseDate = Boolean(product.purchaseDate);
  const isActive = metrics.warrantyStatus === 'Active';
  const isExpiringSoon = metrics.warrantyStatus === 'Expiring Soon';

  const hasModel = Boolean(product.modelNumber && product.modelNumber.trim().length > 0);
  const hasSeller = Boolean(product.sellerName && product.sellerName.trim().length > 0);
  const hasPrice = typeof product.purchasePrice === 'number' && product.purchasePrice > 0;
  const detailsCount =
    (product.productName?.trim() ? 1 : 0) +
    (product.brand?.trim() ? 1 : 0) +
    (hasModel ? 1 : 0) +
    (hasSeller ? 1 : 0) +
    (hasPrice ? 1 : 0);
  const detailsComplete = detailsCount === 5;
  const detailsEarned = Math.round((detailsCount / 5) * 15);

  const warrantyEarned = isActive ? 25 : isExpiringSoon ? 18 : 0;

  const checklist: ClaimChecklistItem[] = [
    {
      key: 'purchase_invoice',
      label: 'Purchase invoice uploaded',
      passed: hasInvoice,
      weight: 25,
      earned: hasInvoice ? 25 : 0,
      recommendation: hasInvoice
        ? undefined
        : 'Upload your original purchase invoice or receipt to the Document Vault and link it to this product.',
    },
    {
      key: 'serial_number',
      label: 'Serial number recorded',
      passed: hasSerial,
      weight: 20,
      earned: hasSerial ? 20 : 0,
      recommendation: hasSerial
        ? undefined
        : 'Add the device serial number (usually found on the box, device label, or system settings).',
    },
    {
      key: 'purchase_date',
      label: 'Purchase date verified',
      passed: hasPurchaseDate,
      weight: 15,
      earned: hasPurchaseDate ? 15 : 0,
      recommendation: hasPurchaseDate ? undefined : 'Record the exact purchase date shown on your receipt.',
    },
    {
      key: 'warranty_active',
      label: 'Warranty currently active',
      passed: isActive || isExpiringSoon,
      weight: 25,
      earned: warrantyEarned,
      recommendation:
        metrics.warrantyStatus === 'Expired'
          ? 'This warranty has expired. Check if you purchased an extended protection plan or credit card coverage.'
          : isExpiringSoon
            ? `Warranty expires in ${metrics.remainingDays} day(s). Initiate any pending claim promptly.`
            : undefined,
    },
    {
      key: 'product_details',
      label: 'Product details complete (model, seller, price)',
      passed: detailsComplete,
      weight: 15,
      earned: detailsEarned,
      recommendation: detailsComplete
        ? undefined
        : `Complete missing details: ${[
            !hasModel ? 'model number' : null,
            !hasSeller ? 'seller name' : null,
            !hasPrice ? 'purchase price' : null,
          ]
            .filter(Boolean)
            .join(', ')}.`,
    },
  ];

  const score = Math.min(
    100,
    checklist.reduce((sum, item) => sum + item.earned, 0)
  );

  const missingItems = checklist.filter((item) => !item.passed).map((item) => item.label);
  const recommendations = checklist
    .map((item) => item.recommendation)
    .filter((rec): rec is string => Boolean(rec));

  const level: ClaimReadinessReport['level'] =
    score >= 80 ? 'Ready' : score >= 50 ? 'Needs Attention' : 'Incomplete';

  return {
    score,
    level,
    checklist,
    missingItems,
    recommendations,
    disclaimer: CLAIM_READINESS_DISCLAIMER,
  };
}
