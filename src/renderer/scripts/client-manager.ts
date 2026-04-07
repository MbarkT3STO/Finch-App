import { Client, Invoice } from '../../shared/types';
import { showToast, openModal, closeModal, confirm, renderSkeleton, escapeHtml } from './ui-utils';
import { validateRequired } from './validators';
import { debounce, aggregateRevenue, aggregateOutstanding, formatCurrency, formatDate } from '../../shared/utils';
import { t } from './i18n';

let allClients: Client[] = [];
let _navigate: (route: string) => void = () => {};

export function initClientManager(container: HTMLElement, navigate: (route: string) => void): void {
  _navigate = navigate;
  container.innerHTML = `
  <div class="view-container">
    <div class="page-header">
      <h1 data-i18n="clients.title">${t('clients.title')}</h1>
      <div class="page-actions">
        <button class="btn btn-primary" id="add-client-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          <span class="btn-label" data-i18n="clients.add_client">${t('clients.add_client')}</span>
        </button>
      </div>
    </div>
    <div class="toolbar">
      <div class="search-wrap">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input class="search-input" id="client-search" placeholder="${t('clients.search_placeholder')}" data-i18n-placeholder="clients.search_placeholder" type="search">
      </div>
    </div>
    <div style="padding:0 28px 28px">
      <div class="section">
        <table class="data-table">
          <thead><tr>
            <th data-i18n="clients.name_col">${t('clients.name_col')}</th>
            <th data-i18n="clients.company_col">${t('clients.company_col')}</th>
            <th data-i18n="clients.email_col">${t('clients.email_col')}</th>
            <th data-i18n="clients.phone_col">${t('clients.phone_col')}</th>
            <th class="col-actions" style="width:100px" data-i18n="clients.actions_col">${t('clients.actions_col')}</th>
          </tr></thead>
          <tbody id="client-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>`;

  document.getElementById('add-client-btn')?.addEventListener('click', () => openClientModal(null));

  const search = document.getElementById('client-search') as HTMLInputElement;
  search?.addEventListener('input', debounce(() => renderClients(search.value.toLowerCase()), 200));

  loadClients();
}

async function loadClients(): Promise<void> {
  const tbody = document.getElementById('client-tbody')!;
  renderSkeleton(tbody, 5);
  const r = await window.finchAPI.client.getAll();
  if (!r.success) { showToast(r.error ?? t('common.error'), 'error'); return; }
  allClients = r.data ?? [];
  renderClients('');
}

function renderClients(query: string): void {
  const tbody = document.getElementById('client-tbody');
  if (!tbody) return;

  const filtered = query
    ? allClients.filter(c =>
        (c.name ?? '').toLowerCase().includes(query) ||
        (c.company ?? '').toLowerCase().includes(query) ||
        (c.email ?? '').toLowerCase().includes(query))
    : allClients;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        <p data-i18n="clients.empty_state">${t('clients.empty_state')}</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr data-client-id="${c.id}" style="cursor:pointer">
      <td style="font-weight:500">${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.company ?? '—')}</td>
      <td>${escapeHtml(c.email ?? '—')}</td>
      <td>${escapeHtml(c.phone ?? '—')}</td>
      <td class="col-actions">
        <div class="row-actions">
          <button class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="${c.id}" title="${t('invoices.edit_tip')}" data-i18n-title="invoices.edit_tip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm" data-action="del" data-id="${c.id}" title="${t('invoices.del_tip')}" data-i18n-title="invoices.del_tip" style="color:var(--danger)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll<HTMLButtonElement>('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const client = allClients.find(c => c.id === btn.dataset.id);
      if (client) openClientModal(client);
    });
  });

  tbody.querySelectorAll<HTMLButtonElement>('[data-action="del"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirm(t('clients.del_confirm'), t('clients.del_title'));
      if (!ok) return;
      const r = await window.finchAPI.client.delete(btn.dataset.id!);
      if (r.success) { showToast(t('clients.deleted_toast'), 'success'); loadClients(); }
      else showToast(r.error ?? t('common.error'), 'error');
    });
  });

  tbody.querySelectorAll<HTMLTableRowElement>('tr[data-client-id]').forEach(row => {
    row.addEventListener('click', () => {
      const client = allClients.find(c => c.id === row.dataset.clientId);
      if (client) showClientHistory(client);
    });
  });
}

