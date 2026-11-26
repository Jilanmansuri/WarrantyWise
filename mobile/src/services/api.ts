import { AxiosError, create as createAxios, isAxiosError } from 'axios';
import { Platform } from 'react-native';
import {
  AmcRecord,
  CalendarEventItem,
  CostAnalysisResult,
  DashboardData,
  DocumentRecord,
  DocumentType,
  FamilyDashboardData,
  FamilyMemberRecord,
  LifecycleTimelineItem,
  MaintenanceRecord,
  NotificationPreference,
  OcrParseResult,
  Product,
  ProductHealthReport,
  QrProductIdentity,
  RepairRecord,
  ResaleSummary,
  User,
  WarrantyClaimRecord,
} from '../types';
import { getAuthToken, getCustomApiUrl } from './storage';

const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api');

let onUnauthorizedCallback: (() => void) | null = null;

export function registerUnauthorizedHandler(cb: () => void) {
  onUnauthorizedCallback = cb;
}

export async function resolveApiBaseUrl(): Promise<string> {
  const custom = await getCustomApiUrl();
  return custom || DEFAULT_API_URL;
}

export const apiClient = createAxios({
  baseURL: DEFAULT_API_URL,
  timeout: 25000,
});

apiClient.interceptors.request.use(async (config) => {
  config.baseURL = await resolveApiBaseUrl();
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { message?: string } }>) => {
    if (error.response?.status === 401 && onUnauthorizedCallback) {
      const url = error.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        onUnauthorizedCallback();
      }
    }
    return Promise.reject(error);
  }
);

export function extractErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const serverMsg = (err.response?.data as { error?: { message?: string } } | undefined)?.error
      ?.message;
    if (serverMsg) return serverMsg;
    if (err.code === 'ECONNABORTED') return 'Request timed out. Please check your server connection.';
    if (!err.response) {
      return 'Unable to reach the WarrantyWise server. Check your network or API URL in Settings.';
    }
    return `Request failed (${err.response.status}).`;
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}

export interface AuthResponse {
  token: string;
  user: User;
  notificationPreferences: NotificationPreference;
}

export const authApi = {
  async register(payload: { name: string; email: string; password: string; phone?: string }) {
    const res = await apiClient.post<{ data: AuthResponse }>('/auth/register', payload);
    return res.data.data;
  },
  async login(payload: { email: string; password: string }) {
    const res = await apiClient.post<{ data: AuthResponse }>('/auth/login', payload);
    return res.data.data;
  },
  async getMe() {
    const res = await apiClient.get<{
      data: { user: User; notificationPreferences: NotificationPreference };
    }>('/auth/me');
    return res.data.data;
  },
  async updateProfile(payload: Partial<User>) {
    const res = await apiClient.put<{ data: { user: User } }>('/auth/me', payload);
    return res.data.data.user;
  },
  async forgotPassword(email: string) {
    const res = await apiClient.post<{ data: { message: string; devResetCode?: string } }>(
      '/auth/forgot-password',
      { email }
    );
    return res.data.data;
  },
  async resetPassword(payload: { email: string; code: string; newPassword: string }) {
    const res = await apiClient.post<{ data: { message: string } }>('/auth/reset-password', payload);
    return res.data.data;
  },
  async getNotificationPreferences() {
    const res = await apiClient.get<{ data: NotificationPreference }>('/auth/notifications');
    return res.data.data;
  },
  async updateNotificationPreferences(payload: Partial<NotificationPreference>) {
    const res = await apiClient.put<{ data: NotificationPreference }>('/auth/notifications', payload);
    return res.data.data;
  },
};

export const dashboardApi = {
  async getStats() {
    const res = await apiClient.get<{ data: DashboardData }>('/dashboard/stats');
    return res.data.data;
  },
  async getUpcomingExpiries(days = 30) {
    const res = await apiClient.get<{ data: Product[] }>('/dashboard/upcoming-expiries', {
      params: { days },
    });
    return res.data.data;
  },
};

export interface ProductInput {
  productName: string;
  brand: string;
  modelNumber?: string;
  serialNumber?: string;
  category: string;
  purchaseDate: string;
  purchasePrice?: number;
  currency?: string;
  sellerName?: string;
  invoiceNumber?: string;
  warrantyDurationMonths: number;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
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
  lifecycleStatus?: string;
  resalePrice?: number;
  resaleDate?: string;
  resaleBuyerName?: string;
  disposalDate?: string;
  disposalMethod?: string;
  disposalNotes?: string;
  familyMemberId?: string | null;
  sharedWithFamily?: boolean;
  clientMutationId?: string;
  version?: number;
  productImageUrl?: string;
  productImageDocumentId?: string;
  invoiceDocumentId?: string;
  additionalNotes?: string;
}

