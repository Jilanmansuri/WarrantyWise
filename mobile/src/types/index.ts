export const PRODUCT_CATEGORIES = [
  'Smartphones',
  'Laptops & Computers',
  'Tablets & Wearables',
  'TVs & Audio',
  'Home Appliances',
  'Kitchen Appliances',
  'Gaming & Cameras',
  'Other',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const LIFECYCLE_STATUSES = [
  'Active',
  'Listed for Resale',
  'Resold',
  'Disposed',
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export type WarrantyStatus = 'Active' | 'Expiring Soon' | 'Expired';
export type RepairStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
export type AmcStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Cancelled';
export type MaintenanceStatus = 'Scheduled' | 'Completed' | 'Skipped';
export type ClaimStatus =
  | 'Not Started'
  | 'Documents Pending'
  | 'Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'Resolved';

export type DocumentType =
  | 'Purchase Invoice'
  | 'Warranty Certificate'
  | 'Repair Invoice'
  | 'AMC Contract'
  | 'Claim Document'
  | 'Other';

export const DOCUMENT_TYPES: DocumentType[] = [
  'Purchase Invoice',
  'Warranty Certificate',
  'Repair Invoice',
  'AMC Contract',
  'Claim Document',
  'Other',
];

export const REPAIR_STATUSES: RepairStatus[] = [
  'Pending',
  'In Progress',
  'Completed',
  'Cancelled',
];

export const CLAIM_STATUSES: ClaimStatus[] = [
  'Not Started',
  'Documents Pending',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Resolved',
];

export const FAMILY_RELATIONSHIPS = [
  'Spouse',
  'Partner',
  'Child',
  'Parent',
  'Sibling',
  'Other',
] as const;

export type FamilyRelationship = (typeof FAMILY_RELATIONSHIPS)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  themePreference: 'light' | 'system';
  privacyHideAmounts: boolean;
  privacyBiometricLock: boolean;
  createdAt?: string;
}

export interface NotificationPreference {
  enabled: boolean;
  remind30Days: boolean;
  remind7Days: boolean;
  remind1Day: boolean;
  notifyNewProduct: boolean;
  amcRenewalAlerts: boolean;
  maintenanceReminders: boolean;
  familySharedReminders: boolean;
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
    endDate: string;
  };
  extendedMetrics?: {
    warrantyStatus: WarrantyStatus;
    remainingDays: number;
    startDate: string;
    endDate: string;
  };
}

