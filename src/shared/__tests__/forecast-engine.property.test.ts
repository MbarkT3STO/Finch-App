/**
 * Property-based tests for forecastRevenue
 * Uses fast-check for property generation
 *
 * Validates: Requirements 1.1, 1.2, 1.6
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { forecastRevenue } from '../forecast-engine';
import type { Invoice } from '../types';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const invoiceStatusArb = fc.constantFrom(
  'draft', 'unpaid', 'paid', 'overdue', 'cancelled',
) as fc.Arbitrary<Invoice['status']>;

/** Generates a YYYY-MM-DD date string within a reasonable range. */
const issueDateArb = fc.record({
  year: fc.integer({ min: 2020, max: 2030 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }), // use 28 to avoid month-end edge cases
}).map(({ year, month, day }) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
);

const invoiceArb = fc.record({
  id: fc.uuid(),
  number: fc.constant('001'),
  prefix: fc.constant('INV'),
  userId: fc.uuid(),
  clientId: fc.option(fc.uuid(), { nil: undefined }),
  status: invoiceStatusArb,
  issueDate: issueDateArb,
  dueDate: fc.constant('2024-07-15'),
  billFrom: fc.constant({} as Invoice['billFrom']),
  billTo: fc.constant({}),
  lineItems: fc.constant([]),
  discount: fc.constant({ type: 'percent' as const, value: 0 }),
  shipping: fc.constant(0),
  currency: fc.constant('USD'),
  currencySymbol: fc.constant('$'),
  taxMode: fc.constant('exclusive' as const),
  subtotal: fc.constant(0),
  taxTotal: fc.constant(0),
  discountAmount: fc.constant(0),
  grandTotal: fc.integer({ min: 0, max: 1_000_000 }).map(n => n / 100),
  createdAt: fc.constant('2024-01-01T00:00:00Z'),
  updatedAt: fc.constant('2024-01-01T00:00:00Z'),
});

/** Generates a valid reference date (any date in a reasonable range). */
const referenceDateArb = fc.record({
  year: fc.integer({ min: 2021, max: 2030 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
}).map(({ year, month, day }) => new Date(year, month - 1, day));

// ─── Property 1: Forecast output shape ───────────────────────────────────────
// Feature: reporting-analytics, Property 1: Forecast output shape

describe('Property 1: Forecast output shape', () => {
  it('returns exactly 3 ForecastResult items with non-empty period and non-negative amount — Validates: Requirements 1.1, 1.2, 1.6', () => {
    fc.assert(
      fc.property(fc.array(invoiceArb), referenceDateArb, (invoices, referenceDate) => {
        const results = forecastRevenue(invoices, referenceDate);

        // Exactly 3 items
        expect(results).toHaveLength(3);

        for (const r of results) {
          // Non-empty period string
          expect(typeof r.period).toBe('string');
          expect(r.period.length).toBeGreaterThan(0);
          // Matches YYYY-MM format
          expect(r.period).toMatch(/^\d{4}-\d{2}$/);
          // Non-negative amount
          expect(r.amount).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('the 3 periods are consecutive months immediately after the reference month', () => {
    fc.assert(
      fc.property(fc.array(invoiceArb), referenceDateArb, (invoices, referenceDate) => {
        const results = forecastRevenue(invoices, referenceDate);

        const refYear = referenceDate.getFullYear();
        const refMonth = referenceDate.getMonth(); // 0-indexed

        for (let i = 0; i < 3; i++) {
          let expectedMonth = refMonth + i + 1; // 0-indexed
          let expectedYear = refYear;
          if (expectedMonth > 11) {
            expectedMonth -= 12;
            expectedYear += 1;
          }
          const expectedPeriod = `${expectedYear}-${String(expectedMonth + 1).padStart(2, '0')}`;
          expect(results[i].period).toBe(expectedPeriod);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Property 2: Forecast average correctness ────────────────────────────────
// Feature: reporting-analytics, Property 2: Forecast average correctness

describe('Property 2: Forecast average correctness', () => {
  it('amount equals arithmetic mean of paid grandTotals in the 6-month window (or 0 if none) — Validates: Requirements 1.1, 1.2', () => {
    fc.assert(
      fc.property(fc.array(invoiceArb), referenceDateArb, (invoices, referenceDate) => {
        const refYear = referenceDate.getFullYear();
        const refMonth = referenceDate.getMonth(); // 0-indexed

        // Replicate the 6-month window logic
        const windowMonths: Array<{ year: number; month: number }> = [];
        for (let i = 5; i >= 0; i--) {
          let m = refMonth - i;
          let y = refYear;
          if (m < 0) { m += 12; y -= 1; }
          windowMonths.push({ year: y, month: m });
        }

        const paidInWindow = invoices.filter(inv => {
          if (inv.status !== 'paid') return false;
          const d = new Date(inv.issueDate);
          const y = d.getFullYear();
          const m = d.getMonth();
          return windowMonths.some(w => w.year === y && w.month === m);
        });

        const expectedAmount = paidInWindow.length > 0
          ? paidInWindow.reduce((sum, inv) => sum + inv.grandTotal, 0) / 6
          : 0;

        const results = forecastRevenue(invoices, referenceDate);

        for (const r of results) {
          expect(r.amount).toBeCloseTo(expectedAmount, 10);
        }
      }),
      { numRuns: 200 },
    );
  });
});
