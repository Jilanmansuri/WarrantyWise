import { IMaintenance } from '../models/Maintenance';
import { IProduct, ProductCategory } from '../models/Product';
import { IRepair } from '../models/Repair';
import { IWarrantyClaim } from '../models/WarrantyClaim';
import { diffCalendarDays } from '../utils/dateUtils';

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

  // 1. Product Age Factor (max 25)
  const ageRatio = Math.min(1.2, ageYears / expectedYears);
  const ageScore = Math.max(5, Math.round(25 * (1 - ageRatio * 0.65)));

  // 2. Repair Frequency & Severity (max 30)
  const totalRepairs = params.repairs.length;
  const openRepairs = params.repairs.filter(
    (r) => r.repairStatus === 'Pending' || r.repairStatus === 'In Progress'
  ).length;
  const repairPenalty = totalRepairs * 6 + openRepairs * 7;
  const repairScore = Math.max(0, 30 - repairPenalty);

  // 3. Maintenance Regularity & History (max 30)
  const totalCompletedVisits = params.maintenances.reduce(
    (sum, m) => sum + (m.history?.length || 0),
    0
  );
  const overdueSchedules = params.maintenances.filter(
    (m) => m.status === 'Scheduled' && diffCalendarDays(now, m.nextServiceDate) < 0
  ).length;
  let maintenanceScore = 20; // neutral baseline when no maintenance needed/logged
  if (params.maintenances.length > 0) {
    maintenanceScore = Math.min(30, 18 + totalCompletedVisits * 4 - overdueSchedules * 9);
    maintenanceScore = Math.max(0, maintenanceScore);
  }

  // 4. Recorded Open Issues / Claims (max 15)
  const unresolvedClaims = params.claims.filter(
    (c) => c.status !== 'Resolved' && c.status !== 'Approved' && c.status !== 'Not Started'
  ).length;
  const issueScore = Math.max(0, 15 - unresolvedClaims * 5);

  const score = Math.min(100, Math.max(0, ageScore + repairScore + maintenanceScore + issueScore));

  const grade: ProductHealthReport['grade'] =
    score >= 85
      ? 'Excellent'
      : score >= 70
        ? 'Good'
        : score >= 50
          ? 'Fair'
          : 'Needs Attention';

  const suggestions: string[] = [];
  if (overdueSchedules > 0) {
    suggestions.push(
      `Complete ${overdueSchedules} overdue maintenance task(s) to improve maintenance regularity.`
    );
  }
  if (params.maintenances.length === 0) {
    suggestions.push(
      'Schedule periodic preventive maintenance reminders to track servicing regularity.'
    );
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
