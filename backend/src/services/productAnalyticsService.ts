import { Types } from 'mongoose';
import { AMC, IAMC } from '../models/AMC';
import { IMaintenance, Maintenance } from '../models/Maintenance';
import { IProduct, ProductCategory } from '../models/Product';
import { ProductEvent, ProductEventType } from '../models/ProductEvent';
import { IRepair, Repair } from '../models/Repair';
import { IWarrantyClaim, WarrantyClaim } from '../models/WarrantyClaim';
import { diffCalendarDays } from '../utils';
import { WarrantyMetrics } from './warrantyService';

// --- Claim Readiness Checker ---

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

  const score = Math.min(100, checklist.reduce((sum, item) => sum + item.earned, 0));
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

// --- Product Health Score ---

export interface HealthScoreFactor {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  summary: string;
}

export interface ProductHealthReport {
  score: number;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';
  breakdown: HealthScoreFactor[];
  suggestions: string[];
  disclaimer: string;
}

export const HEALTH_SCORE_DISCLAIMER =
  'This Product Health Score is an informational estimate derived from your recorded age, repair, and maintenance history—it is not a professional technical inspection.';

const EXPECTED_LIFESPAN_YEARS: Record<ProductCategory, number> = {
  Smartphones: 4,
  'Laptops & Computers': 5,
  'Tablets & Wearables': 4,
  'TVs & Audio': 7,
  'Home Appliances': 8,
  'Kitchen Appliances': 7,
  'Gaming & Cameras': 6,
  Other: 5,
};

export function computeProductHealthScore(params: {
  product: Pick<IProduct, 'purchaseDate' | 'category'>;
  repairs: Pick<IRepair, 'repairStatus' | 'repairDate'>[];
  maintenances: Pick<IMaintenance, 'status' | 'nextServiceDate' | 'history' | 'frequencyMonths'>[];
  claims: Pick<IWarrantyClaim, 'status'>[];
  referenceDate?: Date;
}): ProductHealthReport {
  const now = params.referenceDate || new Date();
  const ageDays = Math.max(0, diffCalendarDays(params.product.purchaseDate, now));
  const ageYears = ageDays / 365.25;
  const expectedYears = EXPECTED_LIFESPAN_YEARS[params.product.category] || 5;

  const ageRatio = Math.min(1.2, ageYears / expectedYears);
  const ageScore = Math.max(5, Math.round(25 * (1 - ageRatio * 0.65)));

  const totalRepairs = params.repairs.length;
  const openRepairs = params.repairs.filter(
    (r) => r.repairStatus === 'Pending' || r.repairStatus === 'In Progress'
  ).length;
  const repairScore = Math.max(0, 30 - (totalRepairs * 6 + openRepairs * 7));

  const totalCompletedVisits = params.maintenances.reduce(
    (sum, m) => sum + (m.history?.length || 0),
    0
  );
  const overdueSchedules = params.maintenances.filter(
    (m) => m.status === 'Scheduled' && diffCalendarDays(now, m.nextServiceDate) < 0
  ).length;
  let maintenanceScore = 20;
  if (params.maintenances.length > 0) {
    maintenanceScore = Math.max(
      0,
      Math.min(30, 18 + totalCompletedVisits * 4 - overdueSchedules * 9)
    );
  }

  const unresolvedClaims = params.claims.filter(
    (c) => c.status !== 'Resolved' && c.status !== 'Approved' && c.status !== 'Not Started'
  ).length;
  const issueScore = Math.max(0, 15 - unresolvedClaims * 5);

  const score = Math.min(100, Math.max(0, ageScore + repairScore + maintenanceScore + issueScore));
  const grade: ProductHealthReport['grade'] =
    score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs Attention';

  const suggestions: string[] = [];
  if (overdueSchedules > 0) {
    suggestions.push(
      `Complete ${overdueSchedules} overdue maintenance task(s) to improve maintenance regularity.`
    );
  }
  if (params.maintenances.length === 0) {
    suggestions.push('Schedule periodic preventive maintenance reminders to track servicing regularity.');
  }
  if (openRepairs > 0) {
    suggestions.push('Follow up on open repair records and update status once servicing completes.');
  }
  if (totalRepairs >= 3) {
    suggestions.push(
      'Frequent repairs recorded; review the Cost Analyzer before investing in further out-of-warranty repairs.'
    );
  }
  if (suggestions.length === 0) {
    suggestions.push('Keep logging routine servicing and invoices to maintain an accurate product health record.');
  }

  return {
    score,
    grade,
    breakdown: [
      {
        key: 'age',
        label: 'Product Age',
        score: ageScore,
        maxScore: 25,
        summary: `${ageYears.toFixed(1)} yrs old (typical ${expectedYears} yr category benchmark)`,
      },
      {
        key: 'repairs',
        label: 'Repair Frequency',
        score: repairScore,
        maxScore: 30,
        summary: `${totalRepairs} repair(s) logged (${openRepairs} open)`,
      },
      {
        key: 'maintenance',
        label: 'Maintenance Regularity',
        score: maintenanceScore,
        maxScore: 30,
        summary: `${totalCompletedVisits} completed service(s), ${overdueSchedules} overdue`,
      },
      {
        key: 'issues',
        label: 'Recorded Issues & Claims',
        score: issueScore,
        maxScore: 15,
        summary: `${unresolvedClaims} active/pending claim issue(s)`,
      },
    ],
    suggestions,
    disclaimer: HEALTH_SCORE_DISCLAIMER,
  };
}