export const productsApi = {
  async list(params?: {
    search?: string;
    category?: string;
    status?: string;
    familyMemberId?: string;
    sort?: string;
  }) {
    const res = await apiClient.get<{ data: Product[] }>('/products', { params });
    return res.data.data;
  },
  async getById(id: string) {
    const res = await apiClient.get<{ data: Product }>(`/products/${id}`);
    return res.data.data;
  },
  async create(payload: ProductInput) {
    const res = await apiClient.post<{ data: Product }>('/products', payload);
    return res.data.data;
  },
  async update(id: string, payload: Partial<ProductInput>) {
    const res = await apiClient.put<{ data: Product }>(`/products/${id}`, payload);
    return res.data.data;
  },
  async remove(id: string) {
    await apiClient.delete(`/products/${id}`);
  },
  async getLifecycle(id: string) {
    const res = await apiClient.get<{ data: LifecycleTimelineItem[] }>(`/products/${id}/lifecycle`);
    return res.data.data;
  },
  async getCostAnalysis(id: string) {
    const res = await apiClient.get<{ data: CostAnalysisResult }>(`/products/${id}/cost-analysis`);
    return res.data.data;
  },
  async getHealthScore(id: string) {
    const res = await apiClient.get<{ data: ProductHealthReport }>(`/products/${id}/health-score`);
    return res.data.data;
  },
  async getResaleSummary(id: string) {
    const res = await apiClient.get<{ data: ResaleSummary }>(`/products/${id}/resale-summary`);
    return res.data.data;
  },
  async regenerateQr(id: string) {
    const res = await apiClient.post<{ data: { qrToken: string; qrGeneratedAt: string } }>(
      `/products/${id}/qr/regenerate`
    );
    return res.data.data;
  },
  async lookupByQr(qrToken: string) {
    const res = await apiClient.get<{ data: QrProductIdentity }>(
      `/products/qr/${encodeURIComponent(qrToken)}`
    );
    return res.data.data;
  },
};

export interface RepairInput {
  productId: string;
  repairDate: string;
  problemDescription: string;
  repairCenter: string;
  repairCost?: number;
  repairStatus: string;
  repairInvoiceDocumentId?: string;
  repairInvoiceUrl?: string;
  additionalNotes?: string;
}

export const repairsApi = {
  async listAll() {
    const res = await apiClient.get<{ data: RepairRecord[] }>('/repairs');
    return res.data.data;
  },
  async listByProduct(productId: string) {
    const res = await apiClient.get<{ data: RepairRecord[] }>(`/repairs/${productId}`);
    return res.data.data;
  },
  async create(payload: RepairInput) {
    const res = await apiClient.post<{ data: RepairRecord }>('/repairs', payload);
    return res.data.data;
  },
  async update(id: string, payload: Partial<Omit<RepairInput, 'productId'>>) {
    const res = await apiClient.put<{ data: RepairRecord }>(`/repairs/${id}`, payload);
    return res.data.data;
  },
  async remove(id: string) {
    await apiClient.delete(`/repairs/${id}`);
  },
};

export interface FileUploadAsset {
  uri: string;
  name: string;
  mimeType: string;
}

export const documentsApi = {
  async list(params?: { productId?: string; type?: string; search?: string }) {
    const res = await apiClient.get<{ data: DocumentRecord[] }>('/documents', { params });
    return res.data.data;
  },
  async upload(params: {
    file: FileUploadAsset;
    title: string;
    type: DocumentType;
    productId?: string;
    repairId?: string;
    amcId?: string;
    claimId?: string;
  }) {
    const form = new FormData();
    form.append('file', {
      uri: params.file.uri,
      name: params.file.name,
      type: params.file.mimeType,
    } as unknown as Blob);
    form.append('title', params.title);
    form.append('type', params.type);
    if (params.productId) form.append('productId', params.productId);
    if (params.repairId) form.append('repairId', params.repairId);
    if (params.amcId) form.append('amcId', params.amcId);
    if (params.claimId) form.append('claimId', params.claimId);

    const res = await apiClient.post<{ data: DocumentRecord }>('/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 45000,
    });
    return res.data.data;
  },
  async remove(id: string) {
    await apiClient.delete(`/documents/${id}`);
  },
  async getDownloadUrl(id: string) {
    const base = await resolveApiBaseUrl();
    return `${base}/documents/${id}/download`;
  },
};