function openClientModal(client: Client | null): void {
  const title = client ? t('clients.edit_title') : t('clients.new_title');
  const bd = openModal(`
    <div class="modal-header">
      <h2 data-i18n="${client ? 'clients.edit_title' : 'clients.new_title'}">${title}</h2>
      <button class="btn btn-ghost btn-icon btn-sm" id="modal-close-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label required" data-i18n="clients.name_label">${t('clients.name_label')}</label>
          <input class="form-input" id="c-name" value="${escapeHtml(client?.name ?? '')}" placeholder="${t('clients.name_placeholder')}" data-i18n-placeholder="clients.name_placeholder">
          <span class="form-error"></span>
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="clients.company_label">${t('clients.company_label')}</label>
          <input class="form-input" id="c-company" value="${escapeHtml(client?.company ?? '')}" placeholder="${t('clients.company_placeholder')}" data-i18n-placeholder="clients.company_placeholder">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="clients.email_label">${t('clients.email_label')}</label>
          <input class="form-input" id="c-email" type="email" value="${escapeHtml(client?.email ?? '')}" placeholder="${t('clients.email_placeholder')}" data-i18n-placeholder="clients.email_placeholder">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="clients.phone_label">${t('clients.phone_label')}</label>
          <input class="form-input" id="c-phone" value="${escapeHtml(client?.phone ?? '')}" placeholder="${t('clients.phone_placeholder')}" data-i18n-placeholder="clients.phone_placeholder">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="clients.address_label">${t('clients.address_label')}</label>
        <input class="form-input" id="c-address" value="${escapeHtml(client?.address ?? '')}" placeholder="${t('clients.address_placeholder')}" data-i18n-placeholder="clients.address_placeholder">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="clients.city_label">${t('clients.city_label')}</label>
          <input class="form-input" id="c-city" value="${escapeHtml(client?.city ?? '')}" placeholder="${t('clients.city_label')}" data-i18n-placeholder="clients.city_label">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="clients.state_label">${t('clients.state_label')}</label>
          <input class="form-input" id="c-state" value="${escapeHtml(client?.state ?? '')}" placeholder="${t('clients.state_label')}" data-i18n-placeholder="clients.state_label">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="clients.zip_label">${t('clients.zip_label')}</label>
          <input class="form-input" id="c-zip" value="${escapeHtml(client?.zip ?? '')}" placeholder="${t('clients.zip_label')}" data-i18n-placeholder="clients.zip_label">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="clients.country_label">${t('clients.country_label')}</label>
          <input class="form-input" id="c-country" value="${escapeHtml(client?.country ?? '')}" placeholder="${t('clients.country_label')}" data-i18n-placeholder="clients.country_label">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="clients.tax_id_label">${t('clients.tax_id_label')}</label>
          <input class="form-input" id="c-taxid" value="${escapeHtml(client?.taxId ?? '')}" placeholder="${t('clients.tax_id_placeholder')}" data-i18n-placeholder="clients.tax_id_placeholder">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="c-cancel" data-i18n="common.cancel">${t('common.cancel')}</button>
      <button class="btn btn-primary" id="c-save"><span class="btn-label" data-i18n="${client ? 'clients.save_btn' : 'clients.add_btn'}">${client ? t('clients.save_btn') : t('clients.add_btn')}</span></button>
    </div>`, { width: '560px' });

  bd.querySelector('#modal-close-btn')?.addEventListener('click', () => closeModal(bd));
  bd.querySelector('#c-cancel')?.addEventListener('click', () => closeModal(bd));

  bd.querySelector('#c-save')?.addEventListener('click', async () => {
    const name = (bd.querySelector('#c-name') as HTMLInputElement).value.trim();
    const v = validateRequired(name, t('clients.name_label'));
    if (!v.valid) { showToast(v.message!, 'error'); return; }

    const data = {
      name,
      company: (bd.querySelector('#c-company') as HTMLInputElement).value.trim() || undefined,
      email:   (bd.querySelector('#c-email')   as HTMLInputElement).value.trim() || undefined,
      phone:   (bd.querySelector('#c-phone')   as HTMLInputElement).value.trim() || undefined,
      address: (bd.querySelector('#c-address') as HTMLInputElement).value.trim() || undefined,
      city:    (bd.querySelector('#c-city')    as HTMLInputElement).value.trim() || undefined,
      state:   (bd.querySelector('#c-state')   as HTMLInputElement).value.trim() || undefined,
      zip:     (bd.querySelector('#c-zip')     as HTMLInputElement).value.trim() || undefined,
      country: (bd.querySelector('#c-country') as HTMLInputElement).value.trim() || undefined,
      taxId:   (bd.querySelector('#c-taxid')   as HTMLInputElement).value.trim() || undefined,
    };

    const saveBtn = bd.querySelector('#c-save') as HTMLButtonElement;
    saveBtn.disabled = true;

    let r;
    if (client) r = await window.finchAPI.client.update({ id: client.id, client: data });
    else r = await window.finchAPI.client.create(data);

    saveBtn.disabled = false;
    if (r.success) {
      showToast(client ? t('clients.updated_toast') : t('clients.added_toast'), 'success');
      closeModal(bd);
      loadClients();
    } else {
      showToast(r.error ?? t('common.error'), 'error');
    }
  });
}