// --- Cost Analyzer ---

export interface CostBreakdownItem {
  key: 'purchase' | 'extended_warranty' | 'amc' | 'maintenance' | 'repairs';
  label: string;
  amount: number;
  percent: number;
  color: string;
}

export interface CostAnalysisResult {
  currency: string;
  originalPurchasePrice: number;
  extendedWarrantyCost: number;
  totalAmcCost: number;
  totalMaintenanceExpenses: number;
  totalRepairExpenses: number;
  totalOwnershipCost: number;
  productAgeDays: number;
  productAgeYears: number;
  averageYearlyOwnershipCost: number;
  resaleRecoveryAmount: number;
  netOwnershipCost: number;
  breakdown: CostBreakdownItem[];
}

export function analyzeProductOwnershipCost(params: {
  product: Pick<
    IProduct,
    'purchaseDate' | 'purchasePrice' | 'currency' | 'extendedWarrantyCost' | 'resalePrice'
  >;
  repairs: Pick<IRepair, 'repairCost'>[];
  maintenances: Pick<IMaintenance, 'history'>[];
  amcs: Pick<IAMC, 'cost'>[];
  referenceDate?: Date;
}): CostAnalysisResult {
  const now = params.referenceDate || new Date();
  const originalPurchasePrice = Number(params.product.purchasePrice || 0);
  const extendedWarrantyCost = Number(params.product.extendedWarrantyCost || 0);
  const totalAmcCost = params.amcs.reduce((sum, a) => sum + Number(a.cost || 0), 0);
  const totalMaintenanceExpenses = params.maintenances.reduce(
    (sum, m) =>
      sum + (m.history || []).reduce((hSum, entry) => hSum + Number(entry.cost || 0), 0),
    0
  );
  const totalRepairExpenses = params.repairs.reduce(
    (sum, r) => sum + Number(r.repairCost || 0),
    0
  );

  const totalOwnershipCost = Number(
    (
      originalPurchasePrice +
      extendedWarrantyCost +
      totalAmcCost +
      totalMaintenanceExpenses +
      totalRepairExpenses
    ).toFixed(2)
  );

  const productAgeDays = Math.max(1, diffCalendarDays(params.product.purchaseDate, now));
  const productAgeYears = Number((productAgeDays / 365.25).toFixed(2));
  const effectiveYears = Math.max(1, productAgeYears);
  const averageYearlyOwnershipCost = Number((totalOwnershipCost / effectiveYears).toFixed(2));

  const resaleRecoveryAmount = Number(params.product.resalePrice || 0);
  const netOwnershipCost = Math.max(
    0,
    Number((totalOwnershipCost - resaleRecoveryAmount).toFixed(2))
  );

  const rawItems: Omit<CostBreakdownItem, 'percent'>[] = [
    { key: 'purchase', label: 'Original Purchase', amount: originalPurchasePrice, color: '#0F295C' },
    {
      key: 'extended_warranty',
      label: 'Extended Warranty',
      amount: extendedWarrantyCost,
      color: '#1E40AF',
    },
    { key: 'amc', label: 'AMC Contracts', amount: totalAmcCost, color: '#0D9488' },
    { key: 'maintenance', label: 'Maintenance', amount: totalMaintenanceExpenses, color: '#D97706' },
    { key: 'repairs', label: 'Repairs', amount: totalRepairExpenses, color: '#DC2626' },
  ];

  const denominator = totalOwnershipCost > 0 ? totalOwnershipCost : 1;
  const breakdown: CostBreakdownItem[] = rawItems.map((item) => ({
    ...item,
    percent: Math.round((item.amount / denominator) * 100),
  }));

  return {
    currency: params.product.currency || 'USD',
    originalPurchasePrice,
    extendedWarrantyCost,
    totalAmcCost,
    totalMaintenanceExpenses,
    totalRepairExpenses,
    totalOwnershipCost,
    productAgeDays,
    productAgeYears,
    averageYearlyOwnershipCost,
    resaleRecoveryAmount,
    netOwnershipCost,
    breakdown,
  };
}

