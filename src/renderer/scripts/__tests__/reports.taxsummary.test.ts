/**
 * Property-based tests for Tax Summary CSV round-trip
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 8.1, 8.2**
 */
import { describe, it, expect } from 'vitest';
import { taxSummaryByMonth, toCSV, formatCurrency } from '../../../shared/utils';
import type { Invoice } from '../../../shared/types';

// ─── RFC 4180 CSV parser (for round-trip verification) ───────────────────────

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let pos = 0;
  const len = csv.length;

  while (pos <= len) {
    const row: string[] = [];
    while (pos <= len) {
      if (pos === len || (csv[pos] === '\r' && csv[pos + 1] === '\n')) {
        row.push('');
        break;
      }
      if (csv[pos] === '"') {
        pos++;
        let field = '';
        while (pos < len) {
          if (csv[pos] === '"') {
            if (csv[pos + 1] === '"') {
              field += '"';
              pos += 2;
            } else {
              pos++;
              break;
            }
          } else {
            field += csv[pos];
            pos++;
          }
        }
        row.push(field);
        if (pos < len && csv[pos] === ',') pos++;
      } else {
        let field = '';
        while (pos < len && csv[pos] !== ',' && !(csv[pos] === '\r' && csv[pos + 1] === '\n')) {
          field += csv[pos];
          pos++;
        }
        row.push(field);
        if (pos < len && csv[pos] === ',') pos++;
      }
      if (pos < len && csv[pos] === '\r' && csv[pos + 1] === '\n') break;
      if (pos >= len) break;
    }
    if (pos < len && csv[pos] === '\r' && csv[pos + 1] === '\n') pos += 2;
    else pos++;

    if (row.length > 0 && row[row.length - 1] === '' && row.length > 1) {
      row.pop();
    }
    if (row.length > 0) rows.push(row);
  }
  return rows;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: Math.random().toString(36).slice(2),
    number: 'INV-001',
    prefix: 'INV',
    userId: 'user-1',
    clientId: 'client-1',
    status: 'paid',
    issueDate: '2024-01-15',
    dueDate: '2024-02-15',
    billFrom: {} as Invoice['billFrom'],
    billTo: {},
    lineItems: [],
    discount: { type: 'percent', value: 0 },
    shipping: 0,
    currency: 'USD',
    currencySymbol: '$',
    taxMode: 'exclusive',
    subtotal: 0,
    taxTotal: 0,
    discountAmount: 0,
    grandTotal: 0,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    ...overrides,
  };
}

/**
 * Build the CSV rows the same way renderTaxSummary does, so the test
 * validates the actual export logic end-to-end.
 */
function buildTaxSummaryCSV(invoices: Invoice[], year: number): { csv: string; dataRows: string[][] } {
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
  return { csv, dataRows };
}

// ─── Property 9: CSV round-trip ───────────────────────────────────────────────

describe('Property 9: CSV round-trip for tax summary', () => {
  it('parsing the exported CSV back produces data equivalent to the original table rows', () => {
    const invoices = [
      makeInvoice({ issueDate: '2024-03-10', grandTotal: 1000, taxTotal: 100 }),
      makeInvoice({ issueDate: '2024-03-25', grandTotal: 500, taxTotal: 50 }),
      makeInvoice({ issueDate: '2024-07-01', grandTotal: 2000, taxTotal: 200 }),
    ];

    const { csv, dataRows } = buildTaxSummaryCSV(invoices, 2024);
    const parsed = parseCSV(csv);

    // Skip header row (index 0), compare data rows
    dataRows.forEach((row, i) => {
      expect(parsed[i + 1]).toEqual(row);
    });
  });

  it('round-trips with no invoices (all-zero dataset)', () => {
    const { csv, dataRows } = buildTaxSummaryCSV([], 2024);
    const parsed = parseCSV(csv);

    dataRows.forEach((row, i) => {
      expect(parsed[i + 1]).toEqual(row);
    });
  });

  it('round-trips with invoices spread across all 12 months', () => {
    const invoices = Array.from({ length: 12 }, (_, month) =>
      makeInvoice({
        issueDate: `2024-${String(month + 1).padStart(2, '0')}-15`,
        grandTotal: (month + 1) * 100,
        taxTotal: (month + 1) * 10,
      }),
    );

    const { csv, dataRows } = buildTaxSummaryCSV(invoices, 2024);
    const parsed = parseCSV(csv);

    dataRows.forEach((row, i) => {
      expect(parsed[i + 1]).toEqual(row);
    });
  });

  it('round-trips with large currency values', () => {
    const invoices = [
      makeInvoice({ issueDate: '2024-06-01', grandTotal: 999999.99, taxTotal: 99999.99 }),
    ];

    const { csv, dataRows } = buildTaxSummaryCSV(invoices, 2024);
    const parsed = parseCSV(csv);

    dataRows.forEach((row, i) => {
      expect(parsed[i + 1]).toEqual(row);
    });
  });

  it('round-trips with multiple invoices in the same month', () => {
    const invoices = [
      makeInvoice({ issueDate: '2024-01-05', grandTotal: 300, taxTotal: 30 }),
      makeInvoice({ issueDate: '2024-01-20', grandTotal: 700, taxTotal: 70 }),
    ];

    const { csv, dataRows } = buildTaxSummaryCSV(invoices, 2024);
    const parsed = parseCSV(csv);

    // January should be aggregated
    expect(parsed[1]).toEqual(['Jan', formatCurrency(1000), formatCurrency(100), formatCurrency(900)]);
    dataRows.forEach((row, i) => {
      expect(parsed[i + 1]).toEqual(row);
    });
  });

  it('excludes non-paid invoices from the round-trip data', () => {
    const invoices = [
      makeInvoice({ issueDate: '2024-04-10', grandTotal: 500, taxTotal: 50, status: 'paid' }),
      makeInvoice({ issueDate: '2024-04-15', grandTotal: 999, taxTotal: 99, status: 'unpaid' }),
      makeInvoice({ issueDate: '2024-04-20', grandTotal: 999, taxTotal: 99, status: 'cancelled' }),
    ];

    const { csv, dataRows } = buildTaxSummaryCSV(invoices, 2024);
    const parsed = parseCSV(csv);

    // April (index 3) should only include the paid invoice
    expect(parsed[4]).toEqual(['Apr', formatCurrency(500), formatCurrency(50), formatCurrency(450)]);
    dataRows.forEach((row, i) => {
      expect(parsed[i + 1]).toEqual(row);
    });
  });
});

