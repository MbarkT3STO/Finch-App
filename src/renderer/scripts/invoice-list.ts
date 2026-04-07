import { Invoice, InvoiceStatus } from '../../shared/types';
import { formatCurrency, formatDate, debounce } from '../../shared/utils';
import { showToast, confirm, renderSkeleton, escapeHtml } from './ui-utils';
import { t } from './i18n';

let allInvoices: Invoice[] = [];
let filteredInvoices: Invoice[] = [];
let currentFilter: InvoiceStatus | 'all' = 'all';
let currentSearch = '';
let sortField: 'issueDate' | 'grandTotal' | 'billTo' = 'issueDate';
let sortDir: 1 | -1 = -1;
let navigate: (route: string) => void = () => {};

export function initInvoiceList(container: HTMLElement, nav: (r: string) => void): void {
  navigate = nav;
  container.innerHTML = `
  <div class="view-container">
    <div class="page-header">
      <h1 data-i18n="invoices.title">${t('invoices.title')}</h1>
      <div class="page-actions">
        <button class="btn btn-primary" id="new-invoice-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          <span class="btn-label" data-i18n="invoices.new_invoice">${t('invoices.new_invoice')}</span>
        </button>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-wrap">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input class="search-input" id="invoice-search" placeholder="${t('invoices.search_placeholder')}" data-i18n-placeholder="invoices.search_placeholder" type="search">
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="filter-chip active" data-status="all" data-i18n="invoices.filter_all">${t('invoices.filter_all')}</button>
        <button class="filter-chip" data-status="draft" data-i18n="status.draft">${t('status.draft')}</button>
        <button class="filter-chip" data-status="unpaid" data-i18n="status.unpaid">${t('status.unpaid')}</button>
        <button class="filter-chip" data-status="paid" data-i18n="status.paid">${t('status.paid')}</button>
        <button class="filter-chip" data-status="overdue" data-i18n="status.overdue">${t('status.overdue')}</button>
      </div>
    </div>

    <div style="padding:0 28px 28px">
      <div class="section">
        <div id="invoice-table-wrap" style="overflow-x:auto">
          <table class="data-table" id="invoice-table">
            <thead>
              <tr>
                <th class="sortable" data-sort="number" style="width:140px" data-i18n="invoices.num_col">${t('invoices.num_col')}</th>
                <th class="sortable" data-sort="billTo" data-i18n="invoices.client_col">${t('invoices.client_col')}</th>
                <th class="sortable" data-sort="issueDate" data-i18n="invoices.date_col">${t('invoices.date_col')}</th>
                <th class="sortable" data-sort="dueDate" data-i18n="invoices.due_col">${t('invoices.due_col')}</th>
                <th class="sortable col-amount" data-sort="grandTotal" data-i18n="invoices.amount_col">${t('invoices.amount_col')}</th>
                <th data-i18n="invoices.status_col">${t('invoices.status_col')}</th>
                <th class="col-actions" style="width:130px" data-i18n="invoices.actions_col">${t('invoices.actions_col')}</th>
              </tr>
            </thead>
            <tbody id="invoice-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`;

  bindEvents();
  loadInvoices();
}

function bindEvents(): void {
  document.getElementById('new-invoice-btn')?.addEventListener('click', () => navigate('#/invoice/new'));

  const search = document.getElementById('invoice-search') as HTMLInputElement;
  search?.addEventListener('input', debounce(() => {
    currentSearch = search.value.toLowerCase();
    applyFilter();
  }, 200));

  document.querySelectorAll<HTMLButtonElement>('.filter-chip[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.status as InvoiceStatus | 'all';
      applyFilter();
    });
  });

  document.querySelectorAll<HTMLTableCellElement>('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort as typeof sortField;
      if (sortField === field) sortDir = sortDir === 1 ? -1 : 1;
      else { sortField = field; sortDir = -1; }
      document.querySelectorAll('th.sort-active').forEach(t => t.classList.remove('sort-active'));
      th.classList.add('sort-active');
      applyFilter();
    });
  });
}

async function loadInvoices(): Promise<void> {
  const tbody = document.getElementById('invoice-tbody')!;
  renderSkeleton(tbody, 6);
  const result = await window.finchAPI.invoice.getAll();
  if (!result.success) { showToast(result.error ?? t('common.error'), 'error'); return; }
  allInvoices = result.data ?? [];
  applyFilter();
}

