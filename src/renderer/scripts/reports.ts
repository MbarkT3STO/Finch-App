import type { Invoice } from '../../shared/types';
import {
  groupByMonth,
  groupByYear,
  aggregateRevenue,
  aggregateOutstanding,
  formatCurrency,
  taxSummaryByMonth,
  toCSV,
} from '../../shared/utils';
import { escapeHtml, showToast } from './ui-utils';

declare const window: Window & { finchAPI: import('../../shared/types').FinchAPI };

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Exported helper (also used by tests) ────────────────────────────────────

export function computePaidUnpaidBreakdown(
  invoices: Invoice[],
  userId: string,
): { paidTotal: number; unpaidTotal: number; paidPct: number; unpaidPct: number } {
  const paidTotal = aggregateRevenue(invoices, userId);
  const unpaidTotal = aggregateOutstanding(invoices, userId);
  const combined = paidTotal + unpaidTotal;
  if (combined === 0) {
    return { paidTotal: 0, unpaidTotal: 0, paidPct: 0, unpaidPct: 0 };
  }
  const paidPct = Math.round((paidTotal / combined) * 100);
  const unpaidPct = 100 - paidPct;
  return { paidTotal, unpaidTotal, paidPct, unpaidPct };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function initReports(container: HTMLElement): void {
  container.innerHTML = `<div class="view-container"><div id="reports-content"></div></div>`;
  loadReports(container.querySelector('#reports-content')!);
}

async function loadReports(content: HTMLElement): Promise<void> {
  const [invoicesResult, sessionResult] = await Promise.all([
    window.finchAPI.invoice.getAll(),
    window.finchAPI.auth.getSession(),
  ]);

  if (!invoicesResult.success || !sessionResult.success) {
    content.innerHTML = `
      <div class="inline-error" style="padding:24px;color:var(--danger)">
        Failed to load reports data: ${escapeHtml(invoicesResult.error ?? sessionResult.error ?? 'Unknown error')}
      </div>`;
    return;
  }

  const allInvoices = invoicesResult.data ?? [];
  const userId = sessionResult.data!.userId;
  const userInvoices = allInvoices.filter(inv => inv.userId === userId);

  const currentYear = new Date().getFullYear();

  // Collect years from invoice data
  const yearsSet = new Set<number>(userInvoices.map(inv => parseInt(inv.issueDate.split('-')[0], 10)));
  yearsSet.add(currentYear);
  const years = Array.from(yearsSet).sort((a, b) => b - a);

  // State
  let selectedYear = currentYear;
  let viewMode: 'monthly' | 'yearly' = 'monthly';

  // Build initial HTML
  content.innerHTML = `
    <div class="page-header">
      <h1>Reports</h1>
    </div>
    <div style="padding:0 28px 28px">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
        <label for="year-select" style="font-weight:500">Year:</label>
        <select id="year-select" class="form-control" style="width:120px">
          ${years.map(y => `<option value="${y}"${y === currentYear ? ' selected' : ''}>${y}</option>`).join('')}
        </select>
        <div style="display:flex;gap:4px">
          <button id="btn-monthly" class="btn btn-primary" style="min-width:90px">Monthly</button>
          <button id="btn-yearly" class="btn btn-secondary" style="min-width:90px">Yearly</button>
        </div>
      </div>

      <div class="chart-container" style="margin-bottom:28px">
        <canvas id="revenue-chart" width="600" height="200"></canvas>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px">
        <div id="breakdown-section" class="metric-card" style="padding:16px"></div>
        <div id="count-section" class="metric-card" style="padding:16px"></div>
      </div>

      <div id="tax-summary-section" style="margin-bottom:28px"></div>
    </div>`;

  const yearSelect = content.querySelector<HTMLSelectElement>('#year-select')!;
  const btnMonthly = content.querySelector<HTMLButtonElement>('#btn-monthly')!;
  const btnYearly = content.querySelector<HTMLButtonElement>('#btn-yearly')!;
  const canvas = content.querySelector<HTMLCanvasElement>('#revenue-chart')!;

  function update(): void {
    renderChart(canvas, userInvoices, selectedYear, viewMode);
    renderBreakdown(content.querySelector('#breakdown-section')!, userInvoices, userId, selectedYear, viewMode);
    renderCountSummary(content.querySelector('#count-section')!, userInvoices, userId, selectedYear, viewMode);
    renderTaxSummary(content.querySelector('#tax-summary-section')!, userInvoices, selectedYear);
  }

  yearSelect.addEventListener('change', () => {
    selectedYear = parseInt(yearSelect.value, 10);
    update();
  });

  btnMonthly.addEventListener('click', () => {
    viewMode = 'monthly';
    btnMonthly.className = 'btn btn-primary';
    btnYearly.className = 'btn btn-secondary';
    update();
  });

  btnYearly.addEventListener('click', () => {
    viewMode = 'yearly';
    btnMonthly.className = 'btn btn-secondary';
    btnYearly.className = 'btn btn-primary';
    update();
  });

  update();
}

// ─── Chart rendering ──────────────────────────────────────────────────────────

function renderChart(
  canvas: HTMLCanvasElement,
  invoices: Invoice[],
  year: number,
  mode: 'monthly' | 'yearly',
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const PADDING = { top: 16, right: 16, bottom: 36, left: 48 };
  const chartW = W - PADDING.left - PADDING.right;
  const chartH = H - PADDING.top - PADDING.bottom;

  ctx.clearRect(0, 0, W, H);

  let labels: string[];
  let values: number[];

  if (mode === 'monthly') {
    values = groupByMonth(invoices, year);
    labels = MONTH_LABELS;
  } else {
    const byYear = groupByYear(invoices);
    const sortedYears = Object.keys(byYear).sort();
    labels = sortedYears;
    values = sortedYears.map(y => byYear[y]);
    if (values.length === 0) {
      labels = [String(year)];
      values = [0];
    }
  }

  const maxVal = Math.max(...values, 1);
  const barCount = values.length;
  const gap = 4;
  const barW = Math.max(4, (chartW - gap * (barCount - 1)) / barCount);

  // Draw axes
  ctx.strokeStyle = 'rgba(128,128,128,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING.left, PADDING.top);
  ctx.lineTo(PADDING.left, PADDING.top + chartH);
  ctx.lineTo(PADDING.left + chartW, PADDING.top + chartH);
  ctx.stroke();

  // Draw bars
  ctx.fillStyle = 'var(--accent, #6366f1)';
  values.forEach((val, i) => {
    const barH = (val / maxVal) * chartH;
    const x = PADDING.left + i * (barW + gap);
    const y = PADDING.top + chartH - barH;
    ctx.fillRect(x, y, barW, barH);
  });

  // Draw labels
  ctx.fillStyle = 'var(--text-secondary, #888)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  values.forEach((_, i) => {
    const x = PADDING.left + i * (barW + gap) + barW / 2;
    const y = PADDING.top + chartH + 16;
    ctx.fillText(labels[i] ?? '', x, y);
  });

  // Draw y-axis label (max value)
  ctx.textAlign = 'right';
  ctx.fillText(formatCurrency(maxVal), PADDING.left - 4, PADDING.top + 8);
}

