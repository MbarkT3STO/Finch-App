import type { Invoice, Client, LineItem, AppSettings } from '../../shared/types';
import { generateId, calculateTotals, formatCurrency, todayISO, addDaysISO, debounce, deepClone } from '../../shared/utils';
import { showToast, setLoading, escapeHtml, createCustomSelect } from './ui-utils';
import { generatePreviewHtml } from './pdf-generator';
import { resolveInvoiceTheme } from '../../shared/theme-resolver';
import { t } from './i18n';

let invoice: Partial<Invoice> = {};
let settings: AppSettings | null = null;
let allClients: Client[] = [];
let isDirty = false;
let isSaving = false;
let previewIframe: HTMLIFrameElement | null = null;
let navigate: (r: string) => void = () => {};

// Undo/Redo
let history: string[] = [];
let historyIdx = -1;

export function initInvoiceEditor(container: HTMLElement, invoiceId: string | null, nav: (r: string) => void): void {
  navigate = nav;
  invoice = {};
  isDirty = false;
  history = [];
  historyIdx = -1;

  container.innerHTML = buildEditorShell(invoiceId);
  setupEditorEvents(invoiceId);
}

function buildEditorShell(invoiceId: string | null): string {
  const titleKey = invoiceId ? 'invoices.edit_title' : 'invoices.new_title';
  return `
  <div class="view-container" id="editor-view">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:1px solid var(--border);flex-shrink:0">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" id="editor-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          <span data-i18n="nav.invoices">${t('nav.invoices')}</span>
        </button>
        <span style="color:var(--border-strong)">|</span>
        <span id="editor-title" style="font-weight:600;font-size:0.9375rem" data-i18n="${titleKey}">${t(titleKey)}</span>
        <div class="autosave-indicator" id="autosave-ind">
          <div class="autosave-dot"></div>
          <span data-i18n="status.draft">${t('status.draft')}</span>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" id="undo-btn" title="${t('invoices.undo')}" data-i18n-title="invoices.undo" disabled>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
        </button>
        <button class="btn btn-secondary btn-sm" id="redo-btn" title="${t('invoices.redo')}" data-i18n-title="invoices.redo" disabled>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13"/></svg>
        </button>
        <button class="btn btn-secondary btn-sm" id="save-draft-btn"><span class="btn-label" data-i18n="invoices.save_draft">${t('invoices.save_draft')}</span></button>
        <button class="btn btn-secondary btn-sm" id="toggle-preview-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          <span class="btn-label" data-i18n="invoices.show_preview" id="toggle-preview-label">Show Preview</span>
        </button>
        <button class="btn btn-highlight" id="export-pdf-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          <span class="btn-label" data-i18n="invoices.export_pdf">${t('invoices.export_pdf')}</span>
        </button>
      </div>
    </div>

    <div class="editor-shell preview-hidden" id="editor-shell-wrap" style="flex:1;overflow:hidden">
      <!-- Left: Form -->
      <div class="editor-form-panel" id="editor-form">
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:20px;color:var(--text-tertiary)">
          <div class="skeleton" style="width:100%;height:400px;border-radius:12px"></div>
        </div>
      </div>

      <!-- Right: Preview -->
      <div class="editor-preview-panel">
        <div class="preview-label" data-i18n="invoices.live_preview">${t('invoices.live_preview')}</div>
        <div class="preview-frame">
          <iframe id="preview-iframe" title="${t('invoices.live_preview')}" data-i18n-title="invoices.live_preview"></iframe>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
        <div id="status-select-container" style="width:140px"></div>
          <button class="btn btn-secondary btn-sm" id="print-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span data-i18n="invoices.print">${t('invoices.print')}</span>
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

async function setupEditorEvents(invoiceId: string | null): Promise<void> {
  previewIframe = document.getElementById('preview-iframe') as HTMLIFrameElement;

  // Load dependencies in parallel
  const [settingsResult, clientsResult] = await Promise.all([
    window.finchAPI.settings.get(),
    window.finchAPI.client.getAll(),
  ]);

  if (settingsResult.success && settingsResult.data) settings = settingsResult.data;
  if (clientsResult.success && clientsResult.data) allClients = clientsResult.data;

  // Load existing invoice or bootstrap new
  if (invoiceId) {
    const r = await window.finchAPI.invoice.get(invoiceId);
    if (r.success && r.data) {
      invoice = deepClone(r.data);
      document.getElementById('editor-title')!.textContent = `${t('invoices.details')} ${invoice.number ?? ''}`;
    } else {
      showToast(r.error ?? t('common.error'), 'error');
      navigate('#/invoices');
      return;
    }
  } else {
    // Defaults for new invoice
    const yr = new Date().getFullYear();
    const num = settings?.nextInvoiceNumber ?? 1;
    const prefix = settings?.invoicePrefix ?? 'INV';
    invoice = {
      number: `${prefix}-${yr}-${String(num).padStart(4, '0')}`,
      prefix,
      status: 'draft',
      issueDate: todayISO(),
      dueDate: addDaysISO(todayISO(), 30),
      currency: settings?.currency ?? 'USD',
      currencySymbol: settings?.currencySymbol ?? '$',
      taxMode: 'exclusive',
      discount: { type: 'percent', value: 0 },
      shipping: 0,
      lineItems: [],
      billFrom: settings?.businessDetails ? { ...settings.businessDetails } : { name: '', address: '', city: '', state: '', zip: '', country: '', email: '', phone: '' },
      billTo: {},
      subtotal: 0, taxTotal: 0, discountAmount: 0, grandTotal: 0,
      template: settings?.defaultInvoiceTemplate ?? 'classic',
      footerText: settings?.defaultFooterText ?? '',
    };
  }

  renderForm();
  pushHistory();
  updatePreview();

  // Set status select
  createCustomSelect(document.getElementById('status-select-container')!, {
    id: 'status-select',
    options: [
      { label: t('status.draft'), value: 'draft' },
      { label: t('status.unpaid'), value: 'unpaid' },
      { label: t('status.paid'), value: 'paid' },
      { label: t('status.overdue'), value: 'overdue' },
      { label: t('status.cancelled'), value: 'cancelled' }
    ],
    initialValue: invoice.status || 'draft',
    onChange: (val) => {
      invoice.status = val as any;
      updatePreview();
    }
  });

  // Back button
  document.getElementById('editor-back-btn')?.addEventListener('click', () => navigate('#/invoices'));

  // Save
  document.getElementById('save-draft-btn')?.addEventListener('click', () => saveInvoice());

  let isPreviewVisible = false;
  document.getElementById('toggle-preview-btn')?.addEventListener('click', () => {
    isPreviewVisible = !isPreviewVisible;
    const shellWrap = document.getElementById('editor-shell-wrap');
    if (shellWrap) {
      if (isPreviewVisible) {
        shellWrap.classList.remove('preview-hidden');
        document.getElementById('toggle-preview-label')!.textContent = 'Hide Preview';
      } else {
        shellWrap.classList.add('preview-hidden');
        document.getElementById('toggle-preview-label')!.textContent = 'Show Preview';
      }
    }
  });

  // PDF
  document.getElementById('export-pdf-btn')?.addEventListener('click', async () => {
    if (!invoice.id) {
      const saved = await saveInvoice();
      if (!saved) return;
    }
    const btn = document.getElementById('export-pdf-btn') as HTMLButtonElement;
    setLoading(btn, true);
    const r = await window.finchAPI.pdf.export({ invoiceId: invoice.id! });
    setLoading(btn, false);
    if (r.success) { 
      showToast(t('invoices.pdf_saved_toast'), 'success'); 
      window.finchAPI.shell.showItemInFolder(r.data!); 
    }
    else showToast(r.error ?? t('common.error'), 'error');
  });

  // Print
  document.getElementById('print-btn')?.addEventListener('click', () => window.print());

  // Undo/Redo
  document.getElementById('undo-btn')?.addEventListener('click', undo);
  document.getElementById('redo-btn')?.addEventListener('click', redo);

  // Auto-save
  const autoSave = debounce(async () => {
    if (isDirty && !isSaving) await saveInvoice(true);
  }, (settings?.autoSaveInterval ?? 30) * 1000);

  document.addEventListener('input', () => { isDirty = true; autoSave(); });
}

// ─── Form rendering ──────────────────────────────────────────────────────────
function renderForm(): void {
  const panel = document.getElementById('editor-form')!;
  const bf = invoice.billFrom ?? { name: '', address: '', city: '', state: '', zip: '', country: '', email: '', phone: '' };
  const bt = invoice.billTo ?? {};
  const sym = invoice.currencySymbol ?? '$';

  panel.innerHTML = `
  <!-- Invoice Details -->
  <div class="section">
    <div class="section-header"><h3 data-i18n="invoices.details">${t('invoices.details')}</h3></div>
    <div class="section-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="invoices.number">${t('invoices.number')}</label>
          <input class="form-input mono" id="f-number" value="${esc(invoice.number ?? '')}" placeholder="INV-2025-0001">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="settings.invoice_prefix">${t('settings.invoice_prefix')}</label>
          <input class="form-input" id="f-prefix" value="${esc(invoice.prefix ?? 'INV')}" placeholder="INV" style="max-width:90px">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="invoices.po_number">${t('invoices.po_number')}</label>
          <input class="form-input" id="f-po" value="${esc(invoice.poNumber ?? '')}" placeholder="${t('invoices.optional')}" data-i18n-placeholder="invoices.optional">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="invoices.issue_date">${t('invoices.issue_date')}</label>
          <input class="form-input" id="f-issue" type="date" value="${invoice.issueDate ?? todayISO()}">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="invoices.due_date">${t('invoices.due_date')}</label>
          <input class="form-input" id="f-due" type="date" value="${invoice.dueDate ?? ''}">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="invoices.currency">${t('invoices.currency')}</label>
          <div id="f-currency-container"></div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="invoices.tax_mode">${t('invoices.tax_mode')}</label>
          <div id="f-taxmode-container"></div>
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="invoices.template">${t('invoices.template')}</label>
          <div id="f-template-container"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Bill From -->
  <div class="section">
    <div class="section-header"><h3 data-i18n="invoices.bill_from">${t('invoices.bill_from')}</h3></div>
    <div class="section-body">
      <div class="form-row">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label" data-i18n="settings.business_name">${t('settings.business_name')}</label>
          <input class="form-input" id="f-from-name" value="${esc(bf.name)}" placeholder="${t('settings.business_name')}" data-i18n-placeholder="settings.business_name">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="settings.email">${t('settings.email')}</label>
          <input class="form-input" id="f-from-email" type="email" value="${esc(bf.email)}" placeholder="you@company.com">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="settings.phone">${t('settings.phone')}</label>
          <input class="form-input" id="f-from-phone" value="${esc(bf.phone)}" placeholder="+1 555 0100">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="settings.address">${t('settings.address')}</label>
        <input class="form-input" id="f-from-addr" value="${esc(bf.address)}" placeholder="123 Main St">
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label" data-i18n="settings.city">${t('settings.city')}</label><input class="form-input" id="f-from-city" value="${esc(bf.city)}" placeholder="${t('settings.city')}" data-i18n-placeholder="settings.city"></div>
        <div class="form-group"><label class="form-label" data-i18n="settings.state">${t('settings.state')}</label><input class="form-input" id="f-from-state" value="${esc(bf.state)}" placeholder="${t('settings.state')}" data-i18n-placeholder="settings.state"></div>
        <div class="form-group"><label class="form-label" data-i18n="settings.zip">${t('settings.zip')}</label><input class="form-input" id="f-from-zip" value="${esc(bf.zip)}" placeholder="${t('settings.zip')}" data-i18n-placeholder="settings.zip"></div>
        <div class="form-group"><label class="form-label" data-i18n="settings.country">${t('settings.country')}</label><input class="form-input" id="f-from-country" value="${esc(bf.country)}" placeholder="${t('settings.country')}" data-i18n-placeholder="settings.country"></div>
      </div>
    </div>
  </div>

  <!-- Bill To -->
  <div class="section">
    <div class="section-header"><h3 data-i18n="invoices.bill_to">${t('invoices.bill_to')}</h3></div>
    <div class="section-body">
      <div class="autocomplete-wrap" style="margin-bottom:12px">
        <div class="form-group">
          <label class="form-label" data-i18n="clients.name_label">${t('clients.name_label')}</label>
          <input class="form-input" id="f-to-name" value="${esc(bt.name ?? '')}" placeholder="${t('invoices.client_search_placeholder')}" data-i18n-placeholder="invoices.client_search_placeholder" autocomplete="off">
        </div>
        <div class="autocomplete-list" id="client-ac" style="display:none"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="clients.company_label">${t('clients.company_label')}</label>
          <input class="form-input" id="f-to-company" value="${esc(bt.company ?? '')}" placeholder="${t('clients.company_placeholder')}" data-i18n-placeholder="clients.company_placeholder">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="clients.email_label">${t('clients.email_label')}</label>
          <input class="form-input" id="f-to-email" type="email" value="${esc(bt.email ?? '')}" placeholder="client@example.com">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="clients.address_label">${t('clients.address_label')}</label>
        <input class="form-input" id="f-to-addr" value="${esc(bt.address ?? '')}" placeholder="${t('clients.address_placeholder')}" data-i18n-placeholder="clients.address_placeholder">
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label" data-i18n="settings.city">${t('settings.city')}</label><input class="form-input" id="f-to-city" value="${esc(bt.city ?? '')}" placeholder="${t('settings.city')}" data-i18n-placeholder="settings.city"></div>
        <div class="form-group"><label class="form-label" data-i18n="settings.state">${t('settings.state')}</label><input class="form-input" id="f-to-state" value="${esc(bt.state ?? '')}" placeholder="${t('settings.state')}" data-i18n-placeholder="settings.state"></div>
        <div class="form-group"><label class="form-label" data-i18n="settings.zip">${t('settings.zip')}</label><input class="form-input" id="f-to-zip" value="${esc(bt.zip ?? '')}" placeholder="${t('settings.zip')}" data-i18n-placeholder="settings.zip"></div>
        <div class="form-group"><label class="form-label" data-i18n="settings.country">${t('settings.country')}</label><input class="form-input" id="f-to-country" value="${esc(bt.country ?? '')}" placeholder="${t('settings.country')}" data-i18n-placeholder="settings.country"></div>
      </div>
    </div>
  </div>

  <!-- Line Items -->
  <div class="section">
    <div class="section-header"><h3 data-i18n="invoices.line_items">${t('invoices.line_items')}</h3></div>
    <div class="section-body" style="padding:12px 16px">
      <table class="line-items-table">
        <thead><tr>
          <th class="td-desc" data-i18n="invoices.description">${t('invoices.description')}</th>
          <th class="td-qty" data-i18n="invoices.qty">${t('invoices.qty')}</th>
          <th class="td-price" data-i18n="invoices.unit_price">${t('invoices.unit_price')}</th>
          <th class="td-tax" data-i18n="invoices.tax_percent">${t('invoices.tax_percent')}</th>
          <th class="td-amt" data-i18n="dashboard.amount">${t('dashboard.amount')}</th>
          <th class="td-del"></th>
        </tr></thead>
        <tbody id="line-items-body"></tbody>
      </table>
      <button class="btn btn-ghost btn-sm" id="add-line-btn" style="margin-top:10px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        <span data-i18n="invoices.add_line">${t('invoices.add_line')}</span>
      </button>
    </div>
  </div>

  <!-- Totals & Notes -->
  <div class="section">
    <div class="section-header"><h3 data-i18n="invoices.totals_notes">${t('invoices.totals_notes')}</h3></div>
    <div class="section-body">
      <div class="form-row" style="margin-bottom:12px">
        <div class="form-group">
          <label class="form-label" data-i18n="invoices.discount">${t('invoices.discount')}</label>
          <div style="display:flex;gap:6px">
            <div id="f-disc-type-container"></div>
            <input class="form-input mono" id="f-disc-val" type="number" min="0" step="0.01" value="${invoice.discount?.value ?? 0}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="invoices.shipping">${t('invoices.shipping')}</label>
          <input class="form-input mono" id="f-shipping" type="number" min="0" step="0.01" value="${invoice.shipping ?? 0}" placeholder="0.00">
        </div>
      </div>
      <div id="totals-display" class="totals-grid" style="margin-bottom:16px"></div>
      <div class="form-group">
        <label class="form-label" data-i18n="invoices.notes">${t('invoices.notes')}</label>
        <textarea class="form-textarea" id="f-notes" placeholder="${t('invoices.notes_placeholder')}" data-i18n-placeholder="invoices.notes_placeholder">${esc(invoice.notes ?? '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="invoices.terms_conditions">${t('invoices.terms_conditions')}</label>
        <textarea class="form-textarea" id="f-terms" placeholder="${t('invoices.terms_placeholder')}" data-i18n-placeholder="invoices.terms_placeholder">${esc(invoice.terms ?? '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="invoices.footer">${t('invoices.footer')}</label>
        <textarea class="form-textarea" id="f-footer" placeholder="${t('invoices.footer_placeholder')}" data-i18n-placeholder="invoices.footer_placeholder">${esc(invoice.footerText ?? '')}</textarea>
      </div>
    </div>
  </div>`;

  renderLineItems();
  renderTotals();
  bindFormEvents();
  setupClientAutocomplete();
}

function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Line items ───────────────────────────────────────────────────────────────
function renderLineItems(): void {
  const tbody = document.getElementById('line-items-body')!;
  const items = invoice.lineItems ?? [];
  const sym = invoice.currencySymbol ?? '$';

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-tertiary);padding:16px;font-size:0.875rem" data-i18n="invoices.no_items">${t('invoices.no_items')}</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((item, idx) => `
    <tr data-idx="${idx}">
      <td class="td-desc"><input class="line-input" data-field="description" data-idx="${idx}" value="${esc(item.description)}" placeholder="${t('invoices.item_desc_placeholder')}" data-i18n-placeholder="invoices.item_desc_placeholder"></td>
      <td class="td-qty"><input class="line-input mono" data-field="quantity" data-idx="${idx}" type="number" min="0" step="0.01" value="${item.quantity}"></td>
      <td class="td-price"><input class="line-input mono" data-field="unitPrice" data-idx="${idx}" type="number" min="0" step="0.01" value="${item.unitPrice}"></td>
      <td class="td-tax"><input class="line-input mono" data-field="taxRate" data-idx="${idx}" type="number" min="0" max="100" step="0.01" value="${item.taxRate}"></td>
      <td class="td-amt"><div class="line-amount">${formatCurrency(item.quantity * item.unitPrice, sym)}</div></td>
      <td class="td-del">
        <button class="btn btn-ghost btn-icon btn-sm del-line-btn" data-idx="${idx}" style="color:var(--danger)" title="${t('common.remove')}" data-i18n-title="common.remove">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </td>
    </tr>`).join('');

  // Bind line item inputs
  tbody.querySelectorAll<HTMLInputElement>('.line-input').forEach(input => {
    input.addEventListener('input', () => {
      const idx = parseInt(input.dataset.idx!, 10);
      const field = input.dataset.field as keyof LineItem;
      const items = invoice.lineItems!;
      if (field === 'description') {
        (items[idx] as any)[field] = input.value;
      } else {
        (items[idx] as any)[field] = parseFloat(input.value) || 0;
      }
      items[idx].amount = items[idx].quantity * items[idx].unitPrice;
      // Update amount cell
      const row = tbody.querySelector(`tr[data-idx="${idx}"]`);
      const amtEl = row?.querySelector('.line-amount');
      if (amtEl) amtEl.textContent = formatCurrency(items[idx].amount, invoice.currencySymbol ?? '$');
      recalculate();
    });
  });

  tbody.querySelectorAll<HTMLButtonElement>('.del-line-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      invoice.lineItems!.splice(parseInt(btn.dataset.idx!, 10), 1);
      pushHistory();
      renderLineItems();
      recalculate();
    });
  });
}

// ─── Events ───────────────────────────────────────────────────────────────────
function bindFormEvents(): void {
  const watch = (id: string, handler: (v: string) => void) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => { handler((el as HTMLInputElement).value); pushHistory(); recalculate(); });
  };

  watch('f-number',   v => { invoice.number = v; });
  watch('f-prefix',   v => { invoice.prefix = v; });
  watch('f-po',       v => { invoice.poNumber = v; });
  watch('f-issue',    v => { invoice.issueDate = v; });
  watch('f-due',      v => { invoice.dueDate = v; });
  watch('f-notes',    v => { invoice.notes = v; });
  watch('f-terms',    v => { invoice.terms = v; });
  watch('f-footer',   v => { invoice.footerText = v; });
  watch('f-disc-val', v => { if (!invoice.discount) invoice.discount = { type: 'percent', value: 0 }; invoice.discount.value = parseFloat(v) || 0; });
  watch('f-shipping', v => { invoice.shipping = parseFloat(v) || 0; });

  // Bill From
  ['name','email','phone','addr','city','state','zip','country'].forEach(f => {
    const el = document.getElementById(`f-from-${f}`) as HTMLInputElement;
    el?.addEventListener('input', () => {
      const bf = invoice.billFrom ?? { name: '', address: '', city: '', state: '', zip: '', country: '', email: '', phone: '' };
      const key = f === 'addr' ? 'address' : f;
      (bf as any)[key] = el.value;
      invoice.billFrom = bf;
      recalculate();
    });
  });

  // Bill To
  ['name','company','email','addr','city','state','zip','country'].forEach(f => {
    const el = document.getElementById(`f-to-${f}`) as HTMLInputElement;
    el?.addEventListener('input', () => {
      const bt = invoice.billTo ?? {};
      const key = f === 'addr' ? 'address' : f;
      (bt as any)[key] = el.value;
      invoice.billTo = bt;
      recalculate();
    });
  });

  // Custom selects
  const currencies = [['USD','$'],['EUR','€'],['GBP','£'],['CAD','CA$'],['AUD','A$'],['JPY','¥'],['INR','₹']];
  createCustomSelect(document.getElementById('f-currency-container')!, {
    id: 'f-currency',
    options: currencies.map(([c]) => ({ label: c, value: c })),
    initialValue: invoice.currency ?? 'USD',
    onChange: (val) => {
      invoice.currency = val;
      const sym = currencies.find(c => c[0] === val)?.[1] ?? '$';
      invoice.currencySymbol = sym;
      renderLineItems();
      pushHistory(); recalculate();
    }
  });

  createCustomSelect(document.getElementById('f-taxmode-container')!, {
    id: 'f-taxmode',
    options: [
      { label: t('invoices.exclusive'), value: 'exclusive' },
      { label: t('invoices.inclusive'), value: 'inclusive' }
    ],
    initialValue: invoice.taxMode || 'exclusive',
    onChange: (val) => {
      invoice.taxMode = val as 'inclusive' | 'exclusive';
      pushHistory(); recalculate();
    }
  });

  createCustomSelect(document.getElementById('f-template-container')!, {
    id: 'f-template',
    options: [
      { label: t('invoices.classic'), value: 'classic' },
      { label: t('invoices.modern'), value: 'modern' },
      { label: t('invoices.minimal'), value: 'minimal' }
    ],
    initialValue: invoice.template || 'classic',
    onChange: (val) => {
      invoice.template = val as 'classic' | 'modern' | 'minimal';
      pushHistory(); recalculate();
    }
  });

  createCustomSelect(document.getElementById('f-disc-type-container')!, {
    id: 'f-disc-type',
    options: [
      { label: t('invoices.percent'), value: 'percent' },
      { label: t('invoices.fixed'), value: 'fixed' }
    ],
    initialValue: invoice.discount?.type || 'percent',
    onChange: (val) => {
      if (!invoice.discount) invoice.discount = { type: 'percent', value: 0 };
      invoice.discount.type = val as 'percent' | 'fixed';
      pushHistory(); recalculate();
    }
  });

  // Add line button
  document.getElementById('add-line-btn')?.addEventListener('click', () => {
    if (!invoice.lineItems) invoice.lineItems = [];
    invoice.lineItems.push({ id: generateId(), description: '', quantity: 1, unitPrice: 0, taxRate: settings?.taxRate ?? 0, amount: 0 });
    renderLineItems();
    pushHistory(); recalculate();
    // Focus last description input
    const inputs = document.querySelectorAll<HTMLInputElement>('.line-input[data-field="description"]');
    inputs[inputs.length - 1]?.focus();
  });
}

// ─── Client autocomplete ──────────────────────────────────────────────────────
function setupClientAutocomplete(): void {
  const input = document.getElementById('f-to-name') as HTMLInputElement;
  const list  = document.getElementById('client-ac')!;

  input?.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    if (!q) { list.style.display = 'none'; return; }
    const matches = allClients.filter(c =>
      c.name.toLowerCase().includes(q) || (c.company ?? '').toLowerCase().includes(q));
    if (!matches.length) { list.style.display = 'none'; return; }
    list.innerHTML = matches.slice(0, 6).map(c => `
      <div class="autocomplete-item" data-id="${c.id}">
        <div class="ac-name">${escapeHtml(c.name)}</div>
        ${c.company ? `<div class="ac-sub">${escapeHtml(c.company)}</div>` : ''}
      </div>`).join('');
    list.style.display = 'block';

    list.querySelectorAll<HTMLDivElement>('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const client = allClients.find(c => c.id === item.dataset.id);
        if (!client) return;
        invoice.clientId = client.id;
        invoice.billTo = { ...client };
        list.style.display = 'none';
        renderBillToFields();
        recalculate();
      });
    });
  });

  document.addEventListener('click', e => {
    if (!input?.contains(e.target as Node) && !list.contains(e.target as Node)) {
      list.style.display = 'none';
    }
  });
}

function renderBillToFields(): void {
  const bt = invoice.billTo ?? {};
  const fields: Record<string, string> = {
    'f-to-name':    bt.name    ?? '',
    'f-to-company': bt.company ?? '',
    'f-to-email':   bt.email   ?? '',
    'f-to-addr':    bt.address ?? '',
    'f-to-city':    bt.city    ?? '',
    'f-to-state':   bt.state   ?? '',
    'f-to-zip':     bt.zip     ?? '',
    'f-to-country': bt.country ?? '',
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id) as HTMLInputElement;
    if (el) el.value = val;
  });
}

// ─── Calculation & preview ────────────────────────────────────────────────────
function recalculate(): void {
  const items = invoice.lineItems ?? [];
  const disc  = invoice.discount  ?? { type: 'percent' as const, value: 0 };
  const ship  = invoice.shipping  ?? 0;
  const mode  = invoice.taxMode   ?? 'exclusive';
  const totals = calculateTotals(items, disc, ship, mode);
  Object.assign(invoice, totals);
  renderTotals();
  updatePreview();
}

function renderTotals(): void {
  const display = document.getElementById('totals-display');
  if (!display) return;
  const sym = invoice.currencySymbol ?? '$';
  const disc = invoice.discount ?? { type: 'percent' as const, value: 0 };
  display.innerHTML = `
    <div class="total-row"><span class="total-label" data-i18n="invoices.subtotal">${t('invoices.subtotal')}</span><span class="total-value">${formatCurrency(invoice.subtotal ?? 0, sym)}</span></div>
    ${(invoice.discountAmount ?? 0) > 0 ? `<div class="total-row"><span class="total-label" data-i18n="invoices.discount">${t('invoices.discount')}${disc.type === 'percent' ? ` (${disc.value}%)` : ''}</span><span class="total-value" style="color:var(--danger)">−${formatCurrency(invoice.discountAmount ?? 0, sym)}</span></div>` : ''}
    ${(invoice.taxTotal ?? 0) > 0 ? `<div class="total-row"><span class="total-label" data-i18n="invoices.tax">${t('invoices.tax')}</span><span class="total-value">${formatCurrency(invoice.taxTotal ?? 0, sym)}</span></div>` : ''}
    ${(invoice.shipping ?? 0) > 0 ? `<div class="total-row"><span class="total-label" data-i18n="invoices.shipping">${t('invoices.shipping')}</span><span class="total-value">${formatCurrency(invoice.shipping ?? 0, sym)}</span></div>` : ''}
    <div class="total-row grand"><span class="total-label" data-i18n="invoices.total_due">${t('invoices.total_due')}</span><span class="total-value">${formatCurrency(invoice.grandTotal ?? 0, sym)}</span></div>`;
}

const debouncedPreview = debounce(doUpdatePreview, 300);
function updatePreview(): void { debouncedPreview(); }

function doUpdatePreview(): void {
  if (!previewIframe || !settings) return;
  // Always use latest logo from settings in preview
  if (settings.businessDetails.logo && invoice.billFrom) {
    invoice.billFrom.logo = settings.businessDetails.logo;
  }
  const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = resolveInvoiceTheme(settings.invoiceTheme || 'auto', settings.theme, systemIsDark);
  const html = generatePreviewHtml(invoice, settings, theme);
  previewIframe.srcdoc = html;
  previewIframe.onload = () => {
    const h = previewIframe!.contentDocument?.body?.scrollHeight ?? 600;
    previewIframe!.style.height = `${h}px`;
  };
}

// ─── Save ─────────────────────────────────────────────────────────────────────
async function saveInvoice(silent = false): Promise<boolean> {
  if (isSaving) return false;
  isSaving = true;
  const ind = document.getElementById('autosave-ind');
  if (ind) { 
    ind.textContent = ''; 
    ind.innerHTML = `<div class="autosave-dot"></div><span data-i18n="invoices.saving">${t('invoices.saving')}</span>`; 
  }

  let r;
  if (invoice.id) {
    r = await window.finchAPI.invoice.update({ id: invoice.id, invoice });
  } else {
    r = await window.finchAPI.invoice.create(invoice);
  }

  isSaving = false;
  if (r.success && r.data) {
    Object.assign(invoice, r.data);
    isDirty = false;
    if (ind) { 
      ind.className = 'autosave-indicator saved'; 
      ind.innerHTML = `<div class="autosave-dot"></div><span data-i18n="invoices.saved">${t('invoices.saved')}</span>`; 
      setTimeout(() => { 
        if (ind) { 
          ind.className = 'autosave-indicator'; 
          ind.innerHTML = `<div class="autosave-dot"></div><span data-i18n="status.draft">${t('status.draft')}</span>`; 
        } 
      }, 2000); 
    }
    if (!silent) showToast(t('invoices.updated_toast'), 'success');
    return true;
  } else {
    if (!silent) showToast(r.error ?? t('common.error'), 'error');
    return false;
  }
}

// ─── Undo/Redo ────────────────────────────────────────────────────────────────
function pushHistory(): void {
  const snapshot = JSON.stringify(invoice);
  if (historyIdx >= 0 && history[historyIdx] === snapshot) return;
  history = history.slice(0, historyIdx + 1);
  history.push(snapshot);
  if (history.length > 50) history.shift();
  historyIdx = history.length - 1;
  updateUndoRedoBtns();
}

function undo(): void {
  if (historyIdx <= 0) return;
  historyIdx--;
  invoice = JSON.parse(history[historyIdx]);
  renderForm();
  updatePreview();
  updateUndoRedoBtns();
}

function redo(): void {
  if (historyIdx >= history.length - 1) return;
  historyIdx++;
  invoice = JSON.parse(history[historyIdx]);
  renderForm();
  updatePreview();
  updateUndoRedoBtns();
}

function updateUndoRedoBtns(): void {
  const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
  const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
  if (undoBtn) undoBtn.disabled = historyIdx <= 0;
  if (redoBtn) redoBtn.disabled = historyIdx >= history.length - 1;
}
