/**
 * Property-based tests for aggregation utilities
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 5.3, 7.1
 */
import { describe, it, expect } from 'vitest';
import {
  aggregateRevenue,
  aggregateOutstanding,
  groupByMonth,
  groupByYear,
  taxSummaryByMonth,
} from '../utils';
import type { Invoice } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type InvoiceStatus = 'draft' | 'unpaid' | 'paid' | 'overdue' | 'cancelled';

function makeInvoice(overrides: Partial<Invoice> & { status: InvoiceStatus }): Invoice {
  return {
    id: Math.random().toString(36).slice(2),
    number: '001',
    prefix: 'INV',
    userId: 'user-1',
    clientId: 'client-1',
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
    grandTotal: 100,
    createdAt: '2024-06-15T00:00:00Z',
    updatedAt: '2024-06-15T00:00:00Z',
    ...overrides,
  };
}

function makeInvoices(specs: Array<{ status: InvoiceStatus; grandTotal: number; taxTotal?: number; userId?: string; issueDate?: string }>): Invoice[] {
  return specs.map((s, i) =>
    makeInvoice({
      id: `inv-${i}`,
      status: s.status,
      grandTotal: s.grandTotal,
      taxTotal: s.taxTotal ?? 0,
      userId: s.userId ?? 'user-1',
      issueDate: s.issueDate ?? '2024-06-15',
    }),
  );
}

// ─── Property 1: Revenue excludes cancelled invoices ─────────────────────────

describe('Property 1: aggregateRevenue excludes cancelled invoices', () => {
  it('sums only paid invoices for the given userId', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 200 },
      { status: 'paid', grandTotal: 300 },
      { status: 'unpaid', grandTotal: 150 },
      { status: 'overdue', grandTotal: 100 },
      { status: 'draft', grandTotal: 50 },
    ]);
    expect(aggregateRevenue(invoices, 'user-1')).toBe(500);
  });

  it('excludes cancelled invoices even when grandTotal is non-zero', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 400 },
      { status: 'cancelled', grandTotal: 999 },
    ]);
    expect(aggregateRevenue(invoices, 'user-1')).toBe(400);
  });

  it('returns 0 when all invoices are cancelled', () => {
    const invoices = makeInvoices([
      { status: 'cancelled', grandTotal: 500 },
      { status: 'cancelled', grandTotal: 300 },
    ]);
    expect(aggregateRevenue(invoices, 'user-1')).toBe(0);
  });

  it('returns 0 for empty invoice list', () => {
    expect(aggregateRevenue([], 'user-1')).toBe(0);
  });

  it('only counts invoices matching the userId', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 100, userId: 'user-1' },
      { status: 'paid', grandTotal: 200, userId: 'user-2' },
      { status: 'paid', grandTotal: 50, userId: 'user-1' },
    ]);
    expect(aggregateRevenue(invoices, 'user-1')).toBe(150);
    expect(aggregateRevenue(invoices, 'user-2')).toBe(200);
  });

  it('result equals manual sum of paid grandTotals for userId (varied dataset)', () => {
    const specs: Array<{ status: InvoiceStatus; grandTotal: number }> = [
      { status: 'paid', grandTotal: 123.45 },
      { status: 'paid', grandTotal: 67.89 },
      { status: 'cancelled', grandTotal: 500 },
      { status: 'unpaid', grandTotal: 200 },
      { status: 'overdue', grandTotal: 75 },
      { status: 'draft', grandTotal: 30 },
    ];
    const invoices = makeInvoices(specs);
    const expected = specs
      .filter(s => s.status === 'paid')
      .reduce((sum, s) => sum + s.grandTotal, 0);
    expect(aggregateRevenue(invoices, 'user-1')).toBeCloseTo(expected, 5);
  });
});

// ─── Property 2: Outstanding excludes cancelled and paid ─────────────────────

