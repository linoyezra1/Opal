// API Configuration and Helpers for Opal ERP

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export interface ApiError {
  message: string;
  status: number;
}

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem('opal_admin_token') 
    : null;
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const error: ApiError = {
      message: `API Error: ${response.statusText}`,
      status: response.status,
    };
    throw error;
  }
  
  return response.json();
}

// Type definitions based on the original code
export interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  bankName?: string;
  bankNum?: string;
  accountHolder?: string;
  branchNum?: string;
  accountNum?: string;
  productLinks?: VendorProductLink[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorProductLink {
  productId: string;
  vendorCost: number;
}

export interface Agent {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  idNumber?: string;
  bankName?: string;
  bankNum?: string;
  branchNum?: string;
  accountNum?: string;
  accountHolder?: string;
  commissions?: AgentCommission[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentCommission {
  productId: string;
  commissionAmount: number;
}

export interface PriceListLine {
  vendorId: string;
  productId: string;
  retailPrice: number;
  defaultAgentCommission: number;
  vendorCost?: number;
  profitBeforeAgent?: number;
  netProfit?: number;
}

export interface LandingPageContent {
  title: string;
  subtitle: string;
  content: string;
  subContent: string;
  imageUrl?: string;
}

export interface PriceList {
  id: string;
  name: string;
  organizationName?: string;
  lines: PriceListLine[];
  landingUrl?: string;
  landingPageContent?: LandingPageContent;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Contact/Lead type with source differentiation
export interface Contact {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  category: 'individual' | 'organization';
  organizationName?: string;
  status: 'new' | 'in_progress' | 'handled';
  adminNotes: string;
  isActive: boolean;
  createdAt: string;
}

export interface Beneficiary {
  id: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  birthDate?: string;
  phone?: string;
  relationship?: string;
}

export interface SubscriberDocuments {
  beneficiariesCompleted: boolean;
  beneficiariesCount: number;
  contractSigned: boolean;
  contractSignedAt?: string;
  idDocumentUploaded: boolean;
  medicalFormCompleted: boolean;
  paymentVerified: boolean;
}

export interface Subscriber {
  id: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  birthDate?: string;
  productId: string;
  productName?: string;
  agentId?: string;
  agentName?: string;
  organizationName?: string;
  priceListId?: string;
  priceListName?: string;
  revenue: number;
  vendorCost: number;
  agentCommission: number;
  netProfit: number;
  status: 'active' | 'pending' | 'cancelled';
  documents?: SubscriberDocuments;
  beneficiaries?: Beneficiary[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalNetProfit: number;
  dealCount: number;
  activeSubscribers: number;
}

// API endpoint helpers
export const api = {
  // Products
  getProducts: () => apiRequest<Product[]>('/api/products'),
  getProduct: (id: string) => apiRequest<Product>(`/api/products/${id}`),
  createProduct: (data: Partial<Product>) => 
    apiRequest<Product>('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Partial<Product>) => 
    apiRequest<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: string) => 
    apiRequest<void>(`/api/products/${id}`, { method: 'DELETE' }),

  // Vendors
  getVendors: () => apiRequest<Vendor[]>('/api/vendors'),
  getVendor: (id: string) => apiRequest<Vendor>(`/api/vendors/${id}`),
  createVendor: (data: Partial<Vendor>) => 
    apiRequest<Vendor>('/api/vendors', { method: 'POST', body: JSON.stringify(data) }),
  updateVendor: (id: string, data: Partial<Vendor>) => 
    apiRequest<Vendor>(`/api/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVendor: (id: string) => 
    apiRequest<void>(`/api/vendors/${id}`, { method: 'DELETE' }),

  // Agents
  getAgents: () => apiRequest<Agent[]>('/api/agents'),
  getAgent: (id: string) => apiRequest<Agent>(`/api/agents/${id}`),
  createAgent: (data: Partial<Agent>) => 
    apiRequest<Agent>('/api/agents', { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id: string, data: Partial<Agent>) => 
    apiRequest<Agent>(`/api/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAgent: (id: string) => 
    apiRequest<void>(`/api/agents/${id}`, { method: 'DELETE' }),

  // Price Lists
  getPriceLists: () => apiRequest<PriceList[]>('/api/price-lists'),
  getPriceList: (id: string) => apiRequest<PriceList>(`/api/price-lists/${id}`),
  createPriceList: (data: Partial<PriceList>) => 
    apiRequest<PriceList>('/api/price-lists', { method: 'POST', body: JSON.stringify(data) }),
  updatePriceList: (id: string, data: Partial<PriceList>) => 
    apiRequest<PriceList>(`/api/price-lists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePriceList: (id: string) => 
    apiRequest<void>(`/api/price-lists/${id}`, { method: 'DELETE' }),

  // Subscribers
  getSubscribers: (filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters)}` : '';
    return apiRequest<Subscriber[]>(`/api/subscribers${params}`);
  },
  getSubscriber: (id: string) => apiRequest<Subscriber>(`/api/subscribers/${id}`),
  getDashboardStats: () => apiRequest<DashboardStats>('/api/dashboard/stats'),
};
