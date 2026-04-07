import type { Invoice, ForecastResult } from './types';

/**
 * Computes a 3-month revenue forecast based on the trailing 6-month paid-invoice average.
 *
 * @param invoices    - Full invoice list (any status); only `status === 'paid'` are used.
 * @param referenceDate - The anchor date. The 6-month window ends at the end of the month
 *                        containing this date; the 3 forecast periods start the month after.
 * @returns Exactly 3 ForecastResult items, each with a non-negative amount.
 */
export function forecastRevenue(invoices: Invoice[], referenceDate: Date): ForecastResult[] {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth(); // 0-indexed

  // Build the 6-month window: months [windowStart, refMonth] inclusive (0-indexed).
  // We step back 5 months from refMonth to get 6 months total.
  const windowMonths: Array<{ year: number; month: number }> = [];
  for (let i = 5; i >= 0; i--) {
    let m = refMonth - i;
    let y = refYear;
    if (m < 0) {
      m += 12;
      y -= 1;
    }
    windowMonths.push({ year: y, month: m });
  }

  // Filter to paid invoices whose issueDate falls within the window.
  const paidInWindow = invoices.filter(inv => {
    if (inv.status !== 'paid') return false;
    const d = new Date(inv.issueDate);
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-indexed
    return windowMonths.some(w => w.year === y && w.month === m);
  });

  // Average monthly revenue: total / 6 (not total / number-of-paid-invoices).
  // If no paid invoices exist in the window, average is 0.
  const totalRevenue = paidInWindow.reduce((sum, inv) => sum + inv.grandTotal, 0);
  const averageMonthly = paidInWindow.length > 0 ? totalRevenue / 6 : 0;

  // Build 3 forecast periods immediately following referenceDate's month.
  const results: ForecastResult[] = [];
  for (let i = 1; i <= 3; i++) {
    let m = refMonth + i;
    let y = refYear;
    if (m > 11) {
      m -= 12;
      y += 1;
    }
    const mm = String(m + 1).padStart(2, '0'); // back to 1-indexed for display
    results.push({
      period: `${y}-${mm}`,
      amount: averageMonthly,
    });
  }

  return results;
}