export const ocrApi = {
  async parseInvoiceImage(file: FileUploadAsset) {
    const form = new FormData();
    form.append('image', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);

    const res = await apiClient.post<{ data: OcrParseResult }>('/ocr/parse-invoice', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return res.data.data;
  },
  async parseRawText(rawText: string) {
    const res = await apiClient.post<{ data: OcrParseResult }>('/ocr/parse-invoice', { rawText });
    return res.data.data;
  },
};

export interface AmcInput {
  productId: string;
  contractNumber?: string;
  providerName: string;
  providerPhone?: string;
  providerEmail?: string;
  startDate: string;
  endDate: string;
  cost?: number;
  visitFrequencyMonths?: number;
  scheduledVisitsCount?: number;
  completedVisitsCount?: number;
  nextVisitDate?: string;
  contractDocumentId?: string;
  notes?: string;
  statusOverride?: 'Active' | 'Cancelled';
}

export const amcApi = {
  async list(params?: { productId?: string; status?: string }) {
    const res = await apiClient.get<{ data: AmcRecord[] }>('/amc', { params });
    return res.data.data;
  },
  async create(payload: AmcInput) {
    const res = await apiClient.post<{ data: AmcRecord }>('/amc', payload);
    return res.data.data;
  },
  async update(id: string, payload: Partial<Omit<AmcInput, 'productId'>>) {
    const res = await apiClient.put<{ data: AmcRecord }>(`/amc/${id}`, payload);
    return res.data.data;
  },
  async logVisit(id: string) {
    const res = await apiClient.post<{ data: AmcRecord }>(`/amc/${id}/visit`);
    return res.data.data;
  },
  async remove(id: string) {
    await apiClient.delete(`/amc/${id}`);
  },
};

export interface MaintenanceInput {
  productId: string;
  title: string;
  serviceType?: string;
  frequencyMonths?: number;
  lastServiceDate?: string;
  nextServiceDate: string;
  serviceProvider?: string;
  estimatedCost?: number;
  notes?: string;
  status?: string;
  version?: number;
  clientMutationId?: string;
}

export const maintenanceApi = {
  async list(params?: { productId?: string; status?: string }) {
    const res = await apiClient.get<{ data: MaintenanceRecord[] }>('/maintenance', { params });
    return res.data.data;
  },
  async create(payload: MaintenanceInput) {
    const res = await apiClient.post<{ data: MaintenanceRecord }>('/maintenance', payload);
    return res.data.data;
  },
  async update(id: string, payload: Partial<Omit<MaintenanceInput, 'productId'>>) {
    const res = await apiClient.put<{ data: MaintenanceRecord }>(`/maintenance/${id}`, payload);
    return res.data.data;
  },
  async complete(
    id: string,
    payload: {
      completedAt?: string;
      cost?: number;
      serviceProvider?: string;
      notes?: string;
      clientMutationId?: string;
    }
  ) {
    const res = await apiClient.post<{ data: MaintenanceRecord }>(
      `/maintenance/${id}/complete`,
      payload
    );
    return res.data.data;
  },
  async remove(id: string) {
    await apiClient.delete(`/maintenance/${id}`);
  },
};

export interface ClaimInput {
  productId: string;
  claimReferenceNumber?: string;
  manufacturerOrCenter: string;
  contactPhone?: string;
  contactEmail?: string;
  issueSummary: string;
  status?: string;
  supportingDocumentIds?: string[];
  checklist?: { key: string; label: string; required: boolean; completed: boolean }[];
  notes?: string;
}

export const claimsApi = {
  async list(params?: { productId?: string; status?: string }) {
    const res = await apiClient.get<{ data: WarrantyClaimRecord[]; disclaimer: string }>('/claims', {
      params,
    });
    return res.data;
  },
  async prepare(productId: string) {
    const res = await apiClient.get<{
      data: {
        productId: string;
        productName: string;
        brand: string;
        warrantyMetrics: Product['warrantyMetrics'];
        requiredDocuments: string[];
        checklist: WarrantyClaimRecord['checklist'];
        disclaimer: string;
      };
    }>(`/claims/prepare/${productId}`);
    return res.data.data;
  },
  async create(payload: ClaimInput) {
    const res = await apiClient.post<{ data: WarrantyClaimRecord; disclaimer: string }>(
      '/claims',
      payload
    );
    return res.data;
  },
  async update(id: string, payload: Partial<Omit<ClaimInput, 'productId'>>) {
    const res = await apiClient.put<{ data: WarrantyClaimRecord; disclaimer: string }>(
      `/claims/${id}`,
      payload
    );
    return res.data;
  },
  async remove(id: string) {
    await apiClient.delete(`/claims/${id}`);
  },
};

export const familyApi = {
  async getDashboard() {
    const res = await apiClient.get<{ data: FamilyDashboardData }>('/family');
    return res.data.data;
  },
  async addMember(payload: {
    name: string;
    relationship: string;
    email?: string;
    permissions?: FamilyMemberRecord['permissions'];
    notes?: string;
  }) {
    const res = await apiClient.post<{ data: FamilyMemberRecord }>('/family/members', payload);
    return res.data.data;
  },
  async updateMember(
    id: string,
    payload: Partial<{
      name: string;
      relationship: string;
      email: string;
      permissions: FamilyMemberRecord['permissions'];
      notes: string;
    }>
  ) {
    const res = await apiClient.put<{ data: FamilyMemberRecord }>(`/family/members/${id}`, payload);
    return res.data.data;
  },
  async removeMember(id: string) {
    await apiClient.delete(`/family/members/${id}`);
  },
  async assignProduct(payload: {
    productId: string;
    familyMemberId?: string | null;
    sharedWithFamily?: boolean;
  }) {
    const res = await apiClient.post('/family/assign', payload);
    return res.data.data;
  },
};

export const calendarApi = {
  async getEvents(params?: { from?: string; to?: string }) {
    const res = await apiClient.get<{ data: CalendarEventItem[] }>('/calendar', { params });
    return res.data.data;
  },
};
