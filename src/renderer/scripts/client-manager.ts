import { Client } from '../../shared/types';
import { showToast, openModal, closeModal, confirm, renderSkeleton, escapeHtml } from './ui-utils';
import { validateRequired } from './validators';
import { debounce } from '../../shared/utils';

let allClients: Client[] = [];

export function initClientManager(container: HTMLElement): void {
  container.innerHTML = `
  <div class="view-container">
    <div class="page-header">
      <h1>Clients</h1>
      <div class="page-actions">
        <button class="btn btn-primary" id="add-client-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          <span class="btn-label">Add Client</span>
        </button>
      </div>
    </div>
    <div class="toolbar">
      <div class="search-wrap">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input class="search-input" id="client-search" placeholder="Search clients…" type="search">
      </div>
    </div>
    <div style="padding:0 28px 28px">
      <div class="section">
        <table class="data-table">
          <thead><tr>
            <th>Name</th><th>Company</th><th>Email</th><th>Phone</th>
            <th class="col-actions" style="width:100px">Actions</th>
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
  if (!r.success) { showToast(r.error ?? 'Failed to load clients', 'error'); return; }
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
        <p>No clients yet. Add your first client to get started.</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td style="font-weight:500">${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.company ?? '—')}</td>
      <td>${escapeHtml(c.email ?? '—')}</td>
      <td>${escapeHtml(c.phone ?? '—')}</td>
      <td class="col-actions">
        <div class="row-actions">
          <button class="btn btn-ghost btn-icon btn-sm" data-action="edit" data-id="${c.id}" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm" data-action="del" data-id="${c.id}" title="Delete" style="color:var(--danger)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll<HTMLButtonElement>('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const client = allClients.find(c => c.id === btn.dataset.id);
      if (client) openClientModal(client);
    });
  });

  tbody.querySelectorAll<HTMLButtonElement>('[data-action="del"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirm('Delete this client?', 'Delete Client');
      if (!ok) return;
      const r = await window.finchAPI.client.delete(btn.dataset.id!);
      if (r.success) { showToast('Client deleted', 'success'); loadClients(); }
      else showToast(r.error ?? 'Failed', 'error');
    });
  });
}

function openClientModal(client: Client | null): void {
  const title = client ? 'Edit Client' : 'New Client';
  const bd = openModal(`
    <div class="modal-header">
      <h2>${title}</h2>
      <button class="btn btn-ghost btn-icon btn-sm" id="modal-close-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label required">Name</label>
          <input class="form-input" id="c-name" value="${escapeHtml(client?.name ?? '')}" placeholder="Full name">
          <span class="form-error"></span>
        </div>
        <div class="form-group">
          <label class="form-label">Company</label>
          <input class="form-input" id="c-company" value="${escapeHtml(client?.company ?? '')}" placeholder="Company name">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="c-email" type="email" value="${escapeHtml(client?.email ?? '')}" placeholder="email@example.com">
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input class="form-input" id="c-phone" value="${escapeHtml(client?.phone ?? '')}" placeholder="+1 555 0100">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Address</label>
        <input class="form-input" id="c-address" value="${escapeHtml(client?.address ?? '')}" placeholder="Street address">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">City</label>
          <input class="form-input" id="c-city" value="${escapeHtml(client?.city ?? '')}" placeholder="City">
        </div>
        <div class="form-group">
          <label class="form-label">State / Province</label>
          <input class="form-input" id="c-state" value="${escapeHtml(client?.state ?? '')}" placeholder="State">
        </div>
        <div class="form-group">
          <label class="form-label">ZIP / Postal</label>
          <input class="form-input" id="c-zip" value="${escapeHtml(client?.zip ?? '')}" placeholder="ZIP">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Country</label>
          <input class="form-input" id="c-country" value="${escapeHtml(client?.country ?? '')}" placeholder="Country">
        </div>
        <div class="form-group">
          <label class="form-label">Tax ID</label>
          <input class="form-input" id="c-taxid" value="${escapeHtml(client?.taxId ?? '')}" placeholder="Tax / VAT ID">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="c-cancel">Cancel</button>
      <button class="btn btn-primary" id="c-save"><span class="btn-label">${client ? 'Save changes' : 'Add client'}</span></button>
    </div>`, { width: '560px' });

  bd.querySelector('#modal-close-btn')?.addEventListener('click', () => closeModal(bd));
  bd.querySelector('#c-cancel')?.addEventListener('click', () => closeModal(bd));

  bd.querySelector('#c-save')?.addEventListener('click', async () => {
    const name = (bd.querySelector('#c-name') as HTMLInputElement).value.trim();
    const v = validateRequired(name, 'Name');
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
      showToast(client ? 'Client updated' : 'Client added', 'success');
      closeModal(bd);
      loadClients();
    } else {
      showToast(r.error ?? 'Failed', 'error');
    }
  });
}
