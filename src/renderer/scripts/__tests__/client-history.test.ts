/**
 * Unit tests for client history panel logic
 * Validates: Requirements 3.1, 3.3, 3.4, 3.7
 */
import { describe, it, expect } from 'vitest';
import { aggregateRevenue, aggregateOutstanding } from '../../../shared/utils';
import { filterAndSortInvoicesForClient } from '../client-manager';
import type { Invoice } from '../../../shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Test 1: Filter by clientId and sort by issueDate desc ────────────────────

describe('filterAndSortInvoicesForClient', () => {
  it('returns only invoices matching the given clientId', () => {
    const invoices = [
      makeInvoice({ id: 'a', clientId: 'client-1' }),
      makeInvoice({ id: 'b', clientId: 'client-2' }),
      makeInvoice({ id: 'c', clientId: 'client-1' }),
    ];

    const result = filterAndSortInvoicesForClient(invoices, 'client-1');
    expect(result).toHaveLength(2);
    expect(result.every(inv => inv.clientId === 'client-1')).toBe(true);
  });

  it('sorts invoices by issueDate descending', () => {
    const invoices = [
      makeInvoice({ id: 'a', clientId: 'client-1', issueDate: '2024-01-10' }),
      makeInvoice({ id: 'b', clientId: 'client-1', issueDate: '2024-06-20' }),
      makeInvoice({ id: 'c', clientId: 'client-1', issueDate: '2024-03-05' }),
    ];

    const result = filterAndSortInvoicesForClient(invoices, 'client-1');
    expect(result[0].id).toBe('b'); // most recent first
    expect(result[1].id).toBe('c');
    expect(result[2].id).toBe('a');
  });

  it('returns an empty array when no invoices match the clientId', () => {
    const invoices = [
      makeInvoice({ clientId: 'client-2' }),
      makeInvoice({ clientId: 'client-3' }),
    ];

    const result = filterAndSortInvoicesForClient(invoices, 'client-1');
    expect(result).toHaveLength(0);
  });

  it('returns an empty array when the invoice list is empty', () => {
    const result = filterAndSortInvoicesForClient([], 'client-1');
    expect(result).toHaveLength(0);
  });

  it('excludes invoices from other clients even when mixed in', () => {
    const invoices = [
      makeInvoice({ id: 'x', clientId: 'client-1', issueDate: '2024-05-01' }),
      makeInvoice({ id: 'y', clientId: 'client-99', issueDate: '2024-07-01' }),
      makeInvoice({ id: 'z', clientId: 'client-1', issueDate: '2024-04-01' }),
    ];

    const result = filterAndSortInvoicesForClient(invoices, 'client-1');
    expect(result.map(i => i.id)).toEqual(['x', 'z']);
  });
});

// ─── Test 2: Revenue and outstanding totals for a client ──────────────────────

describe('Client history: revenue and outstanding totals', () => {
  it('calculates total revenue from paid invoices for the client', () => {
    const invoices = [
      makeInvoice({ clientId: 'client-1', status: 'paid', grandTotal: 500, userId: 'user-1' }),
      makeInvoice({ clientId: 'client-1', status: 'paid', grandTotal: 300, userId: 'user-1' }),
      makeInvoice({ clientId: 'client-1', status: 'unpaid', grandTotal: 200, userId: 'user-1' }),
    ];

    const clientInvoices = filterAndSortInvoicesForClient(invoices, 'client-1');
    expect(aggregateRevenue(clientInvoices, 'user-1')).toBe(800);
  });

  it('calculates total outstanding from unpaid and overdue invoices', () => {
    const invoices = [
      makeInvoice({ clientId: 'client-1', status: 'unpaid', grandTotal: 150, userId: 'user-1' }),
      makeInvoice({ clientId: 'client-1', status: 'overdue', grandTotal: 250, userId: 'user-1' }),
      makeInvoice({ clientId: 'client-1', status: 'paid', grandTotal: 999, userId: 'user-1' }),
    ];

    const clientInvoices = filterAndSortInvoicesForClient(invoices, 'client-1');
    expect(aggregateOutstanding(clientInvoices, 'user-1')).toBe(400);
  });

  it('excludes cancelled invoices from both revenue and outstanding', () => {
    const invoices = [
      makeInvoice({ clientId: 'client-1', status: 'cancelled', grandTotal: 999, userId: 'user-1' }),
      makeInvoice({ clientId: 'client-1', status: 'paid', grandTotal: 100, userId: 'user-1' }),
    ];

    const clientInvoices = filterAndSortInvoicesForClient(invoices, 'client-1');
    expect(aggregateRevenue(clientInvoices, 'user-1')).toBe(100);
    expect(aggregateOutstanding(clientInvoices, 'user-1')).toBe(0);
  });

  it('returns 0 for both totals when no invoices exist for the client', () => {
    const result = filterAndSortInvoicesForClient([], 'client-1');
    expect(aggregateRevenue(result, 'user-1')).toBe(0);
    expect(aggregateOutstanding(result, 'user-1')).toBe(0);
  });
});

// ─── Test 3: Empty-state detection ───────────────────────────────────────────

describe('Client history: empty-state condition', () => {
  it('detects empty state when no invoices match the client', () => {
    const invoices = [
      makeInvoice({ clientId: 'client-2' }),
      makeInvoice({ clientId: 'client-3' }),
    ];

    const clientInvoices = filterAndSortInvoicesForClient(invoices, 'client-1');
    expect(clientInvoices.length === 0).toBe(true);
  });

  it('does not show empty state when at least one invoice matches', () => {
    const invoices = [
      makeInvoice({ clientId: 'client-1' }),
      makeInvoice({ clientId: 'client-2' }),
    ];

    const clientInvoices = filterAndSortInvoicesForClient(invoices, 'client-1');
    expect(clientInvoices.length === 0).toBe(false);
  });

  it('detects empty state when invoice list is completely empty', () => {
    const clientInvoices = filterAndSortInvoicesForClient([], 'client-1');
    expect(clientInvoices.length === 0).toBe(true);
  });
});
