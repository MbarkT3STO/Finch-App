import { describe, it, expect } from 'vitest';
import { forecastRevenue } from '../forecast-engine';
import type { Invoice } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: 'inv-1',
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
    createdAt: '2024-06-15T00:00:00Z',
    updatedAt: '2024-06-15T00:00:00Z',
    ...overrides,
  };
}

// ─── Empty array ──────────────────────────────────────────────────────────────

describe('forecastRevenue — empty invoice array', () => {
  it('returns exactly 3 results', () => {
    const result = forecastRevenue([], new Date('2024-06-30'));
    expect(result).toHaveLength(3);
  });

  it('all amounts are 0', () => {
    const result = forecastRevenue([], new Date('2024-06-30'));
    result.forEach(r => expect(r.amount).toBe(0));
  });

  it('periods are the 3 months following the reference date', () => {
    const result = forecastRevenue([], new Date('2024-06-30'));
    expect(result[0].period).toBe('2024-07');
    expect(result[1].period).toBe('2024-08');
    expect(result[2].period).toBe('2024-09');
  });
});

// ─── Single paid invoice ──────────────────────────────────────────────────────

describe('forecastRevenue — single paid invoice in window', () => {
  it('amount equals grandTotal / 6', () => {
    const invoices = [makeInvoice({ grandTotal: 600, issueDate: '2024-06-10' })];
    const result = forecastRevenue(invoices, new Date('2024-06-30'));
    // 600 / 6 = 100
    result.forEach(r => expect(r.amount).toBeCloseTo(100, 10));
  });

  it('periods are correct', () => {
    const invoices = [makeInvoice({ grandTotal: 600, issueDate: '2024-06-10' })];
    const result = forecastRevenue(invoices, new Date('2024-06-30'));
    expect(result[0].period).toBe('2024-07');
    expect(result[1].period).toBe('2024-08');
    expect(result[2].period).toBe('2024-09');
  });

  it('non-paid invoice in window is ignored', () => {
    const invoices = [makeInvoice({ status: 'unpaid', grandTotal: 600, issueDate: '2024-06-10' })];
    const result = forecastRevenue(invoices, new Date('2024-06-30'));
    result.forEach(r => expect(r.amount).toBe(0));
  });

  it('paid invoice outside the 6-month window is ignored', () => {
    // Reference date: 2024-06-30 → window is Jan–Jun 2024
    // Invoice in Dec 2023 is outside the window
    const invoices = [makeInvoice({ grandTotal: 600, issueDate: '2023-12-15' })];
    const result = forecastRevenue(invoices, new Date('2024-06-30'));
    result.forEach(r => expect(r.amount).toBe(0));
  });
});

// ─── Multiple invoices ────────────────────────────────────────────────────────

describe('forecastRevenue — multiple paid invoices', () => {
  it('averages across 6 months (not number of invoices)', () => {
    // 3 invoices totalling 1200 → average = 1200 / 6 = 200
    const invoices = [
      makeInvoice({ id: 'a', grandTotal: 400, issueDate: '2024-04-10' }),
      makeInvoice({ id: 'b', grandTotal: 400, issueDate: '2024-05-10' }),
      makeInvoice({ id: 'c', grandTotal: 400, issueDate: '2024-06-10' }),
    ];
    const result = forecastRevenue(invoices, new Date('2024-06-30'));
    result.forEach(r => expect(r.amount).toBeCloseTo(200, 10));
  });

  it('cancelled invoices are excluded', () => {
    const invoices = [
      makeInvoice({ id: 'a', grandTotal: 600, issueDate: '2024-06-10' }),
      makeInvoice({ id: 'b', status: 'cancelled', grandTotal: 999, issueDate: '2024-06-10' }),
    ];
    const result = forecastRevenue(invoices, new Date('2024-06-30'));
    result.forEach(r => expect(r.amount).toBeCloseTo(100, 10));
  });
});

// ─── Year-boundary cases ──────────────────────────────────────────────────────

describe('forecastRevenue — year boundary', () => {
  it('window spans previous year correctly (reference = Jan 2024)', () => {
    // Window: Aug 2023 – Jan 2024
    const invoices = [
      makeInvoice({ id: 'a', grandTotal: 600, issueDate: '2023-08-15' }),
      makeInvoice({ id: 'b', grandTotal: 600, issueDate: '2023-12-15' }),
    ];
    const result = forecastRevenue(invoices, new Date('2024-01-31'));
    // total = 1200, average = 1200 / 6 = 200
    result.forEach(r => expect(r.amount).toBeCloseTo(200, 10));
  });

  it('forecast periods wrap into next year (reference = Nov 2024)', () => {
    const result = forecastRevenue([], new Date('2024-11-30'));
    expect(result[0].period).toBe('2024-12');
    expect(result[1].period).toBe('2025-01');
    expect(result[2].period).toBe('2025-02');
  });

  it('forecast periods wrap into next year (reference = Dec 2024)', () => {
    const result = forecastRevenue([], new Date('2024-12-31'));
    expect(result[0].period).toBe('2025-01');
    expect(result[1].period).toBe('2025-02');
    expect(result[2].period).toBe('2025-03');
  });

  it('invoice exactly on the boundary month is included', () => {
    // Reference = 2024-01-31 → window starts Aug 2023
    const invoices = [makeInvoice({ grandTotal: 600, issueDate: '2023-08-01' })];
    const result = forecastRevenue(invoices, new Date('2024-01-31'));
    result.forEach(r => expect(r.amount).toBeCloseTo(100, 10));
  });

  it('invoice one month before the window is excluded', () => {
    // Reference = 2024-01-31 → window starts Aug 2023; Jul 2023 is outside
    const invoices = [makeInvoice({ grandTotal: 600, issueDate: '2023-07-15' })];
    const result = forecastRevenue(invoices, new Date('2024-01-31'));
    result.forEach(r => expect(r.amount).toBe(0));
  });
});
