import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../theme-resolver';

// ─── system theme ─────────────────────────────────────────────────────────────

describe("resolveTheme('system', ...)", () => {
  it("returns 'dark' when systemIsDark is true (Req 4.8)", () => {
    expect(resolveTheme('system', true)).toBe('dark');
  });

  it("returns 'light' when systemIsDark is false (Req 4.9)", () => {
    expect(resolveTheme('system', false)).toBe('light');
  });
});

// ─── explicit light / dark ────────────────────────────────────────────────────

describe("resolveTheme('light', ...)", () => {
  it("returns 'light' regardless of systemIsDark=true", () => {
    expect(resolveTheme('light', true)).toBe('light');
  });

  it("returns 'light' regardless of systemIsDark=false", () => {
    expect(resolveTheme('light', false)).toBe('light');
  });
});

describe("resolveTheme('dark', ...)", () => {
  it("returns 'dark' regardless of systemIsDark=true", () => {
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it("returns 'dark' regardless of systemIsDark=false", () => {
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