// ─── Client History Panel ─────────────────────────────────────────────────────

export function filterAndSortInvoicesForClient(invoices: Invoice[], clientId: string): Invoice[] {
  return invoices
    .filter(inv => inv.clientId === clientId)
    .sort((a, b) => (a.issueDate > b.issueDate ? -1 : a.issueDate < b.issueDate ? 1 : 0));
}

function statusBadge(status: string): string {
  return `<span class="badge badge-${status}">${t(`status.${status}`)}</span>`;
}

async function showClientHistory(client: Client): Promise<void> {
  const container = document.querySelector<HTMLElement>('.view-container');
  if (!container) return;

  // Show loading state
  container.innerHTML = `<div style="padding:28px"><p data-i18n="clients.loading_invoices">${t('clients.loading_invoices')}</p></div>`;

  const r = await window.finchAPI.invoice.getAll();
  if (!r.success) {
    showToast(r.error ?? t('common.error'), 'error');
    // Restore client list on error
    initClientManager(container.parentElement as HTMLElement, _navigate);
    return;
  }

  const allInvoices: Invoice[] = r.data ?? [];
  const clientInvoices = filterAndSortInvoicesForClient(allInvoices, client.id);

  // Use userId from the first invoice that matches, or fall back to client.userId
  const userId = client.userId;
  const revenue = aggregateRevenue(clientInvoices, userId);
  const outstanding = aggregateOutstanding(clientInvoices, userId);

  const invoiceRowsHtml = clientInvoices.length === 0
    ? `<tr><td colspan="5">
        <div class="empty-state">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p data-i18n="clients.no_invoices">${t('clients.no_invoices')}</p>
        </div>
      </td></tr>`
    : clientInvoices.map(inv => `
        <tr data-invoice-id="${inv.id}" style="cursor:pointer">
          <td style="font-weight:500">${escapeHtml(inv.number)}</td>
          <td>${escapeHtml(formatDate(inv.issueDate))}</td>
          <td>${escapeHtml(formatDate(inv.dueDate))}</td>
          <td>${escapeHtml(formatCurrency(inv.grandTotal, inv.currencySymbol))}</td>
          <td>${statusBadge(inv.status)}</td>
        </tr>`).join('');

  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" id="history-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          <span data-i18n="clients.history_back">${t('clients.history_back')}</span>
        </button>
        <h1>${escapeHtml(client.name)}${client.company ? ` <span style="font-weight:400;font-size:0.85em;color:var(--text-muted)">· ${escapeHtml(client.company)}</span>` : ''}</h1>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="history-new-invoice-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          <span class="btn-label" data-i18n="invoices.new_invoice">${t('invoices.new_invoice')}</span>
        </button>
      </div>
    </div>
    <div style="padding:0 28px 28px">
      <div class="section">
        <table class="data-table">
          <thead><tr>
            <th data-i18n="invoices.num_col">${t('invoices.num_col')}</th>
            <th data-i18n="invoices.date_col">${t('invoices.date_col')}</th>
            <th data-i18n="invoices.due_col">${t('invoices.due_col')}</th>
            <th data-i18n="invoices.amount_col">${t('invoices.amount_col')}</th>
            <th data-i18n="invoices.status_col">${t('invoices.status_col')}</th>
          </tr></thead>
          <tbody id="history-tbody">${invoiceRowsHtml}</tbody>
        </table>
      </div>
      <div class="section" style="margin-top:16px;display:flex;gap:24px">
        <div class="metric-card" style="flex:1">
          <div class="metric-label" data-i18n="clients.history_total_revenue">${t('clients.history_total_revenue')}</div>
          <div class="metric-value" style="color:var(--success)">${escapeHtml(formatCurrency(revenue))}</div>
        </div>
        <div class="metric-card" style="flex:1">
          <div class="metric-label" data-i18n="clients.history_total_outstanding">${t('clients.history_total_outstanding')}</div>
          <div class="metric-value" style="color:var(--warning)">${escapeHtml(formatCurrency(outstanding))}</div>
        </div>
      </div>
    </div>`;

  document.getElementById('history-back-btn')?.addEventListener('click', () => {
    const parent = container.parentElement as HTMLElement;
    initClientManager(parent, _navigate);
  });

  document.getElementById('history-new-invoice-btn')?.addEventListener('click', () => {
    _navigate(`#/invoice/new?clientId=${client.id}`);
  });

  document.querySelectorAll<HTMLTableRowElement>('#history-tbody tr[data-invoice-id]').forEach(row => {
    row.addEventListener('click', () => {
      _navigate(`#/invoice/edit/${row.dataset.invoiceId}`);
    });
  });
}
