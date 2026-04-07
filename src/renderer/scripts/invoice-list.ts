import { Invoice, InvoiceStatus } from '../../shared/types';
import { formatCurrency, formatDate, debounce } from '../../shared/utils';
import { showToast, confirm, renderSkeleton, escapeHtml } from './ui-utils';

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
      <h1>Invoices</h1>
      <div class="page-actions">
        <button class="btn btn-primary" id="new-invoice-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          <span class="btn-label">New Invoice</span>
        </button>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-wrap">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input class="search-input" id="invoice-search" placeholder="Search invoices…" type="search">
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="filter-chip active" data-status="all">All</button>
        <button class="filter-chip" data-status="draft">Draft</button>
        <button class="filter-chip" data-status="unpaid">Unpaid</button>
        <button class="filter-chip" data-status="paid">Paid</button>
        <button class="filter-chip" data-status="overdue">Overdue</button>
      </div>
    </div>

    <div style="padding:0 28px 28px">
      <div class="section">
        <div id="invoice-table-wrap" style="overflow-x:auto">
          <table class="data-table" id="invoice-table">
            <thead>
              <tr>
                <th class="sortable" data-sort="number" style="width:140px"># Number</th>
                <th class="sortable" data-sort="billTo">Client</th>
                <th class="sortable" data-sort="issueDate">Issue Date</th>
                <th class="sortable" data-sort="dueDate">Due Date</th>
                <th class="sortable col-amount" data-sort="grandTotal">Amount</th>
                <th>Status</th>
                <th class="col-actions" style="width:130px">Actions</th>
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
  if (!result.success) { showToast(result.error ?? 'Failed to load', 'error'); return; }
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
          <p>No invoices found. Create your first invoice to get started.</p>
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
      <td><span class="badge badge-${inv.status}">${inv.status}</span></td>
      <td class="col-actions">
        <div class="row-actions">
          <button class="btn btn-ghost btn-icon btn-sm action-edit" title="Edit" data-id="${inv.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm action-pdf" title="Export PDF" data-id="${inv.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm action-dupe" title="Duplicate" data-id="${inv.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
          ${inv.status !== 'paid' ? `<button class="btn btn-ghost btn-icon btn-sm action-paid" title="Mark Paid" data-id="${inv.id}" style="color:var(--success)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          </button>` : ''}
          <button class="btn btn-ghost btn-icon btn-sm action-del" title="Delete" data-id="${inv.id}" style="color:var(--danger)">
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
      showToast('Generating PDF…', 'info');
      const r = await window.finchAPI.pdf.export({ invoiceId: btn.dataset.id! });
      if (r.success) { showToast('PDF saved!', 'success'); window.finchAPI.shell.showItemInFolder(r.data!); }
      else showToast(r.error ?? 'Export failed', 'error');
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.action-dupe').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = await window.finchAPI.invoice.duplicate(btn.dataset.id!);
      if (r.success) { showToast('Invoice duplicated', 'success'); navigate(`#/invoice/edit/${r.data!.id}`); }
      else showToast(r.error ?? 'Failed', 'error');
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.action-paid').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = await window.finchAPI.invoice.updateStatus({ id: btn.dataset.id!, status: 'paid' });
      if (r.success) { showToast('Marked as paid', 'success'); loadInvoices(); }
      else showToast(r.error ?? 'Failed', 'error');
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.action-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirm('Delete this invoice? This cannot be undone.', 'Delete Invoice');
      if (!ok) return;
      const r = await window.finchAPI.invoice.delete(btn.dataset.id!);
      if (r.success) { showToast('Invoice deleted', 'success'); loadInvoices(); }
      else showToast(r.error ?? 'Failed', 'error');
    });
  });
}
