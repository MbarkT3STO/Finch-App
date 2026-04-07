import { describe, it, expect } from 'vitest';
import { buildTaxSummary } from '../tax-report-generator';
import type { Invoice } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: Math.random().toString(36).slice(2),
    number: '001',
    prefix: 'INV',
    userId: 'user-1',
    clientId: 'client-1',
    status: 'paid',
    issueDate: '2024-06-15',
    dueDate: '2024-07-15',
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
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Shape ────────────────────────────────────────────────────────────────────

describe('buildTaxSummary — output shape', () => {
  it('always returns exactly 12 rows', () => {
    const result = buildTaxSummary([], 2024);
    expect(result.rows).toHaveLength(12);
  });

  it('rows have correct month numbers 1-12', () => {
    const result = buildTaxSummary([], 2024);
    result.rows.forEach((row, idx) => {
      expect(row.month).toBe(idx + 1);
    });
  });

  it('rows have correct month labels', () => {
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = buildTaxSummary([], 2024);
    result.rows.forEach((row, idx) => {
      expect(row.label).toBe(labels[idx]);
    });
  });

  it('returns the correct year', () => {
    expect(buildTaxSummary([], 2023).year).toBe(2023);
    expect(buildTaxSummary([], 2025).year).toBe(2025);
  });
});

// ─── All-zero year ────────────────────────────────────────────────────────────

describe('buildTaxSummary — all-zero year (no paid invoices)', () => {
  it('all rows are zero-filled when no invoices exist', () => {
    const result = buildTaxSummary([], 2024);
    result.rows.forEach(row => {
      expect(row.totalInvoiced).toBe(0);
      expect(row.taxTotal).toBe(0);
      expect(row.net).toBe(0);
    });
  });

  it('annual totals are zero when no invoices exist', () => {
    const result = buildTaxSummary([], 2024);
    expect(result.annualTotalInvoiced).toBe(0);
    expect(result.annualTaxTotal).toBe(0);
    expect(result.annualNet).toBe(0);
  });

  it('all rows are zero when invoices exist but none are paid', () => {
    const invoices = [
      makeInvoice({ status: 'unpaid', grandTotal: 500, taxTotal: 50, issueDate: '2024-03-01' }),
      makeInvoice({ status: 'draft', grandTotal: 200, taxTotal: 20, issueDate: '2024-06-01' }),
      makeInvoice({ status: 'cancelled', grandTotal: 300, taxTotal: 30, issueDate: '2024-09-01' }),
    ];
    const result = buildTaxSummary(invoices, 2024);
    result.rows.forEach(row => {
      expect(row.totalInvoiced).toBe(0);
      expect(row.taxTotal).toBe(0);
    });
    expect(result.annualTotalInvoiced).toBe(0);
  });
});

// ─── Mixed statuses ───────────────────────────────────────────────────────────

describe('buildTaxSummary — mixed statuses', () => {
  it('only counts paid invoices', () => {
    const invoices = [
      makeInvoice({ status: 'paid',      grandTotal: 1000, taxTotal: 100, issueDate: '2024-01-15' }),
      makeInvoice({ status: 'unpaid',    grandTotal: 500,  taxTotal: 50,  issueDate: '2024-01-20' }),
      makeInvoice({ status: 'overdue',   grandTotal: 300,  taxTotal: 30,  issueDate: '2024-01-25' }),
      makeInvoice({ status: 'cancelled', grandTotal: 200,  taxTotal: 20,  issueDate: '2024-01-28' }),
      makeInvoice({ status: 'draft',     grandTotal: 100,  taxTotal: 10,  issueDate: '2024-01-05' }),
    ];
    const result = buildTaxSummary(invoices, 2024);
    const jan = result.rows[0]; // month 1 = index 0
    expect(jan.totalInvoiced).toBe(1000);
    expect(jan.taxTotal).toBe(100);
    expect(jan.net).toBe(900);
  });

  it('accumulates multiple paid invoices in the same month', () => {
    const invoices = [
      makeInvoice({ status: 'paid', grandTotal: 400, taxTotal: 40, issueDate: '2024-05-01' }),
      makeInvoice({ status: 'paid', grandTotal: 600, taxTotal: 60, issueDate: '2024-05-20' }),
    ];
    const result = buildTaxSummary(invoices, 2024);
    const may = result.rows[4]; // month 5 = index 4
    expect(may.totalInvoiced).toBe(1000);
    expect(may.taxTotal).toBe(100);
    expect(may.net).toBe(900);
  });

  it('net equals totalInvoiced - taxTotal for every row', () => {
    const invoices = [
      makeInvoice({ status: 'paid', grandTotal: 550, taxTotal: 55, issueDate: '2024-03-10' }),
      makeInvoice({ status: 'paid', grandTotal: 220, taxTotal: 22, issueDate: '2024-07-15' }),
    ];
    const result = buildTaxSummary(invoices, 2024);
    result.rows.forEach(row => {
      expect(row.net).toBeCloseTo(row.totalInvoiced - row.taxTotal, 10);
    });
  });

  it('annual totals equal sum of row values', () => {
    const invoices = [
      makeInvoice({ status: 'paid', grandTotal: 1000, taxTotal: 100, issueDate: '2024-02-01' }),
      makeInvoice({ status: 'paid', grandTotal: 2000, taxTotal: 200, issueDate: '2024-08-01' }),
      makeInvoice({ status: 'unpaid', grandTotal: 500, taxTotal: 50, issueDate: '2024-04-01' }),
    ];
    const result = buildTaxSummary(invoices, 2024);
    expect(result.annualTotalInvoiced).toBe(3000);
    expect(result.annualTaxTotal).toBe(300);
    expect(result.annualNet).toBe(2700);
  });
});

// ─── Year boundary ────────────────────────────────────────────────────────────

describe('buildTaxSummary — year boundary', () => {
  it('excludes invoices from other years', () => {
    const invoices = [
      makeInvoice({ status: 'paid', grandTotal: 500, taxTotal: 50, issueDate: '2023-12-31' }),
      makeInvoice({ status: 'paid', grandTotal: 1000, taxTotal: 100, issueDate: '2024-01-01' }),
      makeInvoice({ status: 'paid', grandTotal: 800, taxTotal: 80, issueDate: '2025-01-01' }),
    ];
    const result = buildTaxSummary(invoices, 2024);
    expect(result.annualTotalInvoiced).toBe(1000);
    expect(result.annualTaxTotal).toBe(100);
  });

  it('includes invoices on the first and last day of the year', () => {
    const invoices = [
      makeInvoice({ status: 'paid', grandTotal: 100, taxTotal: 10, issueDate: '2024-01-01' }),
      makeInvoice({ status: 'paid', grandTotal: 200, taxTotal: 20, issueDate: '2024-12-31' }),
    ];
    const result = buildTaxSummary(invoices, 2024);
    expect(result.annualTotalInvoiced).toBe(300);
    expect(result.rows[0].totalInvoiced).toBe(100);  // Jan
    expect(result.rows[11].totalInvoiced).toBe(200); // Dec
  });

  it('returns all zeros for a year with no invoices at all', () => {
    const invoices = [
      makeInvoice({ status: 'paid', grandTotal: 999, taxTotal: 99, issueDate: '2023-06-01' }),
    ];
    const result = buildTaxSummary(invoices, 2024);
    expect(result.annualTotalInvoiced).toBe(0);
    expect(result.annualTaxTotal).toBe(0);
    expect(result.annualNet).toBe(0);
  });
});
