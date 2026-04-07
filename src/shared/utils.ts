export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function formatCurrency(amount: number, symbol = '$', decimals = 2): string {
  const formatted = Math.abs(amount)
    .toFixed(decimals)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function addDaysISO(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return function (...args: Parameters<T>) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function sanitizePath(inputPath: string): string {
  return inputPath.replace(/\.\.[/\\]/g, '').replace(/[<>:"|?*]/g, '_');
}

export function isOverdue(dueDate: string, status: string): boolean {
  if (status === 'paid' || status === 'cancelled') return false;
  return dueDate ? new Date(dueDate) < new Date() : false;
}

export interface TotalsResult {
  subtotal: number;
  discountAmount: number;
  taxTotal: number;
  grandTotal: number;
}

export function calculateTotals(
  lineItems: Array<{ quantity: number; unitPrice: number; taxRate: number }>,
  discount: { type: 'percent' | 'fixed'; value: number },
  shipping: number,
  taxMode: 'inclusive' | 'exclusive',
): TotalsResult {
  const subtotal = lineItems.reduce((s, item) => s + item.quantity * item.unitPrice, 0);

  const discountAmount =
    discount.type === 'percent'
      ? subtotal * (discount.value / 100)
      : Math.min(discount.value, subtotal);

  const taxableBase = subtotal - discountAmount;

  let taxTotal = 0;
  if (taxMode === 'exclusive') {
    taxTotal = lineItems.reduce((s, item) => {
      const lineSubtotal = item.quantity * item.unitPrice;
      const lineDiscount =
        discount.type === 'percent'
          ? lineSubtotal * (discount.value / 100)
          : subtotal > 0
            ? lineSubtotal * (discountAmount / subtotal)
            : 0;
      return s + (lineSubtotal - lineDiscount) * (item.taxRate / 100);
    }, 0);
  } else {
    taxTotal = lineItems.reduce((s, item) => {
      const lineSubtotal = item.quantity * item.unitPrice;
      return s + lineSubtotal - lineSubtotal / (1 + item.taxRate / 100);
    }, 0);
  }

  const grandTotal = taxableBase + (taxMode === 'exclusive' ? taxTotal : 0) + shipping;

  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    subtotal: r(subtotal),
    discountAmount: r(discountAmount),
    taxTotal: r(taxTotal),
    grandTotal: r(grandTotal),
  };
}

// ─── Aggregation Utilities ────────────────────────────────────────────────────
import type { Invoice } from './types';

export function aggregateRevenue(invoices: Invoice[], userId: string): number {
  return invoices
    .filter(inv => inv.status === 'paid' && inv.userId === userId)
    .reduce((sum, inv) => sum + inv.grandTotal, 0);
}

export function aggregateOutstanding(invoices: Invoice[], userId: string): number {
  return invoices
    .filter(inv => (inv.status === 'unpaid' || inv.status === 'overdue') && inv.userId === userId)
    .reduce((sum, inv) => sum + inv.grandTotal, 0);
}

export function groupByMonth(invoices: Invoice[], year: number): number[] {
  const totals = new Array<number>(12).fill(0);
  for (const inv of invoices) {
    if (inv.status !== 'paid') continue;
    const invYear = parseInt(inv.issueDate.split('-')[0], 10);
    if (invYear !== year) continue;
    const month = parseInt(inv.issueDate.split('-')[1], 10) - 1; // 0-indexed
    totals[month] += inv.grandTotal;
  }
  return totals;
}

export function groupByYear(invoices: Invoice[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const inv of invoices) {
    if (inv.status !== 'paid') continue;
    const year = inv.issueDate.split('-')[0];
    result[year] = (result[year] ?? 0) + inv.grandTotal;
  }
  return result;
}

export function taxSummaryByMonth(
  invoices: Invoice[],
  year: number,
): Array<{ invoiced: number; taxTotal: number; net: number }> {
  const rows = Array.from({ length: 12 }, () => ({ invoiced: 0, taxTotal: 0, net: 0 }));
  for (const inv of invoices) {
    if (inv.status !== 'paid') continue;
    const invYear = parseInt(inv.issueDate.split('-')[0], 10);
    if (invYear !== year) continue;
    const month = parseInt(inv.issueDate.split('-')[1], 10) - 1;
    rows[month].invoiced += inv.grandTotal;
    rows[month].taxTotal += inv.taxTotal;
  }
  for (const row of rows) {
    row.net = row.invoiced - row.taxTotal;
  }
  return rows;
}

// ─── CSV Export Utility ───────────────────────────────────────────────────────

/**
 * Serialises headers and rows to an RFC 4180-compliant CSV string.
 * - Header row is always the first line
 * - Fields containing commas, double-quotes, or newlines are double-quoted
 * - Internal double-quotes are doubled
 * - Lines are separated by CRLF (\r\n)
 */
export function toCSV(headers: string[], rows: string[][]): string {
  function escapeField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
      return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
  }

  const lines: string[] = [];
  lines.push(headers.map(escapeField).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeField).join(','));
  }
  return lines.join('\r\n');
}
