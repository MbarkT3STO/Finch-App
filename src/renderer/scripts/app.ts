import { initDashboard } from './dashboard';
import { initInvoiceList } from './invoice-list';
import { initInvoiceEditor } from './invoice-editor';
import { initClientManager } from './client-manager';
import { initReports } from './reports';
import { initSettings } from './settings';
import { showToast } from './ui-utils';

// ─── State ────────────────────────────────────────────────────────────────────
let currentRoute = '';
let username = '';

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot(): Promise<void> {
  const r = await window.finchAPI.auth.getSession();
  if (!r.success || !r.data) {
    // Should not happen — main process guards this, but just in case
    showToast('Session expired, please log in again', 'warning');
    return;
  }
  username = r.data.username;

  // Set user avatar
  const av = document.getElementById('user-avatar');
  if (av) av.textContent = username.charAt(0).toUpperCase();
  const nm = document.getElementById('user-name');
  if (nm) nm.textContent = username;

  // Window controls
  document.getElementById('wc-close')?.addEventListener('click', () => window.finchAPI.window.close());
  document.getElementById('wc-minimize')?.addEventListener('click', () => window.finchAPI.window.minimize());
  document.getElementById('wc-maximize')?.addEventListener('click', () => window.finchAPI.window.maximize());

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await window.finchAPI.auth.logout();
  });

  // Nav items
  document.querySelectorAll<HTMLButtonElement>('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.route!));
  });

  // Theme init
  const settingsR = await window.finchAPI.settings.get();
  if (settingsR.success && settingsR.data) {
    applyTheme(settingsR.data.theme);
  }

  // Router
  window.addEventListener('hashchange', () => navigate(window.location.hash || '#/dashboard'));

  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 'n') { e.preventDefault(); navigate('#/invoice/new'); }
    if (ctrl && e.key === 'z') { e.preventDefault(); window.finchAPI.on('app:shortcut', () => {}); }
  });

  // Listen for menu shortcuts
  window.finchAPI.on('app:shortcut', (action: unknown) => {
    switch (action) {
      case 'new-invoice':    navigate('#/invoice/new'); break;
      case 'toggle-theme': {
        const cur = document.documentElement.getAttribute('data-theme') ?? 'light';
        applyTheme(cur === 'dark' ? 'light' : 'dark');
        break;
      }
    }
  });

  // Navigate to initial route
  navigate(window.location.hash || '#/dashboard');
}

// ─── Router ───────────────────────────────────────────────────────────────────
function navigate(route: string): void {
  if (!route || route === '') route = '#/dashboard';
  window.location.hash = route.replace(/^#/, '#');
  currentRoute = route;

  const view = document.getElementById('app-view')!;
  view.innerHTML = '';
  updateNavHighlight(route);

  if (route === '#/dashboard') {
    initDashboard(view, navigate);
  } else if (route === '#/invoices' || route === '#/' || route === '') {
    initInvoiceList(view, navigate);
  } else if (route === '#/invoice/new') {
    initInvoiceEditor(view, null, navigate);
  } else if (route.startsWith('#/invoice/edit/')) {
    const id = route.split('/').pop()!;
    initInvoiceEditor(view, id, navigate);
  } else if (route === '#/reports') {
    initReports(view);
  } else if (route === '#/clients') {
    initClientManager(view, navigate);
  } else if (route === '#/settings') {
    initSettings(view);
  } else {
    initDashboard(view, navigate);
  }
}

function updateNavHighlight(route: string): void {
  document.querySelectorAll<HTMLButtonElement>('.nav-item[data-route]').forEach(item => {
    const r = item.dataset.route!;
    const active =
      route === r ||
      (r === '#/dashboard' && (route === '' || route === '#/')) ||
      (r === '#/invoices' && route.startsWith('#/invoice'));
    item.classList.toggle('active', active);
  });
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(theme: string): void {
  const root = document.documentElement;
  if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', boot);
