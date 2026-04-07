import type { Invoice, Expense } from '../../shared/types';
import {
  groupByMonth,
  groupByYear,
  aggregateRevenue,
  aggregateOutstanding,
  formatCurrency,
  taxSummaryByMonth,
  toCSV,
} from '../../shared/utils';
import { buildTaxSummary } from '../../shared/tax-report-generator';
import { forecastRevenue } from '../../shared/forecast-engine';
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
  const [invoicesResult, sessionResult, expensesResult] = await Promise.all([
    window.finchAPI.invoice.getAll(),
    window.finchAPI.auth.getSession(),
    window.finchAPI.expense.getAll(),
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
  let expenses: Expense[] = expensesResult.success ? (expensesResult.data ?? []) : [];

  const currentYear = new Date().getFullYear();

  const yearsSet = new Set<number>(userInvoices.map(inv => parseInt(inv.issueDate.split('-')[0], 10)));
  yearsSet.add(currentYear);
  const years = Array.from(yearsSet).sort((a, b) => b - a);

  let selectedYear = currentYear;
  let viewMode: 'monthly' | 'yearly' = 'monthly';
  let editingExpenseId: string | null = null;

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
      <div id="profit-loss-section" style="margin-bottom:28px"></div>
      <div id="expense-section" style="margin-bottom:28px"></div>
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
    renderProfitLoss(content.querySelector('#profit-loss-section')!, userInvoices, expenses, selectedYear);
    renderExpenseSection(content.querySelector('#expense-section')!, expenses, selectedYear);
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

  // ─── Expense section event delegation ────────────────────────────────────

  function renderExpenseSection(el: Element, expList: Expense[], year: number): void {
    const yearExpenses = expList.filter(e => e.date.startsWith(String(year)));
    const editing = editingExpenseId ? expList.find(e => e.id === editingExpenseId) : null;

    el.innerHTML = `
      <div class="metric-card" style="padding:20px 24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h3 style="margin:0;font-size:0.9rem;font-weight:600">Expenses — ${year}</h3>
        </div>

        <form id="expense-form" style="background:var(--bg-surface-2);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;margin-bottom:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group">
              <label class="form-label">Date</label>
              <input id="exp-date" type="date" class="form-input" value="${escapeHtml(editing?.date ?? '')}">
              <span id="exp-date-err" class="form-error" style="display:none"></span>
            </div>
            <div class="form-group">
              <label class="form-label">Amount</label>
              <input id="exp-amount" type="number" min="0" step="0.01" class="form-input" value="${editing ? editing.amount : ''}" placeholder="0.00">
              <span id="exp-amount-err" class="form-error" style="display:none"></span>
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <input id="exp-category" type="text" class="form-input" value="${escapeHtml(editing?.category ?? '')}" placeholder="e.g. Software">
              <span id="exp-category-err" class="form-error" style="display:none"></span>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <input id="exp-description" type="text" class="form-input" value="${escapeHtml(editing?.description ?? '')}" placeholder="e.g. Figma subscription">
              <span id="exp-description-err" class="form-error" style="display:none"></span>
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <button type="submit" class="btn btn-primary btn-sm">${editing ? 'Update Expense' : 'Add Expense'}</button>
            ${editing ? `<button type="button" id="exp-cancel-edit" class="btn btn-secondary btn-sm">Cancel</button>` : ''}
          </div>
        </form>

        <div id="expense-list">
          ${yearExpenses.length === 0
            ? `<div class="empty-state" style="padding:32px 0">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>
                <p>No expenses recorded for ${year}.</p>
              </div>`
            : `<table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th class="col-amount">Amount</th>
                    <th class="col-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  ${yearExpenses.map(exp => `
                    <tr>
                      <td>${escapeHtml(exp.date)}</td>
                      <td>${escapeHtml(exp.category)}</td>
                      <td>${escapeHtml(exp.description)}</td>
                      <td class="col-amount">${escapeHtml(formatCurrency(exp.amount))}</td>
                      <td class="col-actions">
                        <div style="display:flex;gap:4px;justify-content:flex-end">
                          <button class="btn btn-ghost btn-sm exp-edit-btn" data-id="${escapeHtml(exp.id)}">Edit</button>
                          <button class="btn btn-danger btn-sm exp-delete-btn" data-id="${escapeHtml(exp.id)}">Delete</button>
                        </div>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>`}
        </div>
      </div>`;

    // Form submit
    el.querySelector<HTMLFormElement>('#expense-form')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dateVal = (el.querySelector<HTMLInputElement>('#exp-date')!).value.trim();
      const amountVal = (el.querySelector<HTMLInputElement>('#exp-amount')!).value.trim();
      const categoryVal = (el.querySelector<HTMLInputElement>('#exp-category')!).value.trim();
      const descriptionVal = (el.querySelector<HTMLInputElement>('#exp-description')!).value.trim();

      let valid = true;
      function setErr(id: string, msg: string) {
        const el2 = el.querySelector<HTMLElement>(id)!;
        if (msg) { el2.textContent = msg; el2.style.display = 'block'; valid = false; }
        else { el2.style.display = 'none'; }
      }

      setErr('#exp-date-err', !dateVal ? 'Date is required.' : '');
      setErr('#exp-amount-err', amountVal === '' ? 'Amount is required.' : parseFloat(amountVal) < 0 ? 'Amount must be ≥ 0.' : '');
      setErr('#exp-category-err', !categoryVal ? 'Category is required.' : '');
      setErr('#exp-description-err', !descriptionVal ? 'Description is required.' : '');

      if (!valid) return;

      const payload = { date: dateVal, amount: parseFloat(amountVal), category: categoryVal, description: descriptionVal };

      if (editingExpenseId) {
        const res = await window.finchAPI.expense.update({ id: editingExpenseId, expense: payload });
        if (res.success && res.data) {
          expenses = expenses.map(ex => ex.id === editingExpenseId ? res.data! : ex);
          editingExpenseId = null;
        } else {
          showToast(`Failed to update expense: ${res.error ?? 'Unknown error'}`, 'error');
          return;
        }
      } else {
        const res = await window.finchAPI.expense.create(payload);
        if (res.success && res.data) {
          expenses = [...expenses, res.data];
        } else {
          showToast(`Failed to add expense: ${res.error ?? 'Unknown error'}`, 'error');
          return;
        }
      }
      update();
    });

    // Cancel edit
    el.querySelector<HTMLButtonElement>('#exp-cancel-edit')?.addEventListener('click', () => {
      editingExpenseId = null;
      update();
    });

    // Edit / Delete delegation
    el.querySelector('#expense-list')!.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const id = target.dataset.id;
      if (!id) return;

      if (target.classList.contains('exp-edit-btn')) {
        editingExpenseId = id;
        update();
      } else if (target.classList.contains('exp-delete-btn')) {
        const res = await window.finchAPI.expense.delete(id);
        if (res.success) {
          expenses = expenses.filter(ex => ex.id !== id);
          if (editingExpenseId === id) editingExpenseId = null;
          update();
        } else {
          showToast(`Failed to delete expense: ${res.error ?? 'Unknown error'}`, 'error');
        }
      }
    });
  }

  update();
}

