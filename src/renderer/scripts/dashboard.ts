import type { Invoice } from '../../shared/types';
import { aggregateRevenue, aggregateOutstanding, formatCurrency, isOverdue } from '../../shared/utils';
import { escapeHtml } from './ui-utils';
import { t } from './i18n';

declare const window: Window & { finchAPI: import('../../shared/types').FinchAPI };

export function initDashboard(container: HTMLElement, navigate: (route: string) => void): void {
  container.innerHTML = `<div class="view-container"><div id="dashboard-content"></div></div>`;
  loadDashboard(container.querySelector('#dashboard-content')!, navigate);
}

async function loadDashboard(content: HTMLElement, navigate: (route: string) => void): Promise<void> {
  const [invoicesResult, sessionResult] = await Promise.all([
    window.finchAPI.invoice.getAll(),
    window.finchAPI.auth.getSession(),
  ]);

  if (!invoicesResult.success || !sessionResult.success) {
    content.innerHTML = `
      <div class="inline-error" style="padding:24px;color:var(--danger)">
        Failed to load dashboard data: ${escapeHtml(invoicesResult.error ?? sessionResult.error ?? 'Unknown error')}
      </div>`;
    return;
  }

  const invoices = invoicesResult.data ?? [];
  const userId = sessionResult.data!.userId;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  const thisMonthInvoices = invoices.filter(inv => {
    const [year, month] = inv.issueDate.split('-').map(Number);
    return year === currentYear && month === currentMonth;
  });

  const monthRevenue = aggregateRevenue(thisMonthInvoices, userId);
  const totalOutstanding = aggregateOutstanding(invoices, userId);
  const overdueCount = invoices.filter(inv => inv.userId === userId && isOverdue(inv.dueDate, inv.status)).length;
  const draftCount = invoices.filter(inv => inv.userId === userId && inv.status === 'draft').length;

  const recentActivity = invoices
    .filter(inv => inv.userId === userId)
    .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0))
    .slice(0, 5);

  content.innerHTML = `
    <div class="page-header">
      <h1 data-i18n="dashboard.title">${t('dashboard.title')}</h1>
    </div>
    <div style="padding:0 28px 28px">
      <div class="metrics-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:28px">
        ${renderMetricCard(formatCurrency(monthRevenue), "dashboard.this_month_revenue", `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`, 'revenue')}
        ${renderMetricCard(formatCurrency(totalOutstanding), 'dashboard.total_outstanding', `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`, 'outstanding')}
        ${renderMetricCard(String(overdueCount), 'dashboard.overdue_invoices', `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>`, 'overdue')}
        ${renderMetricCard(String(draftCount), 'dashboard.draft_invoices', `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`, 'draft')}
      </div>
      <div class="section">
        <h2 style="margin:0 0 16px;font-size:1rem;font-weight:600" data-i18n="dashboard.recent_activity">${t('dashboard.recent_activity')}</h2>
        ${renderRecentActivity(recentActivity)}
      </div>
    </div>`;

  content.querySelectorAll<HTMLTableRowElement>('.recent-activity-row').forEach(row => {
    row.addEventListener('click', () => navigate(`#/invoice/edit/${row.dataset.id}`));
  });
}

function renderMetricCard(value: string, labelKey: string, iconHtml: string, colorClass: string): string {
  return `
    <div class="metric-card metric-${colorClass}">
      <div class="metric-icon">${iconHtml}</div>
      <div class="metric-content">
        <div class="metric-value">${escapeHtml(value)}</div>
        <div class="metric-label" data-i18n="${labelKey}">${t(labelKey)}</div>
      </div>
    </div>`;
}

function renderRecentActivity(invoices: Invoice[]): string {
  if (!invoices.length) {
    return `<div class="empty-state"><p data-i18n="dashboard.no_activity">${t('dashboard.no_activity')}</p></div>`;
  }

  const rows = invoices.map(inv => {
    const clientName = inv.billTo.name || inv.billTo.company || 'Unknown';
    const sym = inv.currencySymbol || '$';
    return `
      <tr class="recent-activity-row" data-id="${inv.id}" style="cursor:pointer">
        <td class="col-mono" style="font-weight:600">${escapeHtml(inv.number)}</td>
        <td>${escapeHtml(clientName)}</td>
        <td>${escapeHtml(formatCurrency(inv.grandTotal, sym))}</td>
        <td><span class="badge badge-${inv.status}">${t(`status.${inv.status}`) || inv.status}</span></td>
      </tr>`;
  }).join('');

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th data-i18n="dashboard.number">${t('dashboard.number')}</th>
          <th data-i18n="dashboard.client">${t('dashboard.client')}</th>
          <th data-i18n="dashboard.amount">${t('dashboard.amount')}</th>
          <th data-i18n="dashboard.status">${t('dashboard.status')}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}
