/**
 * Unit tests for dashboard metric calculations
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4
 */
import { describe, it, expect } from 'vitest';
import { aggregateRevenue, aggregateOutstanding, isOverdue } from '../../../shared/utils';
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

// ─── Test 1: aggregateRevenue with current-month filtering ────────────────────

describe('Dashboard metric: current-month revenue', () => {
  it('sums only paid invoices in the current month', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const thisMonthDate = `${year}-${month}-10`;
    const lastMonthDate = `${year}-${String(now.getMonth()).padStart(2, '0')}-10`;

    const invoices = [
      makeInvoice({ status: 'paid', grandTotal: 500, issueDate: thisMonthDate }),
      makeInvoice({ status: 'paid', grandTotal: 300, issueDate: thisMonthDate }),
      makeInvoice({ status: 'paid', grandTotal: 999, issueDate: lastMonthDate }),
      makeInvoice({ status: 'unpaid', grandTotal: 200, issueDate: thisMonthDate }),
    ];

    const thisMonthInvoices = invoices.filter(inv => {
      const [y, m] = inv.issueDate.split('-').map(Number);
      return y === now.getFullYear() && m === now.getMonth() + 1;
    });

    expect(aggregateRevenue(thisMonthInvoices, 'user-1')).toBe(800);
  });

  it('returns 0 when no paid invoices exist in the current month', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const thisMonthDate = `${year}-${month}-05`;

    const invoices = [
      makeInvoice({ status: 'unpaid', grandTotal: 200, issueDate: thisMonthDate }),
      makeInvoice({ status: 'draft', grandTotal: 100, issueDate: thisMonthDate }),
    ];

    const thisMonthInvoices = invoices.filter(inv => {
      const [y, m] = inv.issueDate.split('-').map(Number);
      return y === now.getFullYear() && m === now.getMonth() + 1;
    });

    expect(aggregateRevenue(thisMonthInvoices, 'user-1')).toBe(0);
  });

  it('excludes cancelled invoices from month revenue', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const thisMonthDate = `${year}-${month}-15`;

    const invoices = [
      makeInvoice({ status: 'paid', grandTotal: 400, issueDate: thisMonthDate }),
      makeInvoice({ status: 'cancelled', grandTotal: 999, issueDate: thisMonthDate }),
    ];

    const thisMonthInvoices = invoices.filter(inv => {
      const [y, m] = inv.issueDate.split('-').map(Number);
      return y === now.getFullYear() && m === now.getMonth() + 1;
    });

    expect(aggregateRevenue(thisMonthInvoices, 'user-1')).toBe(400);
  });

  it('scopes revenue to the current userId only', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const thisMonthDate = `${year}-${month}-20`;

    const invoices = [
      makeInvoice({ status: 'paid', grandTotal: 300, issueDate: thisMonthDate, userId: 'user-1' }),
      makeInvoice({ status: 'paid', grandTotal: 700, issueDate: thisMonthDate, userId: 'user-2' }),
    ];

    const thisMonthInvoices = invoices.filter(inv => {
      const [y, m] = inv.issueDate.split('-').map(Number);
      return y === now.getFullYear() && m === now.getMonth() + 1;
    });

    expect(aggregateRevenue(thisMonthInvoices, 'user-1')).toBe(300);
    expect(aggregateRevenue(thisMonthInvoices, 'user-2')).toBe(700);
  });
});

// ─── Test 2: Total outstanding metric ────────────────────────────────────────

describe('Dashboard metric: total outstanding', () => {
  it('sums unpaid and overdue invoices for the user', () => {
    const invoices = [
      makeInvoice({ status: 'unpaid', grandTotal: 200 }),
      makeInvoice({ status: 'overdue', grandTotal: 150 }),
      makeInvoice({ status: 'paid', grandTotal: 999 }),
      makeInvoice({ status: 'draft', grandTotal: 50 }),
    ];
    expect(aggregateOutstanding(invoices, 'user-1')).toBe(350);
  });
});

// ─── Test 3: Overdue count metric ─────────────────────────────────────────────