export interface ClaimChecklistItem {
  key: string;
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

export interface RepairRecord {
  _id: string;
  userId: string;
  productId:
    | string
    | {
        _id: string;
        productName: string;
        brand: string;
        modelNumber?: string;
        category?: string;
      };
  repairDate: string;
  problemDescription: string;
  repairCenter: string;
  repairCost: number;
  repairStatus: RepairStatus;
  repairInvoiceDocumentId?: string;
  repairInvoiceUrl?: string;
  additionalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  _id: string;
  userId: string;
  productId?:
    | string
    | {
        _id: string;
        productName: string;
        brand: string;
      };
  repairId?: string;
  amcId?: string;
  claimId?: string;
  title: string;
  type: DocumentType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageProvider: 'cloudinary' | 'local';
  url: string;
  publicId: string;
  resourceType: 'image' | 'raw';
  createdAt: string;
}

export interface AmcRecord {
  _id: string;
  userId: string;
  productId:
    | string
    | {
        _id: string;
        productName: string;
        brand: string;
        modelNumber?: string;
        category?: string;
      };
  contractNumber?: string;
  providerName: string;
  providerPhone?: string;
  providerEmail?: string;
  startDate: string;
  endDate: string;
  cost: number;
  visitFrequencyMonths: number;
  scheduledVisitsCount: number;
  completedVisitsCount: number;
  nextVisitDate?: string;
  contractDocumentId?:
    | string
    | {
        _id: string;
        title: string;
        fileName: string;
        url: string;
        mimeType: string;
      };
  status: AmcStatus;
  remainingDays: number;
  notes?: string;
  createdAt: string;
}

export interface MaintenanceHistoryEntry {
  _id?: string;
  completedAt: string;
  cost: number;
  serviceProvider?: string;
  notes?: string;
}

export interface MaintenanceRecord {
  _id: string;
  userId: string;
  productId:
    | string
    | {
        _id: string;
        productName: string;
        brand: string;
        modelNumber?: string;
        category?: string;
      };
  title: string;
  serviceType: string;
  frequencyMonths: number;
  lastServiceDate?: string;
  nextServiceDate: string;
  serviceProvider?: string;
  estimatedCost: number;
  status: MaintenanceStatus;
  notes?: string;
  history: MaintenanceHistoryEntry[];
  version: number;
  daysUntilDue: number;
  isOverdue: boolean;
}

export interface WarrantyClaimRecord {
  _id: string;
  userId: string;
  productId:
    | string
    | {
        _id: string;
        productName: string;
        brand: string;
        modelNumber?: string;
        serialNumber?: string;
        warrantyStartDate?: string;
        warrantyEndDate?: string;
        extendedWarrantyEndDate?: string;
      };
  claimReferenceNumber?: string;
  manufacturerOrCenter: string;
  contactPhone?: string;
  contactEmail?: string;
  issueSummary: string;
  status: ClaimStatus;
  submittedAt?: string;
  resolvedAt?: string;
  checklist: {
    key: string;
    label: string;
    required: boolean;
    completed: boolean;
  }[];
  supportingDocumentIds: DocumentRecord[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifecycleTimelineItem {
  id: string;
  eventType: string;
  title: string;
  description: string;
  date: string;
  amount?: number;
  badge?: string;
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
  breakdown: {
    key: string;
    label: string;
    amount: number;
    percent: number;
    color: string;
  }[];
}

export interface ProductHealthReport {
  score: number;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';
  breakdown: {
    key: string;
    label: string;
    score: number;
    maxScore: number;
    summary: string;
  }[];
  suggestions: string[];
  disclaimer: string;
}

export interface ResaleSummary {
  product: {
    id: string;
    productName: string;
    brand: string;
    modelNumber: string;
    serialNumber: string;
    category: ProductCategory;
    purchaseDate: string;
    purchasePrice?: number;
    currency: string;
    sellerName: string;
    warrantyTransferable: boolean;
    lifecycleStatus: LifecycleStatus;
  };
  productAgeDays: number;
  productAgeMonths: number;
  warrantyMetrics: WarrantyMetrics;
  repairs: RepairRecord[];
  maintenances: MaintenanceRecord[];
  attachedInvoices: { _id: string; title: string; type: string; fileName: string; createdAt: string }[];
  disclaimer: string;
}

export interface FamilyMemberRecord {
  _id: string;
  userId: string;
  name: string;
  relationship: FamilyRelationship;
  email?: string;
  linkedUserId?: string;
  permissions: {
    canViewWarranties: boolean;
    canViewDocuments: boolean;
    canReceiveReminders: boolean;
  };
  notes?: string;
  productCount?: number;
  activeWarranties?: number;
  expiringSoon?: number;
  products?: {
    id: string;
    productName: string;
    brand: string;
    category: ProductCategory;
    sharedWithFamily: boolean;
    warrantyEndDate: string;
    extendedWarrantyEndDate?: string;
    warrantyMetrics: WarrantyMetrics;
  }[];
}

export interface FamilyDashboardData {
  summary: {
    memberCount: number;
    assignedProductsCount: number;
    unassignedProductsCount: number;
    activeFamilyWarranties: number;
    expiringFamilyWarranties: number;
    sharedWithMeCount: number;
  };
  members: FamilyMemberRecord[];
  sharedWithMe: {
    id: string;
    productName: string;
    brand: string;
    category: ProductCategory;
    purchaseDate: string;
    warrantyEndDate: string;
    extendedWarrantyEndDate?: string;
    warrantyMetrics: WarrantyMetrics;
    canViewDocuments: boolean;
    canReceiveReminders: boolean;
    ownerName: string;
  }[];
}

export interface CalendarEventItem {
  id: string;
  date: string;
  type: 'warranty_expiry' | 'extended_expiry' | 'maintenance' | 'amc_expiry' | 'amc_visit';
  title: string;
  subtitle: string;
  productId: string;
  referenceId: string;
  status?: string;
}

export interface QrProductIdentity {
  id: string;
  productName: string;
  brand: string;
  modelNumber: string;
  maskedSerialNumber: string;
  category: ProductCategory;
  purchaseDate: string;
  warrantyStatus: WarrantyStatus;
  remainingDays: number;
  warrantyEndDate: string;
  repairs: {
    _id: string;
    repairDate: string;
    problemDescription: string;
    repairCenter: string;
    repairStatus: RepairStatus;
  }[];
}

export interface Product {
  id: string;
  userId: string;
  productName: string;
  brand: string;
  modelNumber: string;
  serialNumber: string;
  category: ProductCategory;
  purchaseDate: string;
  purchasePrice?: number;
  currency: string;
  sellerName: string;
  invoiceNumber: string;
  warrantyDurationMonths: number;
  warrantyStartDate: string;
  warrantyEndDate: string;
  extendedWarrantyProvider?: string;
  extendedWarrantyMonths?: number;
  extendedWarrantyCost?: number;
  extendedWarrantyStartDate?: string;
  extendedWarrantyEndDate?: string;
  extendedWarrantyNotes?: string;
  warrantyTransferable?: boolean;
  transferredToName?: string;
  transferredToEmail?: string;
  transferredAt?: string;
  lifecycleStatus?: LifecycleStatus;
  resalePrice?: number;
  resaleDate?: string;
  resaleBuyerName?: string;
  disposalDate?: string;
  disposalMethod?: string;
  disposalNotes?: string;
  familyMemberId?: string;
  sharedWithFamily?: boolean;
  qrToken?: string;
  qrGeneratedAt?: string;
  version?: number;
  productImageUrl: string;
  productImageDocumentId?: string;
  invoiceDocumentId?: string;
  additionalNotes: string;
  warrantyMetrics: WarrantyMetrics;
  claimReadiness: ClaimReadinessReport;
  isOwner?: boolean;
  canViewDocuments?: boolean;
  repairs?: RepairRecord[];
  documents?: DocumentRecord[];
  amcs?: AmcRecord[];
  maintenances?: MaintenanceRecord[];
  claims?: WarrantyClaimRecord[];
  lifecycle?: LifecycleTimelineItem[];
  healthScore?: ProductHealthReport;
  costAnalysis?: CostAnalysisResult;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  stats: {
    totalProducts: number;
    activeWarranties: number;
    expiringSoon: number;
    expiredWarranties: number;
    totalDocuments: number;
    totalRepairs: number;
    activeAmcContracts: number;
    pendingClaims: number;
    upcomingMaintenance: number;
  };
  recentlyAddedProducts: Product[];
  upcomingExpiries: Product[];
  recentlyRepairedProducts: RepairRecord[];
  upcomingEvents?: {
    id: string;
    date: string;
    type: string;
    title: string;
    productId: string;
  }[];
  recentProductActivity?: {
    _id: string;
    eventType: string;
    title: string;
    description?: string;
    eventDate: string;
    productId?: { _id: string; productName: string; brand: string };
  }[];
  warrantyAlerts?: {
    id: string;
    productId: string;
    title: string;
    message: string;
    severity: 'high' | 'medium';
  }[];
  maintenanceAlerts?: {
    id: string;
    productId: string;
    title: string;
    message: string;
    severity: 'high' | 'medium';
  }[];
}

export interface OcrParseResult {
  rawText: string;
  ocrEngine: string;
  confidence: number;
  extracted: {
    invoiceNumber?: string;
    suggestedPurchaseDate?: string;
    candidateDates: string[];
    productName?: string;
    brand?: string;
    modelNumber?: string;
    serialNumber?: string;
    amount?: number;
    currency?: string;
    sellerName?: string;
    warrantyDurationMonths?: number;
    warrantySummary?: string;
    extendedWarrantyMonths?: number;
  };
  requiresUserVerification: boolean;
  verificationNotice: string;
}