// ─── Breakdown section ────────────────────────────────────────────────────────

function renderBreakdown(
  el: Element,
  invoices: Invoice[],
  userId: string,
  year: number,
  mode: 'monthly' | 'yearly',
): void {
  const filtered = mode === 'monthly' ? invoices.filter(inv => inv.issueDate.startsWith(String(year))) : invoices;
  const { paidTotal, unpaidTotal, paidPct, unpaidPct } = computePaidUnpaidBreakdown(filtered, userId);

  el.innerHTML = `
    <h3 style="margin:0 0 12px;font-size:0.9rem;font-weight:600">Paid vs Unpaid</h3>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--success)">Paid</span>
        <span>${escapeHtml(formatCurrency(paidTotal))} <strong>(${paidPct}%)</strong></span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--warning)">Unpaid / Overdue</span>
        <span>${escapeHtml(formatCurrency(unpaidTotal))} <strong>(${unpaidPct}%)</strong></span>
      </div>
    </div>`;
}

// ─── Count summary section ────────────────────────────────────────────────────

function renderCountSummary(
  el: Element,
  invoices: Invoice[],
  userId: string,
  year: number,
  mode: 'monthly' | 'yearly',
): void {
  const filtered = mode === 'monthly'
    ? invoices.filter(inv => inv.issueDate.startsWith(String(year)))
    : invoices;

  const userFiltered = filtered.filter(inv => inv.userId === userId);
  const total = userFiltered.length;
  const paid = userFiltered.filter(inv => inv.status === 'paid').length;
  const unpaidOverdue = userFiltered.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue').length;
  const draft = userFiltered.filter(inv => inv.status === 'draft').length;

  el.innerHTML = `
    <h3 style="margin:0 0 12px;font-size:0.9rem;font-weight:600">Invoice Count Summary</h3>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;justify-content:space-between"><span>Total Issued</span><strong>${total}</strong></div>
      <div style="display:flex;justify-content:space-between"><span>Paid</span><strong>${paid}</strong></div>
      <div style="display:flex;justify-content:space-between"><span>Unpaid / Overdue</span><strong>${unpaidOverdue}</strong></div>
      <div style="display:flex;justify-content:space-between"><span>Draft</span><strong>${draft}</strong></div>
    </div>`;
}