// --- Product Lifecycle Timeline ---

export interface LifecycleTimelineItem {
  id: string;
  eventType: ProductEventType | 'WARRANTY_EXPIRY';
  title: string;
  description: string;
  date: Date;
  amount?: number;
  badge?: string;
}

export async function recordProductEvent(params: {
  userId: string | Types.ObjectId;
  productId: string | Types.ObjectId;
  eventType: ProductEventType;
  title: string;
  description?: string;
  amount?: number;
  eventDate?: Date;
  metadata?: Record<string, unknown>;
}) {
  return ProductEvent.create({
    userId: params.userId,
    productId: params.productId,
    eventType: params.eventType,
    title: params.title,
    description: params.description,
    amount: params.amount,
    eventDate: params.eventDate || new Date(),
    metadata: params.metadata,
  });
}

export async function buildProductLifecycleTimeline(
  product: IProduct
): Promise<LifecycleTimelineItem[]> {
  const [events, repairs, maintenances, amcs, claims] = await Promise.all([
    ProductEvent.find({ productId: product._id }).sort({ eventDate: -1 }),
    Repair.find({ productId: product._id }).sort({ repairDate: -1 }),
    Maintenance.find({ productId: product._id }),
    AMC.find({ productId: product._id }).sort({ startDate: -1 }),
    WarrantyClaim.find({ productId: product._id }).sort({ updatedAt: -1 }),
  ]);

  const items: LifecycleTimelineItem[] = [];

  items.push({
    id: `purchase-${product._id}`,
    eventType: 'PURCHASED',
    title: 'Product Purchased',
    description: product.sellerName
      ? `Purchased from ${product.sellerName}${product.invoiceNumber ? ` (Inv #${product.invoiceNumber})` : ''}`
      : 'Initial purchase recorded',
    date: product.purchaseDate,
    amount: product.purchasePrice,
    badge: 'Purchase',
  });

  items.push({
    id: `warranty-start-${product._id}`,
    eventType: 'WARRANTY_STARTED',
    title: 'Standard Warranty Started',
    description: `${product.warrantyDurationMonths} month(s) coverage`,
    date: product.warrantyStartDate,
    badge: 'Warranty',
  });

  if (product.extendedWarrantyEndDate) {
    items.push({
      id: `ext-warranty-${product._id}`,
      eventType: 'EXTENDED_WARRANTY_ADDED',
      title: 'Extended Warranty Coverage',
      description: `${product.extendedWarrantyProvider || 'Extended Plan'} (${product.extendedWarrantyMonths || 0} months)`,
      date: product.extendedWarrantyStartDate || product.warrantyEndDate,
      amount: product.extendedWarrantyCost,
      badge: 'Extended',
    });
  }

  for (const r of repairs) {
    items.push({
      id: `repair-${r._id}`,
      eventType: 'REPAIR_LOGGED',
      title: `Repair: ${r.problemDescription}`,
      description: `${r.repairCenter} • Status: ${r.repairStatus}`,
      date: r.repairDate,
      amount: r.repairCost,
      badge: 'Repair',
    });
  }

  for (const m of maintenances) {
    for (const h of m.history || []) {
      items.push({
        id: `maint-${m._id}-${h._id || h.completedAt.getTime()}`,
        eventType: 'MAINTENANCE_LOGGED',
        title: `Maintenance: ${m.title}`,
        description: h.serviceProvider
          ? `${h.serviceProvider}${h.notes ? ` — ${h.notes}` : ''}`
          : h.notes || 'Routine maintenance completed',
        date: h.completedAt,
        amount: h.cost,
        badge: 'Maintenance',
      });
    }
  }

  for (const a of amcs) {
    items.push({
      id: `amc-${a._id}`,
      eventType: 'AMC_ADDED',
      title: `AMC Contract: ${a.providerName}`,
      description: `${a.completedVisitsCount}/${a.scheduledVisitsCount} visits completed`,
      date: a.startDate,
      amount: a.cost,
      badge: 'AMC',
    });
  }

  for (const c of claims) {
    items.push({
      id: `claim-${c._id}`,
      eventType: 'CLAIM_UPDATED',
      title: `Warranty Claim (${c.status})`,
      description: `${c.manufacturerOrCenter}${c.claimReferenceNumber ? ` • Ref #${c.claimReferenceNumber}` : ''}`,
      date: c.submittedAt || c.createdAt,
      badge: 'Claim',
    });
  }

  if (product.transferredAt) {
    items.push({
      id: `transfer-${product._id}`,
      eventType: 'WARRANTY_TRANSFERRED',
      title: 'Warranty Transferred',
      description: `Transferred to ${product.transferredToName || product.transferredToEmail || 'new owner'}`,
      date: product.transferredAt,
      badge: 'Transfer',
    });
  }

  if (product.lifecycleStatus === 'Resold' && product.resaleDate) {
    items.push({
      id: `resold-${product._id}`,
      eventType: 'RESOLD',
      title: 'Product Resold',
      description: product.resaleBuyerName ? `Sold to ${product.resaleBuyerName}` : 'Marked as resold',
      date: product.resaleDate,
      amount: product.resalePrice,
      badge: 'Resale',
    });
  }

  if (product.lifecycleStatus === 'Disposed' && product.disposalDate) {
    items.push({
      id: `disposed-${product._id}`,
      eventType: 'DISPOSED',
      title: 'Product Disposed / Recycled',
      description: product.disposalMethod || 'Lifecycle ended',
      date: product.disposalDate,
      badge: 'Disposed',
    });
  }

  for (const ev of events) {
    if (
      ev.eventType !== 'PURCHASED' &&
      ev.eventType !== 'REPAIR_LOGGED' &&
      ev.eventType !== 'MAINTENANCE_LOGGED' &&
      ev.eventType !== 'AMC_ADDED' &&
      ev.eventType !== 'CLAIM_UPDATED' &&
      ev.eventType !== 'WARRANTY_TRANSFERRED' &&
      ev.eventType !== 'RESOLD' &&
      ev.eventType !== 'DISPOSED'
    ) {
      items.push({
        id: `ev-${ev._id}`,
        eventType: ev.eventType,
        title: ev.title,
        description: ev.description || '',
        date: ev.eventDate,
        amount: ev.amount,
        badge: 'Event',
      });
    }
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
