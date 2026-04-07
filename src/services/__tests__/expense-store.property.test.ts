/**
 * Property-based tests for expense-store
 * Uses fast-check for property generation
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import os from 'os';
import fs from 'fs';
import path from 'path';
import {
  createExpense,
  deleteExpense,
  getAllExpenses,
  _setUserDataPath,
} from '../expense-store';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expense-store-prop-'));
  _setUserDataPath(tmpDir);
});

afterEach(() => {
  _setUserDataPath(null);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Valid ISO date string YYYY-MM-DD */
const validDateArb = fc.record({
  year: fc.integer({ min: 2020, max: 2030 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
}).map(({ year, month, day }) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
);

/** Non-empty, non-whitespace string */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0);

/** Non-negative amount as integer cents mapped to dollars */
const validAmountArb = fc.integer({ min: 0, max: 10_000_000 }).map(n => n / 100);

/** Negative amount */
const negativeAmountArb = fc.integer({ min: -10_000_000, max: -1 }).map(n => n / 100);

/** Valid expense payload */
const validPayloadArb = fc.record({
  date: validDateArb,
  amount: validAmountArb,
  category: nonEmptyStringArb,
  description: nonEmptyStringArb,
});

/** Invalid expense payload — at least one field is invalid */
const invalidPayloadArb = fc.oneof(
  // negative amount
  fc.record({
    date: validDateArb,
    amount: negativeAmountArb,
    category: nonEmptyStringArb,
    description: nonEmptyStringArb,
  }),
  // empty category
  fc.record({
    date: validDateArb,
    amount: validAmountArb,
    category: fc.constantFrom('', '   ', '\t', '\n'),
    description: nonEmptyStringArb,
  }),
  // empty description
  fc.record({
    date: validDateArb,
    amount: validAmountArb,
    category: nonEmptyStringArb,
    description: fc.constantFrom('', '   ', '\t', '\n'),
  }),
  // missing date
  fc.record({
    date: fc.constantFrom('', '   '),
    amount: validAmountArb,
    category: nonEmptyStringArb,
    description: nonEmptyStringArb,
  }),
);

/** Safe alphanumeric userId (safe as directory names on all platforms) */
const safeUserIdArb = fc.stringMatching(/^[a-z0-9]{1,16}$/);

/** Distinct userId pair */
const distinctUserIdsArb = fc.tuple(safeUserIdArb, safeUserIdArb)
  .filter(([a, b]) => a !== b);

// ─── Property 3: Expense create round-trip ────────────────────────────────────
// Feature: reporting-analytics, Property 3: Expense create round-trip

describe('Property 3: Expense create round-trip', () => {
  it('creating a valid expense means getAllExpenses contains it — Validates: Requirements 2.2, 2.8', () => {
    fc.assert(
      fc.property(validPayloadArb, (payload) => {
        const userId = 'user-prop3';
        const result = createExpense(userId, payload);
        expect(result.success).toBe(true);

        const all = getAllExpenses(userId);
        expect(all.success).toBe(true);
        const found = all.data!.find(e => e.id === result.data!.id);
        expect(found).toBeDefined();
        expect(found!.amount).toBe(result.data!.amount);
        expect(found!.category).toBe(result.data!.category);
        expect(found!.description).toBe(result.data!.description);
        expect(found!.date).toBe(result.data!.date);

        // Clean up for next iteration
        deleteExpense(userId, result.data!.id);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 4: Expense validation rejects invalid inputs ────────────────────
// Feature: reporting-analytics, Property 4: Expense validation rejects invalid inputs

describe('Property 4: Expense validation rejects invalid inputs', () => {
  it('invalid payload returns success:false and getAllExpenses is unchanged — Validates: Requirements 2.3', () => {
    fc.assert(
      fc.property(invalidPayloadArb, (payload) => {
        const userId = 'user-prop4';
        const before = getAllExpenses(userId).data!.length;

        const result = createExpense(userId, payload);
        expect(result.success).toBe(false);

        const after = getAllExpenses(userId).data!.length;
        expect(after).toBe(before);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 5: Expense delete round-trip ────────────────────────────────────
// Feature: reporting-analytics, Property 5: Expense delete round-trip

describe('Property 5: Expense delete round-trip', () => {
  it('deleting a created expense means getAllExpenses no longer contains it — Validates: Requirements 2.4', () => {
    fc.assert(
      fc.property(validPayloadArb, (payload) => {
        const userId = 'user-prop5';
        const created = createExpense(userId, payload);
        expect(created.success).toBe(true);
        const id = created.data!.id;

        const deleted = deleteExpense(userId, id);
        expect(deleted.success).toBe(true);

        const all = getAllExpenses(userId);
        expect(all.success).toBe(true);
        const found = all.data!.find(e => e.id === id);
        expect(found).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 6: Expense user isolation ──────────────────────────────────────
// Feature: reporting-analytics, Property 6: Expense user isolation

describe('Property 6: Expense user isolation', () => {
  it('expenses written for userId A never appear in getAllExpenses for userId B — Validates: Requirements 2.7', () => {
    fc.assert(
      fc.property(distinctUserIdsArb, validPayloadArb, ([userA, userB], payload) => {
        const created = createExpense(userA, payload);
        expect(created.success).toBe(true);

        const bExpenses = getAllExpenses(userB);
        expect(bExpenses.success).toBe(true);
        const leaked = bExpenses.data!.find(e => e.id === created.data!.id);
        expect(leaked).toBeUndefined();

        // Clean up
        deleteExpense(userA, created.data!.id);
      }),
      { numRuns: 100 },
    );
  });
});