function applyFilter(): void {
  filteredInvoices = allInvoices.filter(inv => {
    const matchStatus = currentFilter === 'all' || inv.status === currentFilter;
    const q = currentSearch;
    const matchSearch = !q ||
      inv.number.toLowerCase().includes(q) ||
      (inv.billTo.name ?? '').toLowerCase().includes(q) ||
      (inv.billTo.company ?? '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  filteredInvoices.sort((a, b) => {
    let va: string | number, vb: string | number;
    if (sortField === 'grandTotal') { va = a.grandTotal; vb = b.grandTotal; }
    else if (sortField === 'billTo') { va = (a.billTo.name ?? '').toLowerCase(); vb = (b.billTo.name ?? '').toLowerCase(); }
    else { va = a[sortField] ?? ''; vb = b[sortField] ?? ''; }
    return va < vb ? -sortDir : va > vb ? sortDir : 0;
  });

  renderTable();
}

function renderTable(): void {
  const tbody = document.getElementById('invoice-tbody')!;
  if (!filteredInvoices.length) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
          <p data-i18n="invoices.empty_state">${t('invoices.empty_state')}</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = filteredInvoices.map(inv => {
    const sym = inv.currencySymbol || '$';
    return `<tr data-id="${inv.id}">
      <td class="col-mono" style="font-weight:600">${escapeHtml(inv.number)}</td>
      <td>
        <div style="font-weight:500">${escapeHtml(inv.billTo.name || '—')}</div>
        ${inv.billTo.company ? `<div style="font-size:0.8125rem;color:var(--text-tertiary)">${escapeHtml(inv.billTo.company)}</div>` : ''}
      </td>
      <td>${formatDate(inv.issueDate)}</td>
      <td>${inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
      <td class="col-amount">${formatCurrency(inv.grandTotal, sym)}</td>
      <td><span class="badge badge-${inv.status}">${t(`status.${inv.status}`)}</span></td>
      <td class="col-actions">
        <div class="row-actions">
          <button class="btn btn-ghost btn-icon btn-sm action-edit" title="${t('invoices.edit_tip')}" data-i18n-title="invoices.edit_tip" data-id="${inv.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm action-pdf" title="${t('invoices.export_tip')}" data-i18n-title="invoices.export_tip" data-id="${inv.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm action-dupe" title="${t('invoices.dupe_tip')}" data-i18n-title="invoices.dupe_tip" data-id="${inv.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
          ${inv.status !== 'paid' ? `<button class="btn btn-ghost btn-icon btn-sm action-paid" title="${t('invoices.paid_tip')}" data-i18n-title="invoices.paid_tip" data-id="${inv.id}" style="color:var(--success)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          </button>` : ''}
          <button class="btn btn-ghost btn-icon btn-sm action-del" title="${t('invoices.del_tip')}" data-i18n-title="invoices.del_tip" data-id="${inv.id}" style="color:var(--danger)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Bind row clicks
  document.querySelectorAll<HTMLTableRowElement>('#invoice-tbody tr[data-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;
      navigate(`#/invoice/edit/${row.dataset.id}`);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.action-edit').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); navigate(`#/invoice/edit/${btn.dataset.id}`); });
  });

  document.querySelectorAll<HTMLButtonElement>('.action-pdf').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      showToast(t('invoices.gen_pdf_toast'), 'info');
      const r = await window.finchAPI.pdf.export({ invoiceId: btn.dataset.id! });
      if (r.success) { showToast(t('invoices.pdf_saved_toast'), 'success'); window.finchAPI.shell.showItemInFolder(r.data!); }
      else showToast(r.error ?? t('invoices.export_failed'), 'error');
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.action-dupe').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = await window.finchAPI.invoice.duplicate(btn.dataset.id!);
      if (r.success) { showToast(t('invoices.duped_toast'), 'success'); navigate(`#/invoice/edit/${r.data!.id}`); }
      else showToast(r.error ?? t('common.error'), 'error');
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.action-paid').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = await window.finchAPI.invoice.updateStatus({ id: btn.dataset.id!, status: 'paid' });
      if (r.success) { showToast(t('invoices.marked_paid_toast'), 'success'); loadInvoices(); }
      else showToast(r.error ?? t('common.error'), 'error');
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.action-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirm(t('invoices.del_confirm'), t('invoices.del_title'));
      if (!ok) return;
      const r = await window.finchAPI.invoice.delete(btn.dataset.id!);
      if (r.success) { showToast(t('invoices.deleted_toast'), 'success'); loadInvoices(); }
      else showToast(r.error ?? t('common.error'), 'error');
    });
  });
}
