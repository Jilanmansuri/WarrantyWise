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

export type WarrantyStatus = 'Active' | 'Expiring Soon' | 'Expired';
export type RepairStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
export type DocumentType =
  | 'Purchase Invoice'
  | 'Warranty Certificate'
  | 'Repair Invoice'
  | 'Other';

export const DOCUMENT_TYPES: DocumentType[] = [
  'Purchase Invoice',
  'Warranty Certificate',
  'Repair Invoice',
  'Other',
];

export const REPAIR_STATUSES: RepairStatus[] = [
  'Pending',
  'In Progress',
  'Completed',
  'Cancelled',
];

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
}

export interface WarrantyMetrics {
  warrantyStatus: WarrantyStatus;
  remainingDays: number;
  daysUntilExpiry: number;
  totalWarrantyDays: number;
  elapsedDays: number;
  progressPercent: number;
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
  productImageUrl: string;
  productImageDocumentId?: string;
  invoiceDocumentId?: string;
  additionalNotes: string;
  warrantyMetrics: WarrantyMetrics;
  claimReadiness: ClaimReadinessReport;
  repairs?: RepairRecord[];
  documents?: DocumentRecord[];
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
  };
  recentlyAddedProducts: Product[];
  upcomingExpiries: Product[];
  recentlyRepairedProducts: RepairRecord[];
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
    amount?: number;
    currency?: string;
    sellerName?: string;
  };
  requiresUserVerification: boolean;
  verificationNotice: string;
}