// ─── Tax Summary section ──────────────────────────────────────────────────────

export function renderTaxSummary(el: Element, invoices: Invoice[], year: number): void {
  const rows = taxSummaryByMonth(invoices, year);

  const totals = rows.reduce(
    (acc, row) => {
      acc.invoiced += row.invoiced;
      acc.taxTotal += row.taxTotal;
      acc.net += row.net;
      return acc;
    },
    { invoiced: 0, taxTotal: 0, net: 0 },
  );

  const monthRows = rows.map((row, i) => `
    <tr>
      <td>${MONTH_LABELS[i]}</td>
      <td>${escapeHtml(formatCurrency(row.invoiced))}</td>
      <td>${escapeHtml(formatCurrency(row.taxTotal))}</td>
      <td>${escapeHtml(formatCurrency(row.net))}</td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="metric-card" style="padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h3 style="margin:0;font-size:0.9rem;font-weight:600">Tax Summary — ${year}</h3>
        <button id="export-csv-btn" class="btn btn-secondary" style="font-size:0.8rem;padding:4px 12px">Export CSV</button>
      </div>
      <table class="tax-table" style="width:100%;border-collapse:collapse;font-size:0.85rem">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">Month</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">Total Invoiced</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">Tax Collected</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">Net Amount</th>
          </tr>
        </thead>
        <tbody>
          ${monthRows}
        </tbody>
        <tfoot>
          <tr class="totals-row" style="font-weight:600;border-top:2px solid var(--border)">
            <td style="padding:6px 8px">Total</td>
            <td style="text-align:right;padding:6px 8px">${escapeHtml(formatCurrency(totals.invoiced))}</td>
            <td style="text-align:right;padding:6px 8px">${escapeHtml(formatCurrency(totals.taxTotal))}</td>
            <td style="text-align:right;padding:6px 8px">${escapeHtml(formatCurrency(totals.net))}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;

  const exportBtn = el.querySelector<HTMLButtonElement>('#export-csv-btn')!;
  exportBtn.addEventListener('click', async () => {
    const headers = ['Month', 'Total Invoiced', 'Tax Collected', 'Net Amount'];
    const dataRows: string[][] = rows.map((row, i) => [
      MONTH_LABELS[i],
      formatCurrency(row.invoiced),
      formatCurrency(row.taxTotal),
      formatCurrency(row.net),
    ]);
    dataRows.push([
      'Total',
      formatCurrency(totals.invoiced),
      formatCurrency(totals.taxTotal),
      formatCurrency(totals.net),
    ]);

    const csv = toCSV(headers, dataRows);
    const result = await window.finchAPI.csv.save({ csv, defaultName: `tax-summary-${year}.csv` });
    if (result.success) {
      showToast('Tax summary exported successfully.', 'success');
    } else {
      showToast(`Export failed: ${result.error ?? 'Unknown error'}`, 'error');
    }
  });
}