describe('Property 2: aggregateOutstanding excludes cancelled and paid invoices', () => {
  it('sums only unpaid and overdue invoices', () => {
    const invoices = makeInvoices([
      { status: 'unpaid', grandTotal: 100 },
      { status: 'overdue', grandTotal: 200 },
      { status: 'paid', grandTotal: 999 },
      { status: 'cancelled', grandTotal: 999 },
      { status: 'draft', grandTotal: 50 },
    ]);
    expect(aggregateOutstanding(invoices, 'user-1')).toBe(300);
  });

  it('never includes cancelled invoices', () => {
    const invoices = makeInvoices([
      { status: 'cancelled', grandTotal: 1000 },
      { status: 'overdue', grandTotal: 250 },
    ]);
    expect(aggregateOutstanding(invoices, 'user-1')).toBe(250);
  });

  it('never includes paid invoices', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 1000 },
      { status: 'unpaid', grandTotal: 150 },
    ]);
    expect(aggregateOutstanding(invoices, 'user-1')).toBe(150);
  });

  it('returns 0 for empty invoice list', () => {
    expect(aggregateOutstanding([], 'user-1')).toBe(0);
  });

  it('only counts invoices matching the userId', () => {
    const invoices = makeInvoices([
      { status: 'unpaid', grandTotal: 100, userId: 'user-1' },
      { status: 'overdue', grandTotal: 200, userId: 'user-2' },
    ]);
    expect(aggregateOutstanding(invoices, 'user-1')).toBe(100);
    expect(aggregateOutstanding(invoices, 'user-2')).toBe(200);
  });

  it('result equals manual sum of unpaid+overdue grandTotals (varied dataset)', () => {
    const specs: Array<{ status: InvoiceStatus; grandTotal: number }> = [
      { status: 'unpaid', grandTotal: 88.5 },
      { status: 'overdue', grandTotal: 44.25 },
      { status: 'paid', grandTotal: 300 },
      { status: 'cancelled', grandTotal: 150 },
      { status: 'draft', grandTotal: 20 },
    ];
    const invoices = makeInvoices(specs);
    const expected = specs
      .filter(s => s.status === 'unpaid' || s.status === 'overdue')
      .reduce((sum, s) => sum + s.grandTotal, 0);
    expect(aggregateOutstanding(invoices, 'user-1')).toBeCloseTo(expected, 5);
  });
});

// ─── Property 3: Monthly grouping covers all 12 months ───────────────────────

describe('Property 3: groupByMonth always returns exactly 12 entries', () => {
  it('returns a 12-element array for an empty invoice list', () => {
    const result = groupByMonth([], 2024);
    expect(result).toHaveLength(12);
    expect(result.every(v => v === 0)).toBe(true);
  });

  it('returns exactly 12 entries with real data', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 100, issueDate: '2024-01-10' },
      { status: 'paid', grandTotal: 200, issueDate: '2024-06-15' },
      { status: 'paid', grandTotal: 300, issueDate: '2024-12-01' },
    ]);
    const result = groupByMonth(invoices, 2024);
    expect(result).toHaveLength(12);
  });

  it('zero-fills months with no paid invoices', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 500, issueDate: '2024-03-20' },
    ]);
    const result = groupByMonth(invoices, 2024);
    expect(result).toHaveLength(12);
    // March (index 2) should have 500, all others 0
    result.forEach((val, idx) => {
      if (idx === 2) expect(val).toBe(500);
      else expect(val).toBe(0);
    });
  });

  it('excludes cancelled invoices from monthly grouping', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 100, issueDate: '2024-05-10' },
      { status: 'cancelled', grandTotal: 999, issueDate: '2024-05-10' },
    ]);
    const result = groupByMonth(invoices, 2024);
    expect(result[4]).toBe(100); // May = index 4
  });

  it('excludes invoices from other years', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 100, issueDate: '2023-06-01' },
      { status: 'paid', grandTotal: 200, issueDate: '2024-06-01' },
    ]);
    const result = groupByMonth(invoices, 2024);
    expect(result[5]).toBe(200); // June = index 5
    expect(result.reduce((a, b) => a + b, 0)).toBe(200);
  });

  it('accumulates multiple invoices in the same month', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 100, issueDate: '2024-02-05' },
      { status: 'paid', grandTotal: 150, issueDate: '2024-02-20' },
    ]);
    const result = groupByMonth(invoices, 2024);
    expect(result[1]).toBe(250); // February = index 1
  });
});

// ─── Property 4: Yearly grouping consistency ─────────────────────────────────

