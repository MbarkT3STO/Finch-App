import { AppSettings } from '../../shared/types';
import { showToast, openModal, closeModal, confirm, setLoading } from './ui-utils';
import { validatePassword } from './validators';

let currentSettings: AppSettings | null = null;
let currentLogo = '';

export function initSettings(container: HTMLElement): void {
  container.innerHTML = `
  <div class="view-container">
    <div class="page-header">
      <h1>Settings</h1>
      <div class="page-actions">
        <button class="btn btn-primary" id="save-settings-btn"><span class="btn-label">Save Changes</span></button>
      </div>
    </div>
    <div class="settings-container" id="settings-body">
      <div class="skeleton" style="height:160px;border-radius:12px"></div>
      <div class="skeleton" style="height:200px;border-radius:12px"></div>
      <div class="skeleton" style="height:180px;border-radius:12px"></div>
    </div>
  </div>`;

  loadSettings();
  document.getElementById('save-settings-btn')?.addEventListener('click', saveSettings);
}

async function loadSettings(): Promise<void> {
  const r = await window.finchAPI.settings.get();
  if (!r.success || !r.data) { showToast(r.error ?? 'Failed to load settings', 'error'); return; }
  currentSettings = r.data;
  currentLogo = r.data.businessDetails.logo ?? '';
  renderSettings(r.data);
}

