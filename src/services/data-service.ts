import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import log from 'electron-log';
import { Invoice, Client, ApiResponse, InvoiceStatus } from '../shared/types';
import { generateId } from '../shared/utils';

function userDir(userId: string): string {
  const dir = path.join(app.getPath('userData'), 'users', userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── JSON file helpers ────────────────────────────────────────────────────────
function readJson<T>(filePath: string, defaultData: T): T {
  if (!fs.existsSync(filePath)) return defaultData;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return defaultData;
  }
}
function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ─── Invoices ─────────────────────────────────────────────────────────────────
function invPath(userId: string) {
  return path.join(userDir(userId), 'invoices.json');
}
function loadInvoices(userId: string): Invoice[] {
  return readJson<{ invoices: Invoice[] }>(invPath(userId), { invoices: [] }).invoices;
}
function saveInvoices(userId: string, invoices: Invoice[]): void {
  writeJson(invPath(userId), { invoices });
}

export function createInvoice(userId: string, data: Partial<Invoice>): ApiResponse<Invoice> {
  try {
    const invoices = loadInvoices(userId);
    const now = new Date().toISOString();
    const invoice: Invoice = {
      id: generateId(),
      number: data.number ?? '',
      prefix: data.prefix ?? 'INV',
      userId,
      clientId: data.clientId,
      status: data.status ?? 'draft',
      issueDate: data.issueDate ?? now.split('T')[0],
      dueDate: data.dueDate ?? '',
      poNumber: data.poNumber,
      billFrom: data.billFrom ?? { name: '', address: '', city: '', state: '', zip: '', country: '', email: '', phone: '' },
      billTo: data.billTo ?? {},
      lineItems: data.lineItems ?? [],
      discount: data.discount ?? { type: 'percent', value: 0 },
      shipping: data.shipping ?? 0,
      notes: data.notes,
      terms: data.terms,
      currency: data.currency ?? 'USD',
      currencySymbol: data.currencySymbol ?? '$',
      taxMode: data.taxMode ?? 'exclusive',
      subtotal: data.subtotal ?? 0,
      taxTotal: data.taxTotal ?? 0,
      discountAmount: data.discountAmount ?? 0,
      grandTotal: data.grandTotal ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    invoices.push(invoice);
    saveInvoices(userId, invoices);
    return { success: true, data: invoice };
  } catch (err) {
    log.error('createInvoice:', err);
    return { success: false, error: 'Failed to create invoice' };
  }
}

export function updateInvoice(
  userId: string,
  id: string,
  data: Partial<Invoice>,
): ApiResponse<Invoice> {
  try {
    const invoices = loadInvoices(userId);
    const idx = invoices.findIndex(i => i.id === id);
    if (idx === -1) return { success: false, error: 'Invoice not found' };
    invoices[idx] = { ...invoices[idx], ...data, id, userId, updatedAt: new Date().toISOString() };
    saveInvoices(userId, invoices);
    return { success: true, data: invoices[idx] };
  } catch (err) {
    log.error('updateInvoice:', err);
    return { success: false, error: 'Failed to update invoice' };
  }
}

export function deleteInvoice(userId: string, id: string): ApiResponse {
  try {
    const invoices = loadInvoices(userId);
    const filtered = invoices.filter(i => i.id !== id);
    if (filtered.length === invoices.length) return { success: false, error: 'Not found' };
    saveInvoices(userId, filtered);
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete invoice' };
  }
}

export function getAllInvoices(userId: string): ApiResponse<Invoice[]> {
  try {
    const invoices = loadInvoices(userId);
    const now = new Date();
    let dirty = false;
    invoices.forEach(inv => {
      if (inv.status === 'unpaid' && inv.dueDate && new Date(inv.dueDate) < now) {
        inv.status = 'overdue';
        dirty = true;
      }
    });
    if (dirty) saveInvoices(userId, invoices);
    return { success: true, data: invoices };
  } catch {
    return { success: false, error: 'Failed to load invoices' };
  }
}

export function getInvoice(userId: string, id: string): ApiResponse<Invoice> {
  try {
    const inv = loadInvoices(userId).find(i => i.id === id);
    if (!inv) return { success: false, error: 'Invoice not found' };
    return { success: true, data: inv };
  } catch {
    return { success: false, error: 'Failed to load invoice' };
  }
}

export function duplicateInvoice(userId: string, id: string): ApiResponse<Invoice> {
  try {
    const invoices = loadInvoices(userId);
    const original = invoices.find(i => i.id === id);
    if (!original) return { success: false, error: 'Invoice not found' };
    const now = new Date().toISOString();
    const dupe: Invoice = { ...JSON.parse(JSON.stringify(original)), id: generateId(), status: 'draft', createdAt: now, updatedAt: now };
    invoices.push(dupe);
    saveInvoices(userId, invoices);
    return { success: true, data: dupe };
  } catch {
    return { success: false, error: 'Failed to duplicate invoice' };
  }
}

export function updateInvoiceStatus(
  userId: string,
  id: string,
  status: InvoiceStatus,
): ApiResponse<Invoice> {
  return updateInvoice(userId, id, { status });
}

// ─── Clients ──────────────────────────────────────────────────────────────────
function cliPath(userId: string) {
  return path.join(userDir(userId), 'clients.json');
}
function loadClients(userId: string): Client[] {
  return readJson<{ clients: Client[] }>(cliPath(userId), { clients: [] }).clients;
}
function saveClients(userId: string, clients: Client[]): void {
  writeJson(cliPath(userId), { clients });
}

export function createClient(userId: string, data: Partial<Client>): ApiResponse<Client> {
  try {
    const clients = loadClients(userId);
    const now = new Date().toISOString();
    const client: Client = {
      id: generateId(),
      userId,
      name: data.name ?? '',
      company: data.company,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      country: data.country,
      taxId: data.taxId,
      email: data.email,
      phone: data.phone,
      createdAt: now,
      updatedAt: now,
    };
    clients.push(client);
    saveClients(userId, clients);
    return { success: true, data: client };
  } catch {
    return { success: false, error: 'Failed to create client' };
  }
}

export function updateClient(
  userId: string,
  id: string,
  data: Partial<Client>,
): ApiResponse<Client> {
  try {
    const clients = loadClients(userId);
    const idx = clients.findIndex(c => c.id === id);
    if (idx === -1) return { success: false, error: 'Client not found' };
    clients[idx] = { ...clients[idx], ...data, id, userId, updatedAt: new Date().toISOString() };
    saveClients(userId, clients);
    return { success: true, data: clients[idx] };
  } catch {
    return { success: false, error: 'Failed to update client' };
  }
}

export function deleteClient(userId: string, id: string): ApiResponse {
  try {
    const clients = loadClients(userId);
    saveClients(userId, clients.filter(c => c.id !== id));
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete client' };
  }
}

export function getAllClients(userId: string): ApiResponse<Client[]> {
  try {
    return { success: true, data: loadClients(userId) };
  } catch {
    return { success: false, error: 'Failed to load clients' };
  }
}
