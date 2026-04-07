export const IPC_CHANNELS = {
  // Auth
  AUTH_REGISTER: 'auth:register',
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_GET_SESSION: 'auth:get-session',
  AUTH_CHANGE_PASSWORD: 'auth:change-password',
  AUTH_DELETE_ACCOUNT: 'auth:delete-account',

  // Invoice
  INVOICE_CREATE: 'invoice:create',
  INVOICE_UPDATE: 'invoice:update',
  INVOICE_DELETE: 'invoice:delete',
  INVOICE_GET_ALL: 'invoice:get-all',
  INVOICE_GET: 'invoice:get',
  INVOICE_DUPLICATE: 'invoice:duplicate',
  INVOICE_UPDATE_STATUS: 'invoice:update-status',

  // Client
  CLIENT_CREATE: 'client:create',
  CLIENT_UPDATE: 'client:update',
  CLIENT_DELETE: 'client:delete',
  CLIENT_GET_ALL: 'client:get-all',

  // PDF
  PDF_EXPORT: 'pdf:export',
  PDF_EXPORT_BATCH: 'pdf:export-batch',
  PDF_PRINT: 'pdf:print',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Backup
  BACKUP_EXPORT: 'backup:export',
  BACKUP_IMPORT: 'backup:import',

  // CSV
  CSV_SAVE: 'csv:save',

  // Expense
  EXPENSE_CREATE: 'expense:create',
  EXPENSE_UPDATE: 'expense:update',
  EXPENSE_DELETE: 'expense:delete',
  EXPENSE_GET_ALL: 'expense:get-all',

  // Report
  REPORT_EXPORT_CSV: 'report:export-csv',
  REPORT_EXPORT_PDF: 'report:export-pdf',

  // Shell
  SHELL_OPEN_EXTERNAL: 'shell:open-external',
  SHELL_SHOW_IN_FOLDER: 'shell:show-in-folder',

  // Window
  WINDOW_CLOSE: 'window:close',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',

  // App events
  APP_SHORTCUT: 'app:shortcut',
} as const;

import { AppSettings, BusinessDetails } from './types';

export const DEFAULT_BUSINESS: BusinessDetails = {
  name: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  country: '',
  email: '',
  phone: '',
  website: '',
  taxId: '',
  logo: '',
};

export const DEFAULT_SETTINGS: AppSettings = {
  taxRate: 0,
  currency: 'USD',
  currencySymbol: '$',
  theme: 'system',
  autoSaveInterval: 30,
  invoicePrefix: 'INV',
  nextInvoiceNumber: 1,
  language: 'en',
  invoiceTheme: 'auto',
  businessDetails: { ...DEFAULT_BUSINESS },
  defaultInvoiceTemplate: 'classic',
  defaultFooterText: '',
};

export const PASSWORD_MIN_LENGTH = 8;
export const SESSION_DURATION_DAYS = 30;
export const INVOICE_PAGE_SIZE = 20;
export const UNDO_STACK_LIMIT = 50;
export const AUTO_SAVE_DEBOUNCE_MS = 2000;
