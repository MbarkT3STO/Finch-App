import type { Invoice } from '../../shared/types';
import { aggregateRevenue, aggregateOutstanding, formatCurrency, isOverdue } from '../../shared/utils';
import { escapeHtml } from './ui-utils';

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
      <h1>Dashboard</h1>
    </div>
    <div style="padding:0 28px 28px">
      <div class="metrics-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:28px">
        ${renderMetricCard(formatCurrency(monthRevenue), "This Month's Revenue")}
        ${renderMetricCard(formatCurrency(totalOutstanding), 'Total Outstanding')}
        ${renderMetricCard(String(overdueCount), 'Overdue Invoices')}
        ${renderMetricCard(String(draftCount), 'Draft Invoices')}
      </div>
      <div class="section">
        <h2 style="margin:0 0 16px;font-size:1rem;font-weight:600">Recent Activity</h2>
        ${renderRecentActivity(recentActivity)}
      </div>
    </div>`;

  content.querySelectorAll<HTMLTableRowElement>('.recent-activity-row').forEach(row => {
    row.addEventListener('click', () => navigate(`#/invoice/edit/${row.dataset.id}`));
  });
}

function renderMetricCard(value: string, label: string): string {
  return `
    <div class="metric-card">
      <div class="metric-value">${escapeHtml(value)}</div>
      <div class="metric-label">${escapeHtml(label)}</div>
    </div>`;
}

function renderRecentActivity(invoices: Invoice[]): string {
  if (!invoices.length) {
    return `<div class="empty-state"><p>No recent activity. Create your first invoice to get started.</p></div>`;
  }

  const rows = invoices.map(inv => {
    const clientName = inv.billTo.name || inv.billTo.company || 'Unknown';
    const sym = inv.currencySymbol || '$';
    return `
      <tr class="recent-activity-row" data-id="${inv.id}" style="cursor:pointer">
        <td class="col-mono" style="font-weight:600">${escapeHtml(inv.number)}</td>
        <td>${escapeHtml(clientName)}</td>
        <td>${escapeHtml(formatCurrency(inv.grandTotal, sym))}</td>
        <td><span class="badge badge-${inv.status}">${inv.status}</span></td>
      </tr>`;
  }).join('');

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th># Number</th>
          <th>Client</th>
          <th>Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}