describe('Dashboard metric: overdue invoice count', () => {
  it('counts invoices where isOverdue returns true for the user', () => {
    const pastDate = '2020-01-01';
    const futureDate = '2099-12-31';

    const invoices = [
      makeInvoice({ status: 'unpaid', dueDate: pastDate, userId: 'user-1' }),
      makeInvoice({ status: 'overdue', dueDate: pastDate, userId: 'user-1' }),
      makeInvoice({ status: 'unpaid', dueDate: futureDate, userId: 'user-1' }),
      makeInvoice({ status: 'paid', dueDate: pastDate, userId: 'user-1' }),
      makeInvoice({ status: 'unpaid', dueDate: pastDate, userId: 'user-2' }),
    ];

    const overdueCount = invoices.filter(
      inv => inv.userId === 'user-1' && isOverdue(inv.dueDate, inv.status),
    ).length;

    expect(overdueCount).toBe(2);
  });

  it('does not count paid or cancelled invoices as overdue', () => {
    const pastDate = '2020-01-01';
    const invoices = [
      makeInvoice({ status: 'paid', dueDate: pastDate }),
      makeInvoice({ status: 'cancelled', dueDate: pastDate }),
    ];

    const overdueCount = invoices.filter(
      inv => inv.userId === 'user-1' && isOverdue(inv.dueDate, inv.status),
    ).length;

    expect(overdueCount).toBe(0);
  });
});

// ─── Test 4: Draft count metric ───────────────────────────────────────────────

describe('Dashboard metric: draft invoice count', () => {
  it('counts only draft invoices for the user', () => {
    const invoices = [
      makeInvoice({ status: 'draft', userId: 'user-1' }),
      makeInvoice({ status: 'draft', userId: 'user-1' }),
      makeInvoice({ status: 'unpaid', userId: 'user-1' }),
      makeInvoice({ status: 'draft', userId: 'user-2' }),
    ];

    const draftCount = invoices.filter(
      inv => inv.userId === 'user-1' && inv.status === 'draft',
    ).length;

    expect(draftCount).toBe(2);
  });
});

// ─── Test 5: Recent activity sorting ─────────────────────────────────────────

describe('Dashboard recent activity: sorting and truncation', () => {
  it('sorts invoices by updatedAt descending', () => {
    const invoices = [
      makeInvoice({ id: 'a', updatedAt: '2024-01-01T00:00:00Z' }),
      makeInvoice({ id: 'b', updatedAt: '2024-06-15T00:00:00Z' }),
      makeInvoice({ id: 'c', updatedAt: '2024-03-10T00:00:00Z' }),
    ];

    const sorted = [...invoices].sort((a, b) =>
      a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0,
    );

    expect(sorted[0].id).toBe('b');
    expect(sorted[1].id).toBe('c');
    expect(sorted[2].id).toBe('a');
  });

  it('returns top 5 most recently updated invoices', () => {
    const invoices = Array.from({ length: 8 }, (_, i) =>
      makeInvoice({
        id: `inv-${i}`,
        updatedAt: `2024-0${(i % 9) + 1}-01T00:00:00Z`,
      }),
    );

    const recent = [...invoices]
      .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0))
      .slice(0, 5);

    expect(recent).toHaveLength(5);
  });

  it('returns all invoices when fewer than 5 exist', () => {
    const invoices = [
      makeInvoice({ id: 'x', updatedAt: '2024-05-01T00:00:00Z' }),
      makeInvoice({ id: 'y', updatedAt: '2024-04-01T00:00:00Z' }),
    ];

    const recent = [...invoices]
      .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0))
      .slice(0, 5);

    expect(recent).toHaveLength(2);
    expect(recent[0].id).toBe('x');
    expect(recent[1].id).toBe('y');
  });

  it('filters recent activity to the current userId', () => {
    const invoices = [
      makeInvoice({ id: 'u1a', userId: 'user-1', updatedAt: '2024-06-01T00:00:00Z' }),
      makeInvoice({ id: 'u2a', userId: 'user-2', updatedAt: '2024-07-01T00:00:00Z' }),
      makeInvoice({ id: 'u1b', userId: 'user-1', updatedAt: '2024-05-01T00:00:00Z' }),
    ];

    const recent = invoices
      .filter(inv => inv.userId === 'user-1')
      .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0))
      .slice(0, 5);

    expect(recent).toHaveLength(2);
    expect(recent[0].id).toBe('u1a');
    expect(recent[1].id).toBe('u1b');
  });
});
