import axios, { AxiosError } from 'axios';
import { Platform } from 'react-native';
import {
  DashboardData,
  DocumentRecord,
  DocumentType,
  NotificationPreference,
  OcrParseResult,
  Product,
  RepairRecord,
  User,
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

export const apiClient = axios.create({
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
  if (axios.isAxiosError(err)) {
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
  productImageUrl?: string;
  productImageDocumentId?: string;
  invoiceDocumentId?: string;
  additionalNotes?: string;
}

export const productsApi = {
  async list(params?: { search?: string; category?: string; status?: string; sort?: string }) {
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
    const res = await apiClient.delete(`/products/${id}`);
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
