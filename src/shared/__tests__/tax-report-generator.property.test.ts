/**
 * Property-based tests for buildTaxSummary
 * Uses fast-check for property generation
 *
 * Validates: Requirements 3.2, 3.8
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildTaxSummary } from '../tax-report-generator';
import type { Invoice } from '../types';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const invoiceStatusArb = fc.constantFrom(
  'draft', 'unpaid', 'paid', 'overdue', 'cancelled',
) as fc.Arbitrary<Invoice['status']>;

const issueDateArb = fc.record({
  year: fc.integer({ min: 2020, max: 2030 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
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
  taxTotal: fc.integer({ min: 0, max: 100_000 }).map(n => n / 100),
  discountAmount: fc.constant(0),
  grandTotal: fc.integer({ min: 0, max: 1_000_000 }).map(n => n / 100),
  createdAt: fc.constant('2024-01-01T00:00:00Z'),
  updatedAt: fc.constant('2024-01-01T00:00:00Z'),
});

const yearArb = fc.integer({ min: 2020, max: 2030 });

// ─── Property 7: Tax aggregation invariant ───────────────────────────────────
// Feature: reporting-analytics, Property 7: Tax aggregation invariant

describe('Property 7: Tax aggregation invariant', () => {
  it('sum of row.taxTotal equals sum of taxTotal for paid invoices in the year — Validates: Requirements 3.8', () => {
    fc.assert(
      fc.property(fc.array(invoiceArb), yearArb, (invoices, year) => {
        const summary = buildTaxSummary(invoices, year);

        // Sum of row.taxTotal across all 12 rows
        const rowTaxSum = summary.rows.reduce((s, r) => s + r.taxTotal, 0);

        // Sum of invoice.taxTotal for paid invoices in the target year
        const expectedTaxSum = invoices
          .filter(inv => {
            if (inv.status !== 'paid') return false;
            return new Date(inv.issueDate).getFullYear() === year;
          })
          .reduce((s, inv) => s + inv.taxTotal, 0);

        expect(rowTaxSum).toBeCloseTo(expectedTaxSum, 10);

        // annualTaxTotal must also match
        expect(summary.annualTaxTotal).toBeCloseTo(expectedTaxSum, 10);
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Property 8: Only paid invoices ──────────────────────────────────────────
// Feature: reporting-analytics, Property 8: Tax summary only includes paid invoices

describe('Property 8: Tax summary only includes paid invoices', () => {
  it('result is identical whether non-paid invoices are included or filtered out first — Validates: Requirements 3.2, 3.8', () => {
    fc.assert(
      fc.property(fc.array(invoiceArb), yearArb, (invoices, year) => {
        const fullResult = buildTaxSummary(invoices, year);
        const paidOnly = invoices.filter(inv => inv.status === 'paid');
        const paidResult = buildTaxSummary(paidOnly, year);

        // Both summaries must be identical
        expect(fullResult.annualTotalInvoiced).toBeCloseTo(paidResult.annualTotalInvoiced, 10);
        expect(fullResult.annualTaxTotal).toBeCloseTo(paidResult.annualTaxTotal, 10);
        expect(fullResult.annualNet).toBeCloseTo(paidResult.annualNet, 10);

        for (let i = 0; i < 12; i++) {
          expect(fullResult.rows[i].totalInvoiced).toBeCloseTo(paidResult.rows[i].totalInvoiced, 10);
          expect(fullResult.rows[i].taxTotal).toBeCloseTo(paidResult.rows[i].taxTotal, 10);
          expect(fullResult.rows[i].net).toBeCloseTo(paidResult.rows[i].net, 10);
        }
      }),
      { numRuns: 200 },
    );
  });
});