function renderSettings(s: AppSettings): void {
  const body = document.getElementById('settings-body')!;
  body.innerHTML = `
  <!-- Business Profile -->
  <div class="settings-section">
    <div class="settings-section-header"><h3>Business Profile</h3></div>
    <div class="settings-section-body">
      <div class="logo-uploader">
        <div class="logo-preview" id="logo-preview" title="Click to upload logo">
          ${s.businessDetails.logo
            ? `<img src="${s.businessDetails.logo}" id="logo-img" alt="Logo">`
            : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-tertiary)"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`}
        </div>
        <input type="file" id="logo-file-input" accept="image/*" style="display:none">
        <div>
          <p style="font-weight:600;font-size:0.875rem">Business Logo</p>
          <p style="font-size:0.8125rem;color:var(--text-tertiary);margin-top:2px">PNG, JPG up to 2MB</p>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="btn btn-secondary btn-sm" id="upload-logo-btn">Upload</button>
            ${s.businessDetails.logo ? `<button class="btn btn-ghost btn-sm" id="remove-logo-btn" style="color:var(--danger)">Remove</button>` : ''}
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Business Name</label>
          <input class="form-input" id="s-biz-name" value="${esc(s.businessDetails.name)}" placeholder="Your Business LLC">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="s-biz-email" type="email" value="${esc(s.businessDetails.email)}" placeholder="billing@yourco.com">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input class="form-input" id="s-biz-phone" value="${esc(s.businessDetails.phone)}" placeholder="+1 555 0100">
        </div>
        <div class="form-group">
          <label class="form-label">Website</label>
          <input class="form-input" id="s-biz-website" value="${esc(s.businessDetails.website ?? '')}" placeholder="https://yourco.com">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Address</label>
        <input class="form-input" id="s-biz-address" value="${esc(s.businessDetails.address)}" placeholder="123 Main St">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">City</label>
          <input class="form-input" id="s-biz-city" value="${esc(s.businessDetails.city)}" placeholder="City">
        </div>
        <div class="form-group">
          <label class="form-label">State</label>
          <input class="form-input" id="s-biz-state" value="${esc(s.businessDetails.state)}" placeholder="State">
        </div>
        <div class="form-group">
          <label class="form-label">ZIP</label>
          <input class="form-input" id="s-biz-zip" value="${esc(s.businessDetails.zip)}" placeholder="ZIP">
        </div>
        <div class="form-group">
          <label class="form-label">Country</label>
          <input class="form-input" id="s-biz-country" value="${esc(s.businessDetails.country)}" placeholder="Country">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Tax / VAT ID</label>
        <input class="form-input" id="s-biz-taxid" value="${esc(s.businessDetails.taxId ?? '')}" placeholder="Tax ID">
      </div>
    </div>
  </div>

  <!-- Invoice Defaults -->
  <div class="settings-section">
    <div class="settings-section-header"><h3>Invoice Defaults</h3></div>
    <div class="settings-section-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Invoice Prefix</label>
          <input class="form-input" id="s-prefix" value="${esc(s.invoicePrefix)}" placeholder="INV" style="max-width:100px">
        </div>
        <div class="form-group">
          <label class="form-label">Next Invoice #</label>
          <input class="form-input" id="s-next-num" type="number" min="1" value="${s.nextInvoiceNumber}" style="max-width:120px">
        </div>
        <div class="form-group">
          <label class="form-label">Default Tax Rate (%)</label>
          <input class="form-input" id="s-tax-rate" type="number" min="0" max="100" step="0.01" value="${s.taxRate}" style="max-width:120px">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Default Template</label>
          <select class="form-select" id="s-default-template" style="max-width:160px">
            <option value="classic" ${(s.defaultInvoiceTemplate ?? 'classic') === 'classic' ? 'selected' : ''}>Classic</option>
            <option value="modern" ${s.defaultInvoiceTemplate === 'modern' ? 'selected' : ''}>Modern</option>
            <option value="minimal" ${s.defaultInvoiceTemplate === 'minimal' ? 'selected' : ''}>Minimal</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Default Invoice Footer</label>
        <textarea class="form-input" id="s-default-footer" rows="3" placeholder="e.g. payment instructions, bank details…" style="resize:vertical">${esc(s.defaultFooterText ?? '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Currency</label>
          <select class="form-select" id="s-currency" style="max-width:140px">
            ${[['USD','$'],['EUR','€'],['GBP','£'],['CAD','CA$'],['AUD','A$'],['JPY','¥'],['CHF','CHF'],['INR','₹']].map(([c,sym]) =>
              `<option value="${c}" data-symbol="${sym}" ${s.currency === c ? 'selected' : ''}>${c} (${sym})</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
  </div>

  <!-- Appearance -->
  <div class="settings-section">
    <div class="settings-section-header"><h3>Appearance</h3></div>
    <div class="settings-section-body">
      <div class="form-group">
        <label class="form-label">Theme</label>
        <div class="theme-options">
          ${(['light','dark','system'] as const).map(t => {
            const icon = t === 'light'
              ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
              : t === 'dark'
              ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`
              : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
            return `
          <div class="theme-opt ${s.theme === t ? 'active' : ''}" data-theme="${t}">
            ${icon}
            ${t.charAt(0).toUpperCase() + t.slice(1)}
          </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- Account -->
  <div class="settings-section">
    <div class="settings-section-header"><h3>Account</h3></div>
    <div class="settings-section-body">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary" id="change-pwd-btn">Change Password</button>
        <button class="btn btn-secondary" id="backup-btn">Export Backup</button>
        <button class="btn btn-danger" id="delete-account-btn">Delete Account</button>
      </div>
    </div>
  </div>`;

  // Logo
  const logoPreview = document.getElementById('logo-preview')!;
  const logoFile    = document.getElementById('logo-file-input') as HTMLInputElement;
  document.getElementById('upload-logo-btn')?.addEventListener('click', () => logoFile.click());
  logoPreview.addEventListener('click', () => logoFile.click());
  logoFile.addEventListener('change', () => {
    const file = logoFile.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      currentLogo = src;
      logoPreview.innerHTML = `<img src="${src}" alt="Logo">`;
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('remove-logo-btn')?.addEventListener('click', () => {
    currentLogo = '';
    logoPreview.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-tertiary)"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
  });

  // Theme options
  document.querySelectorAll<HTMLDivElement>('.theme-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.theme-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      applyTheme(opt.dataset.theme as 'light' | 'dark' | 'system');
    });
  });

  // Account buttons
  document.getElementById('change-pwd-btn')?.addEventListener('click', openChangePwdModal);
  document.getElementById('backup-btn')?.addEventListener('click', async () => {
    const r = await window.finchAPI.backup.export();
    if (r.success) { showToast('Backup saved', 'success'); window.finchAPI.shell.showItemInFolder(r.data!); }
    else showToast(r.error ?? 'Backup failed', 'error');
  });
  document.getElementById('delete-account-btn')?.addEventListener('click', openDeleteAccountModal);
}

function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const root = document.documentElement;
  if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

async function saveSettings(): Promise<void> {
  const btn = document.getElementById('save-settings-btn') as HTMLButtonElement;
  setLoading(btn, true);

  const logo = currentLogo;

  const currencyEl = document.getElementById('s-currency') as HTMLSelectElement;
  const currencyOpt = currencyEl?.options[currencyEl.selectedIndex];
  const currency = currencyEl?.value ?? currentSettings?.currency ?? 'USD';
  const currencySymbol = currencyOpt?.dataset.symbol ?? currentSettings?.currencySymbol ?? '$';

  const themeOpt = document.querySelector<HTMLElement>('.theme-opt.active');
  const theme = (themeOpt?.dataset.theme ?? currentSettings?.theme ?? 'system') as 'light' | 'dark' | 'system';

  const defaultTemplateEl = document.getElementById('s-default-template') as HTMLSelectElement;
  const defaultInvoiceTemplate = (defaultTemplateEl?.value ?? 'classic') as 'classic' | 'modern' | 'minimal';
  const defaultFooterText = (document.getElementById('s-default-footer') as HTMLTextAreaElement)?.value ?? '';

  const partial: Partial<AppSettings> = {
    invoicePrefix: (document.getElementById('s-prefix') as HTMLInputElement)?.value.trim() || 'INV',
    nextInvoiceNumber: parseInt((document.getElementById('s-next-num') as HTMLInputElement)?.value || '1', 10),
    taxRate: parseFloat((document.getElementById('s-tax-rate') as HTMLInputElement)?.value || '0'),
    currency,
    currencySymbol,
    theme,
    defaultInvoiceTemplate,
    defaultFooterText,
    businessDetails: {
      name:    (document.getElementById('s-biz-name')    as HTMLInputElement)?.value.trim() ?? '',
      email:   (document.getElementById('s-biz-email')   as HTMLInputElement)?.value.trim() ?? '',
      phone:   (document.getElementById('s-biz-phone')   as HTMLInputElement)?.value.trim() ?? '',
      website: (document.getElementById('s-biz-website') as HTMLInputElement)?.value.trim() ?? '',
      address: (document.getElementById('s-biz-address') as HTMLInputElement)?.value.trim() ?? '',
      city:    (document.getElementById('s-biz-city')    as HTMLInputElement)?.value.trim() ?? '',
      state:   (document.getElementById('s-biz-state')   as HTMLInputElement)?.value.trim() ?? '',
      zip:     (document.getElementById('s-biz-zip')     as HTMLInputElement)?.value.trim() ?? '',
      country: (document.getElementById('s-biz-country') as HTMLInputElement)?.value.trim() ?? '',
      taxId:   (document.getElementById('s-biz-taxid')   as HTMLInputElement)?.value.trim() ?? '',
      logo: logo ?? '',
    },
  };

  const r = await window.finchAPI.settings.set(partial);
  setLoading(btn, false);
  if (r.success) { currentSettings = r.data ?? null; showToast('Settings saved', 'success'); }
  else showToast(r.error ?? 'Failed', 'error');
}

function openChangePwdModal(): void {
  const bd = openModal(`
    <div class="modal-header"><h2>Change Password</h2></div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label required">Current Password</label>
        <input class="form-input" id="pwd-current" type="password" placeholder="Current password">
      </div>
      <div class="form-group">
        <label class="form-label required">New Password</label>
        <input class="form-input" id="pwd-new" type="password" placeholder="New password (min 8 chars)">
      </div>
      <div class="form-group">
        <label class="form-label required">Confirm New Password</label>
        <input class="form-input" id="pwd-confirm" type="password" placeholder="Repeat new password">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="cpwd-cancel">Cancel</button>
      <button class="btn btn-primary" id="cpwd-save"><span class="btn-label">Change Password</span></button>
    </div>`);

  bd.querySelector('#cpwd-cancel')?.addEventListener('click', () => closeModal(bd));
  bd.querySelector('#cpwd-save')?.addEventListener('click', async () => {
    const cur = (bd.querySelector('#pwd-current') as HTMLInputElement).value;
    const nw  = (bd.querySelector('#pwd-new')     as HTMLInputElement).value;
    const cf  = (bd.querySelector('#pwd-confirm') as HTMLInputElement).value;
    if (!cur) { showToast('Enter current password', 'error'); return; }
    const v = validatePassword(nw);
    if (!v.valid) { showToast(v.message!, 'error'); return; }
    if (nw !== cf) { showToast('Passwords do not match', 'error'); return; }
    const saveBtn = bd.querySelector('#cpwd-save') as HTMLButtonElement;
    setLoading(saveBtn, true);
    const r = await window.finchAPI.auth.changePassword({ currentPassword: cur, newPassword: nw });
    setLoading(saveBtn, false);
    if (r.success) { showToast('Password changed', 'success'); closeModal(bd); }
    else showToast(r.error ?? 'Failed', 'error');
  });
}

function openDeleteAccountModal(): void {
  const bd = openModal(`
    <div class="modal-header"><h2 style="color:var(--danger)">Delete Account</h2></div>
    <div class="modal-body">
      <p style="color:var(--text-secondary)">This will permanently delete your account and all your data. This action <strong>cannot</strong> be undone.</p>
      <div class="form-group" style="margin-top:8px">
        <label class="form-label required">Confirm your password</label>
        <input class="form-input" id="del-pwd" type="password" placeholder="Your password">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="del-cancel">Cancel</button>
      <button class="btn btn-danger" id="del-confirm"><span class="btn-label">Delete Account</span></button>
    </div>`);

  bd.querySelector('#del-cancel')?.addEventListener('click', () => closeModal(bd));
  bd.querySelector('#del-confirm')?.addEventListener('click', async () => {
    const pwd = (bd.querySelector('#del-pwd') as HTMLInputElement).value;
    if (!pwd) { showToast('Enter your password', 'error'); return; }
    const ok = await confirm('Are you absolutely sure? All data will be lost.', 'Delete Account');
    if (!ok) return;
    const btn = bd.querySelector('#del-confirm') as HTMLButtonElement;
    setLoading(btn, true);
    const r = await window.finchAPI.auth.deleteAccount({ password: pwd });
    if (!r.success) { setLoading(btn, false); showToast(r.error ?? 'Failed', 'error'); }
    // On success main process switches to login window
  });
}
