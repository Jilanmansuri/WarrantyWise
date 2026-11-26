import { IAMC } from '../models/AMC';
import { IMaintenance } from '../models/Maintenance';
import { IProduct } from '../models/Product';
import { IRepair } from '../models/Repair';
import { diffCalendarDays } from '../utils/dateUtils';

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
    {
      key: 'purchase',
      label: 'Original Purchase',
      amount: originalPurchasePrice,
      color: '#0F295C',
    },
    {
      key: 'extended_warranty',
      label: 'Extended Warranty',
      amount: extendedWarrantyCost,
      color: '#1E40AF',
    },
    {
      key: 'amc',
      label: 'AMC Contracts',
      amount: totalAmcCost,
      color: '#0D9488',
    },
    {
      key: 'maintenance',
      label: 'Maintenance',
      amount: totalMaintenanceExpenses,
      color: '#D97706',
    },
    {
      key: 'repairs',
      label: 'Repairs',
      amount: totalRepairExpenses,
      color: '#DC2626',
    },
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
