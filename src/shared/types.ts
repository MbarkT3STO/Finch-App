// ─── User & Auth ─────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  email?: string;
  hash: string;
  salt: string;
  createdAt: string;
  lastLogin: string;
}

export interface Session {
  userId: string;
  username: string;
  token: string;
  expiresAt: string;
}

// ─── Business ─────────────────────────────────────────────────────────────────
export interface BusinessDetails {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  email: string;
  phone: string;
  website?: string;
  taxId?: string;
  logo?: string; // base64 data URI
}

// ─── Client ───────────────────────────────────────────────────────────────────
export interface Client {
  id: string;
  userId: string;
  name: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Invoice ──────────────────────────────────────────────────────────────────
export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

export type InvoiceStatus = 'draft' | 'unpaid' | 'paid' | 'overdue' | 'cancelled';

export interface Discount {
  type: 'percent' | 'fixed';
  value: number;
}

export interface Invoice {
  id: string;
  number: string;
  prefix: string;
  userId: string;
  clientId?: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  poNumber?: string;
  billFrom: BusinessDetails;
  billTo: Partial<Client>;
  lineItems: LineItem[];
  discount: Discount;
  shipping: number;
  notes?: string;
  terms?: string;
  currency: string;
  currencySymbol: string;
  taxMode: 'inclusive' | 'exclusive';
  subtotal: number;
  taxTotal: number;
  discountAmount: number;
  grandTotal: number;
  createdAt: string;
  updatedAt: string;
  template?: 'classic' | 'modern' | 'minimal';
  footerText?: string;
}

// ─── Expense ──────────────────────────────────────────────────────────────────
export interface Expense {
  id: string;
  userId: string;
  date: string;          // ISO 8601 date (YYYY-MM-DD)
  amount: number;        // >= 0
  category: string;      // non-empty
  description: string;   // non-empty
  createdAt: string;
  updatedAt: string;
}

export type ForecastPeriod = string; // "YYYY-MM"

export interface ForecastResult {
  period: ForecastPeriod;
  amount: number;        // >= 0
}

export interface TaxSummaryRow {
  month: number;         // 1-12
  label: string;         // "Jan" … "Dec"
  totalInvoiced: number;
  taxTotal: number;
  net: number;
}

export interface TaxSummary {
  year: number;
  rows: TaxSummaryRow[];
  annualTotalInvoiced: number;
  annualTaxTotal: number;
  annualNet: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export interface AppSettings {
  taxRate: number;
  currency: string;
  currencySymbol: string;
  theme: 'light' | 'dark' | 'system';
  autoSaveInterval: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  businessDetails: BusinessDetails;
  defaultInvoiceTemplate?: 'classic' | 'modern' | 'minimal';
  defaultFooterText?: string;
}

// ─── API Responses ────────────────────────────────────────────────────────────
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Window API (window.finchAPI) ─────────────────────────────────────────────
export interface FinchAPI {
  auth: {
    register(data: { username: string; email?: string; password: string }): Promise<ApiResponse<{ userId: string; username: string }>>;
    login(data: { username: string; password: string }): Promise<ApiResponse<Session>>;
    logout(): Promise<ApiResponse>;
    getSession(): Promise<ApiResponse<Session>>;
    changePassword(data: { currentPassword: string; newPassword: string }): Promise<ApiResponse>;
    deleteAccount(data: { password: string }): Promise<ApiResponse>;
  };
  invoice: {
    create(data: Partial<Invoice>): Promise<ApiResponse<Invoice>>;
    update(data: { id: string; invoice: Partial<Invoice> }): Promise<ApiResponse<Invoice>>;
    delete(id: string): Promise<ApiResponse>;
    getAll(): Promise<ApiResponse<Invoice[]>>;
    get(id: string): Promise<ApiResponse<Invoice>>;
    duplicate(id: string): Promise<ApiResponse<Invoice>>;
    updateStatus(data: { id: string; status: InvoiceStatus }): Promise<ApiResponse<Invoice>>;
  };
  client: {
    create(data: Partial<Client>): Promise<ApiResponse<Client>>;
    update(data: { id: string; client: Partial<Client> }): Promise<ApiResponse<Client>>;
    delete(id: string): Promise<ApiResponse>;
    getAll(): Promise<ApiResponse<Client[]>>;
  };
  pdf: {
    export(data: { invoiceId: string }): Promise<ApiResponse<string>>;
    exportBatch(data: { invoiceIds: string[] }): Promise<ApiResponse<string>>;
    print(invoiceId: string): Promise<ApiResponse>;
  };
  settings: {
    get(): Promise<ApiResponse<AppSettings>>;
    set(data: Partial<AppSettings>): Promise<ApiResponse<AppSettings>>;
  };
  backup: {
    export(): Promise<ApiResponse<string>>;
    import(): Promise<ApiResponse>;
  };
  csv: {
    save(data: { csv: string; defaultName: string }): Promise<ApiResponse<string>>;
  };
  expense: {
    create(data: Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Expense>>;
    update(data: { id: string; expense: Partial<Expense> }): Promise<ApiResponse<Expense>>;
    delete(id: string): Promise<ApiResponse>;
    getAll(): Promise<ApiResponse<Expense[]>>;
  };
  report: {
    exportCsv(data: { csv: string; defaultName: string }): Promise<ApiResponse<string>>;
    exportPdf(data: { html: string; defaultName: string }): Promise<ApiResponse<string>>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
    showItemInFolder(path: string): Promise<void>;
  };
  window: {
    close(): void;
    minimize(): void;
    maximize(): void;
  };
  on(channel: string, callback: (...args: unknown[]) => void): void;
  off(channel: string, callback: (...args: unknown[]) => void): void;
}