// ─── Chart rendering (with forecast bars) ────────────────────────────────────

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
  let forecastValues: number[] = [];
  let forecastLabels: string[] = [];

  if (mode === 'monthly') {
    values = groupByMonth(invoices, year);
    labels = MONTH_LABELS;

    // Compute forecast using the last day of the selected year as reference
    const refDate = new Date(year, 11, 31);
    const forecasts = forecastRevenue(invoices, refDate);
    forecastValues = forecasts.map(f => f.amount);
    forecastLabels = forecasts.map(f => {
      const [, mm] = f.period.split('-');
      return MONTH_LABELS[parseInt(mm, 10) - 1] ?? f.period;
    });
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

  const allValues = [...values, ...forecastValues];
  const maxVal = Math.max(...allValues, 1);
  const totalBars = values.length + forecastValues.length;
  const gap = 4;
  const barW = Math.max(4, (chartW - gap * (totalBars - 1)) / totalBars);

  // Draw axes
  ctx.strokeStyle = 'rgba(128,128,128,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING.left, PADDING.top);
  ctx.lineTo(PADDING.left, PADDING.top + chartH);
  ctx.lineTo(PADDING.left + chartW, PADDING.top + chartH);
  ctx.stroke();

  // Draw historical bars
  ctx.fillStyle = 'var(--accent, #6366f1)';
  values.forEach((val, i) => {
    const barH = (val / maxVal) * chartH;
    const x = PADDING.left + i * (barW + gap);
    const y = PADDING.top + chartH - barH;
    ctx.fillRect(x, y, barW, barH);
  });

  // Draw forecast bars (distinct colour with dashed border)
  const forecastColor = '#a5b4fc';
  forecastValues.forEach((val, i) => {
    const barH = Math.max((val / maxVal) * chartH, 2);
    const x = PADDING.left + (values.length + i) * (barW + gap);
    const y = PADDING.top + chartH - barH;

    ctx.fillStyle = forecastColor;
    ctx.fillRect(x, y, barW, barH);

    // Dashed border to distinguish forecast bars
    ctx.save();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(x, y, barW, barH);
    ctx.restore();
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
  forecastLabels.forEach((lbl, i) => {
    const x = PADDING.left + (values.length + i) * (barW + gap) + barW / 2;
    const y = PADDING.top + chartH + 16;
    ctx.fillStyle = '#a5b4fc';
    ctx.fillText(lbl, x, y);
    ctx.fillStyle = 'var(--text-secondary, #888)';
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

// ─── Tax Summary section (with Export Tax Report dropdown) ───────────────────

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
        <div style="position:relative;display:inline-block">
          <button id="export-tax-btn" class="btn btn-secondary" style="font-size:0.8rem;padding:4px 12px">
            Export Tax Report ▾
          </button>
          <div id="export-tax-menu" style="display:none;position:absolute;right:0;top:100%;margin-top:4px;background:var(--surface,#fff);border:1px solid var(--border);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.12);z-index:100;min-width:160px">
            <button id="export-csv-btn" style="display:block;width:100%;text-align:left;padding:8px 14px;background:none;border:none;cursor:pointer;font-size:0.85rem;color:var(--text)">Export as CSV</button>
            <button id="export-pdf-btn" style="display:block;width:100%;text-align:left;padding:8px 14px;background:none;border:none;cursor:pointer;font-size:0.85rem;color:var(--text)">Export as PDF</button>
          </div>
        </div>
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

  // Toggle dropdown
  const exportBtn = el.querySelector<HTMLButtonElement>('#export-tax-btn')!;
  const exportMenu = el.querySelector<HTMLElement>('#export-tax-menu')!;

  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.style.display = exportMenu.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', () => { exportMenu.style.display = 'none'; }, { once: true });

  // ─── CSV export ───────────────────────────────────────────────────────────
  el.querySelector<HTMLButtonElement>('#export-csv-btn')!.addEventListener('click', async () => {
    exportMenu.style.display = 'none';
    const summary = buildTaxSummary(invoices, year);
    const headers = ['Month', 'Total Invoiced', 'Tax Collected', 'Net Amount'];
    const dataRows: string[][] = summary.rows.map(row => [
      row.label,
      formatCurrency(row.totalInvoiced),
      formatCurrency(row.taxTotal),
      formatCurrency(row.net),
    ]);
    dataRows.push([
      'Total',
      formatCurrency(summary.annualTotalInvoiced),
      formatCurrency(summary.annualTaxTotal),
      formatCurrency(summary.annualNet),
    ]);

    const csv = toCSV(headers, dataRows);
    const defaultName = `tax-report-${year}.csv`;
    const result = await window.finchAPI.report.exportCsv({ csv, defaultName });
    handleExportResult(result);
  });

  // ─── PDF export ───────────────────────────────────────────────────────────
  el.querySelector<HTMLButtonElement>('#export-pdf-btn')!.addEventListener('click', async () => {
    exportMenu.style.display = 'none';
    const summary = buildTaxSummary(invoices, year);
    const html = buildTaxReportHtml(summary);
    const defaultName = `tax-report-${year}.pdf`;
    const result = await window.finchAPI.report.exportPdf({ html, defaultName });
    handleExportResult(result);
  });
}

// ─── Export result handler (toasts + Show in Folder) ─────────────────────────

function handleExportResult(result: import('../../shared/types').ApiResponse<string>): void {
  if (!result.success) {
    if (result.error === 'Cancelled') return;
    showToast(`Export failed: ${result.error ?? 'Unknown error'}`, 'error');
    return;
  }

  const filePath = result.data;
  if (filePath) {
    showToastWithAction('Export successful.', 'success', 'Show in Folder', () => {
      window.finchAPI.shell.showItemInFolder(filePath);
    });
  } else {
    showToast('Export successful.', 'success');
  }
}

function showToastWithAction(message: string, type: 'success' | 'error', actionLabel: string, onAction: () => void): void {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-msg">${escapeHtml(message)}</span>
    <button class="btn btn-secondary toast-action" style="font-size:0.75rem;padding:2px 8px;margin-left:8px">${escapeHtml(actionLabel)}</button>
    <button class="toast-close" aria-label="Close" style="margin-left:8px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>`;

  container.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.querySelector<HTMLButtonElement>('.toast-action')!.addEventListener('click', () => { onAction(); dismiss(); });
  toast.querySelector<HTMLButtonElement>('.toast-close')!.addEventListener('click', dismiss);
  setTimeout(dismiss, 6000);
}

// ─── Tax report HTML for PDF export ──────────────────────────────────────────

function buildTaxReportHtml(summary: import('../../shared/types').TaxSummary): string {
  const rowsHtml = summary.rows.map(row => `
    <tr>
      <td>${escapeHtml(row.label)}</td>
      <td style="text-align:right">${escapeHtml(formatCurrency(row.totalInvoiced))}</td>
      <td style="text-align:right">${escapeHtml(formatCurrency(row.taxTotal))}</td>
      <td style="text-align:right">${escapeHtml(formatCurrency(row.net))}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tax Report ${summary.year}</title>
  <style>
    body { font-family: sans-serif; padding: 32px; color: #111; }
    h1 { font-size: 1.4rem; margin-bottom: 4px; }
    .meta { color: #666; font-size: 0.85rem; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th { text-align: left; padding: 8px; border-bottom: 2px solid #333; }
    td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
    td:not(:first-child) { text-align: right; }
    .totals td { font-weight: 600; border-top: 2px solid #333; border-bottom: none; }
  </style>
</head>
<body>
  <h1>Tax Report — ${summary.year}</h1>
  <p class="meta">Generated: ${new Date().toLocaleDateString()}</p>
  <table>
    <thead>
      <tr>
        <th>Month</th>
        <th style="text-align:right">Total Invoiced</th>
        <th style="text-align:right">Tax Collected</th>
        <th style="text-align:right">Net Amount</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr class="totals">
        <td>Total</td>
        <td>${escapeHtml(formatCurrency(summary.annualTotalInvoiced))}</td>
        <td>${escapeHtml(formatCurrency(summary.annualTaxTotal))}</td>
        <td>${escapeHtml(formatCurrency(summary.annualNet))}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}

// ─── Profit / Loss table ──────────────────────────────────────────────────────

export function renderProfitLoss(el: Element, invoices: Invoice[], expenses: Expense[], year: number): void {
  const revenueByMonth = groupByMonth(invoices, year);

  // Sum expenses per month for the selected year
  const expensesByMonth = new Array<number>(12).fill(0);
  for (const exp of expenses) {
    if (!exp.date.startsWith(String(year))) continue;
    const monthIdx = parseInt(exp.date.split('-')[1], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      expensesByMonth[monthIdx] += exp.amount;
    }
  }

  let totalRevenue = 0;
  let totalExpenses = 0;

  const monthRows = MONTH_LABELS.map((label, i) => {
    const rev = revenueByMonth[i];
    const exp = expensesByMonth[i];
    const net = rev - exp;
    totalRevenue += rev;
    totalExpenses += exp;
    const netColor = net < 0 ? 'color:var(--danger)' : net > 0 ? 'color:var(--success)' : '';
    return `
      <tr>
        <td style="padding:6px 8px">${label}</td>
        <td style="text-align:right;padding:6px 8px">${escapeHtml(formatCurrency(rev))}</td>
        <td style="text-align:right;padding:6px 8px">${escapeHtml(formatCurrency(exp))}</td>
        <td style="text-align:right;padding:6px 8px;${netColor}">${escapeHtml(formatCurrency(net))}</td>
      </tr>`;
  }).join('');

  const totalNet = totalRevenue - totalExpenses;
  const totalNetColor = totalNet < 0 ? 'color:var(--danger)' : totalNet > 0 ? 'color:var(--success)' : '';

  el.innerHTML = `
    <div class="metric-card" style="padding:16px">
      <h3 style="margin:0 0 12px;font-size:0.9rem;font-weight:600">Profit / Loss — ${year}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">Month</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">Revenue</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">Expenses</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">Net</th>
          </tr>
        </thead>
        <tbody>${monthRows}</tbody>
        <tfoot>
          <tr style="font-weight:600;border-top:2px solid var(--border)">
            <td style="padding:6px 8px">Total</td>
            <td style="text-align:right;padding:6px 8px">${escapeHtml(formatCurrency(totalRevenue))}</td>
            <td style="text-align:right;padding:6px 8px">${escapeHtml(formatCurrency(totalExpenses))}</td>
            <td style="text-align:right;padding:6px 8px;${totalNetColor}">${escapeHtml(formatCurrency(totalNet))}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}
