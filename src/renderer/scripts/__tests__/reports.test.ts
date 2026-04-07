/**
 * Unit tests for reports data transformations
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2
 */
import { describe, it, expect } from 'vitest';
import { groupByMonth } from '../../../shared/utils';
import { computePaidUnpaidBreakdown } from '../reports';
import type { Invoice } from '../../../shared/types';

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: Math.random().toString(36).slice(2),
    number: 'INV-001',
    prefix: 'INV',
    userId: 'user-1',
    clientId: 'client-1',
    status: 'unpaid',
    issueDate: '2024-06-15',
    dueDate: '2024-07-15',
    billFrom: {} as Invoice['billFrom'],
    billTo: { name: 'Test Client' },
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

// ─── Test 1: Monthly grouping produces 12 bars including zero-value months ────

describe('groupByMonth', () => {
  it('always returns exactly 12 entries', () => {
    const invoices = [
      makeInvoice({ status: 'paid', issueDate: '2024-03-10', grandTotal: 500 }),
      makeInvoice({ status: 'paid', issueDate: '2024-11-20', grandTotal: 300 }),
    ];
    const result = groupByMonth(invoices, 2024);
    expect(result).toHaveLength(12);
  });

  it('zero-fills months with no paid invoices', () => {
    const invoices = [
      makeInvoice({ status: 'paid', issueDate: '2024-06-15', grandTotal: 400 }),
    ];
    const result = groupByMonth(invoices, 2024);
    // All months except June (index 5) should be 0
    result.forEach((val, i) => {
      if (i === 5) {
        expect(val).toBe(400);
      } else {
        expect(val).toBe(0);
      }
    });
  });

  it('returns all zeros when no invoices exist for the year', () => {
    const result = groupByMonth([], 2024);
    expect(result).toHaveLength(12);
    expect(result.every(v => v === 0)).toBe(true);
  });

  it('only includes paid invoices in monthly totals', () => {
    const invoices = [
      makeInvoice({ status: 'paid', issueDate: '2024-01-10', grandTotal: 200 }),
      makeInvoice({ status: 'unpaid', issueDate: '2024-01-15', grandTotal: 999 }),
      makeInvoice({ status: 'draft', issueDate: '2024-01-20', grandTotal: 999 }),
    ];
    const result = groupByMonth(invoices, 2024);
    expect(result[0]).toBe(200);
  });
});

// ─── Test 2: Paid vs unpaid percentages are correct ──────────────────────────

describe('computePaidUnpaidBreakdown', () => {
  it('calculates correct percentages: paid=300, unpaid=100 → 75%/25%', () => {
    const invoices = [
      makeInvoice({ status: 'paid', grandTotal: 300 }),
      makeInvoice({ status: 'unpaid', grandTotal: 100 }),
    ];
    const result = computePaidUnpaidBreakdown(invoices, 'user-1');
    expect(result.paidTotal).toBe(300);
    expect(result.unpaidTotal).toBe(100);
    expect(result.paidPct).toBe(75);
    expect(result.unpaidPct).toBe(25);
  });

  it('includes overdue invoices in unpaid total', () => {
    const invoices = [
      makeInvoice({ status: 'paid', grandTotal: 200 }),
      makeInvoice({ status: 'unpaid', grandTotal: 50 }),
      makeInvoice({ status: 'overdue', grandTotal: 50 }),
    ];
    const result = computePaidUnpaidBreakdown(invoices, 'user-1');
    expect(result.unpaidTotal).toBe(100);
    expect(result.paidPct).toBe(67);
    expect(result.unpaidPct).toBe(33);
  });

  it('excludes cancelled and draft invoices from totals', () => {
    const invoices = [
      makeInvoice({ status: 'paid', grandTotal: 400 }),
      makeInvoice({ status: 'cancelled', grandTotal: 999 }),
      makeInvoice({ status: 'draft', grandTotal: 999 }),
    ];
    const result = computePaidUnpaidBreakdown(invoices, 'user-1');
    expect(result.paidTotal).toBe(400);
    expect(result.unpaidTotal).toBe(0);
    expect(result.paidPct).toBe(100);
    expect(result.unpaidPct).toBe(0);
  });

  it('scopes totals to the given userId', () => {
    const invoices = [
      makeInvoice({ status: 'paid', grandTotal: 300, userId: 'user-1' }),
      makeInvoice({ status: 'paid', grandTotal: 700, userId: 'user-2' }),
    ];
    const result = computePaidUnpaidBreakdown(invoices, 'user-1');
    expect(result.paidTotal).toBe(300);
  });

  // ─── Test 3: Zero-total case ────────────────────────────────────────────────

  it('returns 0% for both when combined total is 0 (no division by zero)', () => {
    const result = computePaidUnpaidBreakdown([], 'user-1');
    expect(result.paidTotal).toBe(0);
    expect(result.unpaidTotal).toBe(0);
    expect(result.paidPct).toBe(0);
    expect(result.unpaidPct).toBe(0);
  });

  it('returns 0% when all invoices are draft or cancelled', () => {
    const invoices = [
      makeInvoice({ status: 'draft', grandTotal: 500 }),
      makeInvoice({ status: 'cancelled', grandTotal: 300 }),
    ];
    const result = computePaidUnpaidBreakdown(invoices, 'user-1');
    expect(result.paidPct).toBe(0);
    expect(result.unpaidPct).toBe(0);
  });
});

// ─── Test 4: Invoice count summary counts each status correctly ───────────────

describe('Invoice count summary', () => {
  function countSummary(invoices: Invoice[], userId: string) {
    const userFiltered = invoices.filter(inv => inv.userId === userId);
    return {
      total: userFiltered.length,
      paid: userFiltered.filter(inv => inv.status === 'paid').length,
      unpaidOverdue: userFiltered.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue').length,
      draft: userFiltered.filter(inv => inv.status === 'draft').length,
    };
  }

  it('counts each status correctly for a mixed set', () => {
    const invoices = [
      makeInvoice({ status: 'paid' }),
      makeInvoice({ status: 'paid' }),
      makeInvoice({ status: 'unpaid' }),
      makeInvoice({ status: 'overdue' }),
      makeInvoice({ status: 'draft' }),
      makeInvoice({ status: 'cancelled' }),
    ];
    const counts = countSummary(invoices, 'user-1');
    expect(counts.total).toBe(6);
    expect(counts.paid).toBe(2);
    expect(counts.unpaidOverdue).toBe(2);
    expect(counts.draft).toBe(1);
  });

  it('returns zeros when no invoices exist', () => {
    const counts = countSummary([], 'user-1');
    expect(counts.total).toBe(0);
    expect(counts.paid).toBe(0);
    expect(counts.unpaidOverdue).toBe(0);
    expect(counts.draft).toBe(0);
  });

  it('scopes counts to the given userId', () => {
    const invoices = [
      makeInvoice({ status: 'paid', userId: 'user-1' }),
      makeInvoice({ status: 'paid', userId: 'user-2' }),
      makeInvoice({ status: 'draft', userId: 'user-2' }),
    ];
    const counts = countSummary(invoices, 'user-1');
    expect(counts.total).toBe(1);
    expect(counts.paid).toBe(1);
  });
});
