import type { Invoice, TaxSummary, TaxSummaryRow } from './types';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Aggregates paid invoices for a given calendar year into a TaxSummary.
 *
 * @param invoices - Full invoice list (any status); only `status === 'paid'` invoices
 *                   whose `issueDate` falls in `year` are included.
 * @param year     - The calendar year to summarise.
 * @returns A TaxSummary with exactly 12 rows (zero-filled for months with no paid invoices)
 *          and annual totals.
 */
export function buildTaxSummary(invoices: Invoice[], year: number): TaxSummary {
  // Filter to paid invoices in the target year
  const relevant = invoices.filter(inv => {
    if (inv.status !== 'paid') return false;
    const d = new Date(inv.issueDate);
    return d.getFullYear() === year;
  });

  // Accumulate per-month totals (month index 0-11)
  const totalInvoicedByMonth = new Array<number>(12).fill(0);
  const taxTotalByMonth = new Array<number>(12).fill(0);

  for (const inv of relevant) {
    const monthIdx = new Date(inv.issueDate).getMonth(); // 0-indexed
    totalInvoicedByMonth[monthIdx] += inv.grandTotal;
    taxTotalByMonth[monthIdx] += inv.taxTotal;
  }

  // Build 12 rows
  const rows: TaxSummaryRow[] = MONTH_LABELS.map((label, idx) => {
    const totalInvoiced = totalInvoicedByMonth[idx];
    const taxTotal = taxTotalByMonth[idx];
    return {
      month: idx + 1,
      label,
      totalInvoiced,
      taxTotal,
      net: totalInvoiced - taxTotal,
    };
  });

  const annualTotalInvoiced = rows.reduce((s, r) => s + r.totalInvoiced, 0);
  const annualTaxTotal = rows.reduce((s, r) => s + r.taxTotal, 0);

  return {
    year,
    rows,
    annualTotalInvoiced,
    annualTaxTotal,
    annualNet: annualTotalInvoiced - annualTaxTotal,
  };
}
