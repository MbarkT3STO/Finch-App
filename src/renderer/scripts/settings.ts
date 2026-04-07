import { AppSettings } from '../../shared/types';
import { showToast, openModal, closeModal, confirm, escapeHtml, createCustomSelect, setLoading } from './ui-utils';
import { validatePassword } from './validators';
import { t, setLanguage } from './i18n';

let currentSettings: AppSettings | null = null;
let currentLogo = '';

export function initSettings(container: HTMLElement): void {
  container.innerHTML = `
  <div class="view-container">
    <div class="page-header">
      <h1 data-i18n="settings.title">${t('settings.title')}</h1>
      <div class="page-actions">
        <button class="btn btn-primary" id="save-settings-btn">
          <span class="btn-label" data-i18n="settings.save_changes">${t('settings.save_changes')}</span>
        </button>
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
    <div class="settings-section-header"><h3 data-i18n="settings.business_profile">${t('settings.business_profile')}</h3></div>
    <div class="settings-section-body">
      <div class="logo-uploader">
        <div class="logo-preview" id="logo-preview" title="Click to upload logo">
          ${s.businessDetails.logo
            ? `<img src="${s.businessDetails.logo}" id="logo-img" alt="Logo">`
            : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-tertiary)"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`}
        </div>
        <input type="file" id="logo-file-input" accept="image/*" style="display:none">
        <div>
          <p style="font-weight:600;font-size:0.875rem" data-i18n="settings.business_logo">Business Logo</p>
          <p style="font-size:0.8125rem;color:var(--text-tertiary);margin-top:2px">PNG, JPG up to 2MB</p>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="btn btn-secondary btn-sm" id="upload-logo-btn" data-i18n="common.upload">Upload</button>
            ${s.businessDetails.logo ? `<button class="btn btn-ghost btn-sm" id="remove-logo-btn" style="color:var(--danger)" data-i18n="common.remove">Remove</button>` : ''}
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="settings.business_name">${t('settings.business_name')}</label>
          <input class="form-input" id="s-biz-name" value="${esc(s.businessDetails.name)}" placeholder="Your Business LLC">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="settings.email">${t('settings.email')}</label>
          <input class="form-input" id="s-biz-email" type="email" value="${esc(s.businessDetails.email)}" placeholder="billing@yourco.com">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="settings.phone">${t('settings.phone')}</label>
          <input class="form-input" id="s-biz-phone" value="${esc(s.businessDetails.phone)}" placeholder="+1 555 0100">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="settings.website">${t('settings.website')}</label>
          <input class="form-input" id="s-biz-website" value="${esc(s.businessDetails.website ?? '')}" placeholder="https://yourco.com">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="settings.address">${t('settings.address')}</label>
        <input class="form-input" id="s-biz-address" value="${esc(s.businessDetails.address)}" placeholder="123 Main St">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="settings.city">${t('settings.city')}</label>
          <input class="form-input" id="s-biz-city" value="${esc(s.businessDetails.city)}" placeholder="City">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="settings.state">${t('settings.state')}</label>
          <input class="form-input" id="s-biz-state" value="${esc(s.businessDetails.state)}" placeholder="State">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="settings.zip">${t('settings.zip')}</label>
          <input class="form-input" id="s-biz-zip" value="${esc(s.businessDetails.zip)}" placeholder="ZIP">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="settings.country">${t('settings.country')}</label>
          <input class="form-input" id="s-biz-country" value="${esc(s.businessDetails.country)}" placeholder="Country">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="settings.tax_vat_id">${t('settings.tax_vat_id')}</label>
        <input class="form-input" id="s-biz-taxid" value="${esc(s.businessDetails.taxId ?? '')}" placeholder="Tax ID">
      </div>
    </div>
  </div>

  <!-- Invoice Defaults -->
  <div class="settings-section">
    <div class="settings-section-header"><h3 data-i18n="settings.invoice_defaults">${t('settings.invoice_defaults')}</h3></div>
    <div class="settings-section-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="settings.invoice_prefix">${t('settings.invoice_prefix')}</label>
          <input class="form-input" id="s-prefix" value="${esc(s.invoicePrefix)}" placeholder="INV" style="max-width:100px">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="settings.next_invoice_num">${t('settings.next_invoice_num')}</label>
          <input class="form-input" id="s-next-num" type="number" min="1" value="${s.nextInvoiceNumber}" style="max-width:120px">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="settings.default_tax_rate">${t('settings.default_tax_rate')}</label>
          <input class="form-input" id="s-tax-rate" type="number" min="0" max="100" step="0.01" value="${s.taxRate}" style="max-width:120px">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="settings.default_template">${t('settings.default_template')}</label>
          <div id="s-default-template-container" style="max-width:200px"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" data-i18n="settings.default_footer">${t('settings.default_footer')}</label>
        <textarea class="form-input" id="s-default-footer" rows="3" placeholder="e.g. payment instructions, bank details…" style="resize:vertical">${esc(s.defaultFooterText ?? '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="settings.currency">${t('settings.currency')}</label>
          <div id="s-currency-container" style="max-width:140px"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Appearance -->
  <div class="settings-section">
    <div class="settings-section-header"><h3 data-i18n="settings.appearance">${t('settings.appearance')}</h3></div>
    <div class="settings-section-body">
      <div class="form-group">
        <label class="form-label" data-i18n="settings.theme">${t('settings.theme')}</label>
        <div class="theme-options">
          ${(['light','dark','system'] as const).map(tOpt => {
            const icon = tOpt === 'light'
              ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
              : tOpt === 'dark'
              ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`
              : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
            return `
          <div class="theme-opt ${s.theme === tOpt ? 'active' : ''}" data-theme="${tOpt}">
            ${icon}
            <span data-i18n="themes.${tOpt}">${t(`themes.${tOpt}`)}</span>
          </div>`;
          }).join('')}
        </div>
      </div>

      <div class="form-group" style="margin-top:24px">
        <label class="form-label" data-i18n="settings.invoice_theme">${t('settings.invoice_theme')}</label>
        <div id="s-invoice-theme-container" style="max-width:240px"></div>
      </div>

      <div class="form-group" style="margin-top:24px">
        <label class="form-label" data-i18n="settings.language">${t('settings.language')}</label>
        <div class="lang-options">
          ${(['en','fr','ar'] as const).map(l => `
          <div class="lang-opt ${s.language === l ? 'active' : ''}" data-lang="${l}">
            <span data-i18n="languages.${l}">${t(`languages.${l}`)}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- Account -->
  <div class="settings-section">
    <div class="settings-section-header"><h3 data-i18n="settings.account">${t('settings.account')}</h3></div>
    <div class="settings-section-body">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary" id="change-pwd-btn" data-i18n="settings.change_password">${t('settings.change_password')}</button>
        <button class="btn btn-secondary" id="backup-btn" data-i18n="settings.export_backup">${t('settings.export_backup')}</button>
        <button class="btn btn-danger" id="delete-account-btn" data-i18n="settings.delete_account">${t('settings.delete_account')}</button>
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

  // Language options
  document.querySelectorAll<HTMLDivElement>('.lang-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const lang = opt.dataset.lang!;
      document.querySelectorAll('.lang-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      setLanguage(lang);
    });
  });

  createCustomSelect(body.querySelector('#s-default-template-container')!, {
    id: 's-default-template',
    options: [
      { label: 'Classic', value: 'classic' },
      { label: 'Modern',  value: 'modern' },
      { label: 'Minimal', value: 'minimal' }
    ],
    initialValue: s.defaultInvoiceTemplate || 'classic',
    onChange: (val) => { s.defaultInvoiceTemplate = val as 'classic' | 'modern' | 'minimal'; }
  });

  const currencies = [['USD','$'],['EUR','€'],['GBP','£'],['CAD','CA$'],['AUD','A$'],['JPY','¥'],['CHF','CHF'],['INR','₹']];
  createCustomSelect(body.querySelector('#s-currency-container')!, {
    id: 's-currency',
    options: currencies.map(([c, sym]) => ({ label: `${c} (${sym})`, value: c })),
    initialValue: s.currency,
    onChange: (val) => { s.currency = val; }
  });

  createCustomSelect(body.querySelector('#s-invoice-theme-container')!, {
    id: 's-invoice-theme',
    options: [
      { label: t('themes.auto'),  value: 'auto' },
      { label: t('themes.light'), value: 'light' },
      { label: t('themes.dark'),  value: 'dark' }
    ],
    initialValue: s.invoiceTheme || 'auto',
    onChange: (val) => { s.invoiceTheme = val as any; }
  });

  // Account buttons
  document.getElementById('change-pwd-btn')?.addEventListener('click', openChangePwdModal);
  document.getElementById('backup-btn')?.addEventListener('click', async () => {
    const r = await window.finchAPI.backup.export();
    if (r.success) { showToast(t('settings.backup_saved'), 'success'); window.finchAPI.shell.showItemInFolder(r.data!); }
    else showToast(r.error ?? t('settings.backup_failed'), 'error');
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

  const r = await window.finchAPI.settings.set({
    invoicePrefix: (document.getElementById('s-prefix') as HTMLInputElement)?.value.trim() || 'INV',
    nextInvoiceNumber: parseInt((document.getElementById('s-next-num') as HTMLInputElement)?.value || '1', 10),
    taxRate: parseFloat((document.getElementById('s-tax-rate') as HTMLInputElement)?.value || '0'),
    currency: currentSettings?.currency || 'USD',
    currencySymbol: currentSettings?.currencySymbol || '$',
    theme: (document.querySelector('.theme-opt.active') as HTMLElement)?.dataset.theme as any || 'system',
    invoiceTheme: currentSettings?.invoiceTheme || 'auto',
    language: (document.querySelector('.lang-opt.active') as HTMLElement)?.dataset.lang as any || 'en',
    defaultInvoiceTemplate: currentSettings?.defaultInvoiceTemplate || 'classic',
    defaultFooterText: (document.getElementById('s-default-footer') as HTMLTextAreaElement)?.value || '',
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
  });
  setLoading(btn, false);
  if (r.success) { currentSettings = r.data ?? null; showToast(t('settings.saved_toast'), 'success'); }
  else showToast(r.error ?? t('settings.failed_toast'), 'error');
}

function openChangePwdModal(): void {
  const bd = openModal(`
    <div class="modal-header"><h2 data-i18n="settings.change_password">${t('settings.change_password')}</h2></div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label required" data-i18n="settings.current_password">${t('settings.current_password') || 'Current Password'}</label>
        <input class="form-input" id="pwd-current" type="password" placeholder="${t('settings.current_password_placeholder') || 'Current password'}">
      </div>
      <div class="form-group">
        <label class="form-label required" data-i18n="settings.new_password">${t('settings.new_password') || 'New Password'}</label>
        <input class="form-input" id="pwd-new" type="password" placeholder="${t('settings.new_password_placeholder') || 'New password (min 8 chars)'}">
      </div>
      <div class="form-group">
        <label class="form-label required" data-i18n="settings.confirm_password">${t('settings.confirm_password') || 'Confirm New Password'}</label>
        <input class="form-input" id="pwd-confirm" type="password" placeholder="${t('settings.confirm_password_placeholder') || 'Repeat new password'}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="cpwd-cancel" data-i18n="common.cancel">${t('common.cancel') || 'Cancel'}</button>
      <button class="btn btn-primary" id="cpwd-save"><span class="btn-label" data-i18n="settings.change_password">${t('settings.change_password')}</span></button>
    </div>`);

  bd.querySelector('#cpwd-cancel')?.addEventListener('click', () => closeModal(bd));
  bd.querySelector('#cpwd-save')?.addEventListener('click', async () => {
    const cur = (bd.querySelector('#pwd-current') as HTMLInputElement).value;
    const nw  = (bd.querySelector('#pwd-new')     as HTMLInputElement).value;
    const cf  = (bd.querySelector('#pwd-confirm') as HTMLInputElement).value;
    if (!cur) { showToast(t('settings.enter_current_pwd') || 'Enter current password', 'error'); return; }
    const v = validatePassword(nw);
    if (!v.valid) { showToast(v.message!, 'error'); return; }
    if (nw !== cf) { showToast(t('settings.pwd_mismatch') || 'Passwords do not match', 'error'); return; }
    const saveBtn = bd.querySelector('#cpwd-save') as HTMLButtonElement;
    setLoading(saveBtn, true);
    const r = await window.finchAPI.auth.changePassword({ currentPassword: cur, newPassword: nw });
    setLoading(saveBtn, false);
    if (r.success) { showToast(t('settings.pwd_changed') || 'Password changed', 'success'); closeModal(bd); }
    else showToast(r.error ?? t('settings.failed_toast'), 'error');
  });
}

function openDeleteAccountModal(): void {
  const bd = openModal(`
    <div class="modal-header"><h2 style="color:var(--danger)" data-i18n="settings.delete_account">${t('settings.delete_account')}</h2></div>
    <div class="modal-body">
      <p style="color:var(--text-secondary)" data-i18n="settings.delete_warning">${t('settings.delete_warning') || 'This will permanently delete your account and all your data. This action cannot be undone.'}</p>
      <div class="form-group" style="margin-top:8px">
        <label class="form-label required" data-i18n="settings.confirm_pwd_label">${t('settings.confirm_pwd_label') || 'Confirm your password'}</label>
        <input class="form-input" id="del-pwd" type="password" placeholder="${t('settings.pwd_placeholder') || 'Your password'}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="del-cancel" data-i18n="common.cancel">${t('common.cancel')}</button>
      <button class="btn btn-danger" id="del-confirm"><span class="btn-label" data-i18n="settings.delete_account">${t('settings.delete_account')}</span></button>
    </div>`);

  bd.querySelector('#del-cancel')?.addEventListener('click', () => closeModal(bd));
  bd.querySelector('#del-confirm')?.addEventListener('click', async () => {
    const pwd = (bd.querySelector('#del-pwd') as HTMLInputElement).value;
    if (!pwd) { showToast(t('settings.enter_pwd') || 'Enter your password', 'error'); return; }
    const ok = await confirm(t('settings.delete_confirm') || 'Are you absolutely sure? All data will be lost.', t('settings.delete_account'));
    if (!ok) return;
    const btn = bd.querySelector('#del-confirm') as HTMLButtonElement;
    setLoading(btn, true);
    const r = await window.finchAPI.auth.deleteAccount({ password: pwd });
    if (!r.success) { setLoading(btn, false); showToast(r.error ?? t('settings.failed_toast'), 'error'); }
    // On success main process switches to login window
  });
}