// ─── Structural tests ─────────────────────────────────────────────────────────

describe('Tax summary CSV structure', () => {
  it('has exactly 14 rows: 1 header + 12 months + 1 totals row', () => {
    const invoices = [
      makeInvoice({ issueDate: '2024-05-10', grandTotal: 800, taxTotal: 80 }),
    ];
    const { csv } = buildTaxSummaryCSV(invoices, 2024);
    const parsed = parseCSV(csv);
    // 1 header + 12 month rows + 1 totals row = 14
    expect(parsed).toHaveLength(14);
  });

  it('has the correct header row', () => {
    const { csv } = buildTaxSummaryCSV([], 2024);
    const parsed = parseCSV(csv);
    expect(parsed[0]).toEqual(['Month', 'Total Invoiced', 'Tax Collected', 'Net Amount']);
  });

  it('includes the totals row as the last row', () => {
    const invoices = [
      makeInvoice({ issueDate: '2024-02-14', grandTotal: 1200, taxTotal: 120 }),
      makeInvoice({ issueDate: '2024-09-01', grandTotal: 800, taxTotal: 80 }),
    ];
    const { csv } = buildTaxSummaryCSV(invoices, 2024);
    const parsed = parseCSV(csv);
    const lastRow = parsed[parsed.length - 1];
    expect(lastRow[0]).toBe('Total');
    expect(lastRow[1]).toBe(formatCurrency(2000));
    expect(lastRow[2]).toBe(formatCurrency(200));
    expect(lastRow[3]).toBe(formatCurrency(1800));
  });

  it('zero-value months are included, not omitted', () => {
    // Only one invoice in March — all other months should be zero
    const invoices = [
      makeInvoice({ issueDate: '2024-03-15', grandTotal: 500, taxTotal: 50 }),
    ];
    const { csv } = buildTaxSummaryCSV(invoices, 2024);
    const parsed = parseCSV(csv);

    // 14 rows total means all 12 months are present
    expect(parsed).toHaveLength(14);

    // January (index 1) should be zero
    expect(parsed[1]).toEqual(['Jan', formatCurrency(0), formatCurrency(0), formatCurrency(0)]);
    // February (index 2) should be zero
    expect(parsed[2]).toEqual(['Feb', formatCurrency(0), formatCurrency(0), formatCurrency(0)]);
    // March (index 3) should have data
    expect(parsed[3]).toEqual(['Mar', formatCurrency(500), formatCurrency(50), formatCurrency(450)]);
  });

  it('totals row sums all monthly values correctly', () => {
    const invoices = [
      makeInvoice({ issueDate: '2024-01-10', grandTotal: 100, taxTotal: 10 }),
      makeInvoice({ issueDate: '2024-06-20', grandTotal: 200, taxTotal: 20 }),
      makeInvoice({ issueDate: '2024-12-31', grandTotal: 300, taxTotal: 30 }),
    ];
    const { csv } = buildTaxSummaryCSV(invoices, 2024);
    const parsed = parseCSV(csv);
    const totalsRow = parsed[parsed.length - 1];

    expect(totalsRow[0]).toBe('Total');
    expect(totalsRow[1]).toBe(formatCurrency(600));
    expect(totalsRow[2]).toBe(formatCurrency(60));
    expect(totalsRow[3]).toBe(formatCurrency(540));
  });
});