describe('Property 4: groupByYear consistency with paid non-cancelled totals', () => {
  it('sum of groupByYear values equals sum of all paid grandTotals', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 100, issueDate: '2022-03-01' },
      { status: 'paid', grandTotal: 200, issueDate: '2023-07-15' },
      { status: 'paid', grandTotal: 300, issueDate: '2024-11-20' },
      { status: 'cancelled', grandTotal: 999, issueDate: '2024-01-01' },
      { status: 'unpaid', grandTotal: 50, issueDate: '2024-05-01' },
    ]);
    const yearMap = groupByYear(invoices);
    const yearSum = Object.values(yearMap).reduce((a, b) => a + b, 0);
    const expectedSum = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.grandTotal, 0);
    expect(yearSum).toBeCloseTo(expectedSum, 5);
  });

  it('returns empty object for empty invoice list', () => {
    expect(groupByYear([])).toEqual({});
  });

  it('groups invoices by year correctly', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 100, issueDate: '2022-01-01' },
      { status: 'paid', grandTotal: 200, issueDate: '2022-06-01' },
      { status: 'paid', grandTotal: 300, issueDate: '2023-03-01' },
    ]);
    const result = groupByYear(invoices);
    expect(result['2022']).toBe(300);
    expect(result['2023']).toBe(300);
  });

  it('excludes cancelled invoices from yearly grouping', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 400, issueDate: '2024-01-01' },
      { status: 'cancelled', grandTotal: 999, issueDate: '2024-06-01' },
    ]);
    const result = groupByYear(invoices);
    expect(result['2024']).toBe(400);
  });

  it('sum of groupByYear equals sum of paid invoices across multiple years (varied)', () => {
    const specs: Array<{ status: InvoiceStatus; grandTotal: number; issueDate: string }> = [
      { status: 'paid', grandTotal: 111, issueDate: '2021-01-01' },
      { status: 'paid', grandTotal: 222, issueDate: '2022-06-15' },
      { status: 'paid', grandTotal: 333, issueDate: '2023-12-31' },
      { status: 'cancelled', grandTotal: 500, issueDate: '2023-06-01' },
      { status: 'overdue', grandTotal: 75, issueDate: '2023-09-01' },
    ];
    const invoices = makeInvoices(specs);
    const yearSum = Object.values(groupByYear(invoices)).reduce((a, b) => a + b, 0);
    const expected = specs
      .filter(s => s.status === 'paid')
      .reduce((sum, s) => sum + s.grandTotal, 0);
    expect(yearSum).toBeCloseTo(expected, 5);
  });
});

// ─── Property 5: Tax summary net = invoiced − taxTotal ───────────────────────

describe('Property 5: taxSummaryByMonth net === invoiced - taxTotal for every month', () => {
  it('net equals invoiced minus taxTotal for all 12 months', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 110, taxTotal: 10, issueDate: '2024-01-15' },
      { status: 'paid', grandTotal: 220, taxTotal: 20, issueDate: '2024-06-10' },
      { status: 'paid', grandTotal: 330, taxTotal: 30, issueDate: '2024-12-05' },
    ]);
    const rows = taxSummaryByMonth(invoices, 2024);
    rows.forEach(row => {
      expect(row.net).toBeCloseTo(row.invoiced - row.taxTotal, 10);
    });
  });

  it('always returns exactly 12 rows', () => {
    const rows = taxSummaryByMonth([], 2024);
    expect(rows).toHaveLength(12);
  });

  it('zero-fills months with no paid invoices and net is 0', () => {
    const rows = taxSummaryByMonth([], 2024);
    rows.forEach(row => {
      expect(row.invoiced).toBe(0);
      expect(row.taxTotal).toBe(0);
      expect(row.net).toBe(0);
    });
  });

  it('excludes cancelled invoices from tax summary', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 200, taxTotal: 20, issueDate: '2024-03-01' },
      { status: 'cancelled', grandTotal: 999, taxTotal: 99, issueDate: '2024-03-15' },
    ]);
    const rows = taxSummaryByMonth(invoices, 2024);
    expect(rows[2].invoiced).toBe(200); // March = index 2
    expect(rows[2].taxTotal).toBe(20);
    expect(rows[2].net).toBeCloseTo(180, 10);
  });

  it('accumulates multiple paid invoices in the same month correctly', () => {
    const invoices = makeInvoices([
      { status: 'paid', grandTotal: 100, taxTotal: 10, issueDate: '2024-04-05' },
      { status: 'paid', grandTotal: 200, taxTotal: 25, issueDate: '2024-04-20' },
    ]);
    const rows = taxSummaryByMonth(invoices, 2024);
    expect(rows[3].invoiced).toBe(300); // April = index 3
    expect(rows[3].taxTotal).toBe(35);
    expect(rows[3].net).toBeCloseTo(265, 10);
  });

  it('net property holds for varied dataset with multiple months', () => {
    const specs = [
      { status: 'paid' as InvoiceStatus, grandTotal: 500, taxTotal: 50, issueDate: '2024-02-14' },
      { status: 'paid' as InvoiceStatus, grandTotal: 750, taxTotal: 75, issueDate: '2024-08-22' },
      { status: 'cancelled' as InvoiceStatus, grandTotal: 300, taxTotal: 30, issueDate: '2024-08-01' },
      { status: 'unpaid' as InvoiceStatus, grandTotal: 100, taxTotal: 10, issueDate: '2024-11-01' },
    ];
    const invoices = makeInvoices(specs);
    const rows = taxSummaryByMonth(invoices, 2024);
    rows.forEach(row => {
      expect(row.net).toBeCloseTo(row.invoiced - row.taxTotal, 10);
    });
  });
});
