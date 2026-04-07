/**
 * Property-based tests for resolveTheme
 * Uses fast-check for property generation
 *
 * Validates: Requirements 4.5, 4.6, 4.7
 */
// Feature: reporting-analytics, Property 9: resolveTheme correctness and determinism

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { resolveTheme } from '../theme-resolver';
import type { AppSettings } from '../types';

const themeArb = fc.constantFrom<AppSettings['theme']>('light', 'dark', 'system');
const systemIsDarkArb = fc.boolean();

describe('Property 9: resolveTheme correctness and determinism', () => {
  it('is deterministic — same arguments always return the same value — Validates: Requirements 4.5', () => {
    fc.assert(
      fc.property(themeArb, systemIsDarkArb, (theme, systemIsDark) => {
        const first = resolveTheme(theme, systemIsDark);
        const second = resolveTheme(theme, systemIsDark);
        expect(first).toBe(second);
      }),
      { numRuns: 100 },
    );
  });

  it("resolveTheme('light', systemIsDark) always returns 'light' — Validates: Requirements 4.6", () => {
    fc.assert(
      fc.property(systemIsDarkArb, (systemIsDark) => {
        expect(resolveTheme('light', systemIsDark)).toBe('light');
      }),
      { numRuns: 100 },
    );
  });

  it("resolveTheme('dark', systemIsDark) always returns 'dark' — Validates: Requirements 4.7", () => {
    fc.assert(
      fc.property(systemIsDarkArb, (systemIsDark) => {
        expect(resolveTheme('dark', systemIsDark)).toBe('dark');
      }),
      { numRuns: 100 },
    );
  });
});
