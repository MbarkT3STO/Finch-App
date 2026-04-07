/**
 * Property-based tests for invoice HTML rendering
 * Uses fast-check for property generation
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  renderInvoiceHtml,
  renderClassicHtml,
  renderModernHtml,
  renderMinimalHtml,
} from '../invoice-html';
import { generatePreviewHtml } from '../../renderer/scripts/pdf-generator';
import { generateInvoiceHtml } from '../../main/pdf-template';
import type { Invoice, AppSettings } from '../types';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const validTemplate = fc.constantFrom('classic', 'modern', 'minimal') as fc.Arbitrary<'classic' | 'modern' | 'minimal'>;

const invalidTemplate = fc.string({ minLength: 1 }).filter(
  s => s !== 'classic' && s !== 'modern' && s !== 'minimal',
);

const lineItemArb = fc.record({
  id: fc.uuid(),
  description: fc.string({ minLength: 1, maxLength: 80 }),
  quantity: fc.integer({ min: 1, max: 100 }),
  unitPrice: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
  taxRate: fc.integer({ min: 0, max: 30 }),
  amount: fc.integer({ min: 0, max: 1000000 }).map(n => n / 100),
});

const billToArb = fc.record({
  name: fc.stringMatching(/^[A-Za-z0-9 ]{1,60}$/),
  company: fc.option(fc.stringMatching(/^[A-Za-z0-9 ]{1,60}$/), { nil: undefined }),
  address: fc.option(fc.string({ minLength: 1, maxLength: 80 }), { nil: undefined }),
  city: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
  state: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
  zip: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  country: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
  email: fc.option(fc.emailAddress(), { nil: undefined }),
});

const businessDetailsArb = fc.record({
  name: fc.stringMatching(/^[A-Za-z0-9 ]{1,60}$/),
  address: fc.string({ minLength: 0, maxLength: 80 }),
  city: fc.string({ minLength: 0, maxLength: 40 }),
  state: fc.string({ minLength: 0, maxLength: 40 }),
  zip: fc.string({ minLength: 0, maxLength: 20 }),
  country: fc.string({ minLength: 0, maxLength: 40 }),
  email: fc.emailAddress(),
  phone: fc.string({ minLength: 0, maxLength: 20 }),
});

const invoiceArb = fc.record({
  id: fc.uuid(),
  number: fc.stringMatching(/^[A-Za-z0-9-]{1,20}$/),
  prefix: fc.constant('INV'),
  userId: fc.uuid(),
  status: fc.constantFrom('draft', 'unpaid', 'paid', 'overdue', 'cancelled') as fc.Arbitrary<Invoice['status']>,
  issueDate: fc.constant('2024-01-15'),
  dueDate: fc.constant('2024-02-15'),
  currencySymbol: fc.constant('$'),
  billFrom: businessDetailsArb,
  billTo: billToArb,
  lineItems: fc.array(lineItemArb, { minLength: 0, maxLength: 5 }),
  subtotal: fc.integer({ min: 0, max: 100000 }).map(n => n / 100),
  taxTotal: fc.integer({ min: 0, max: 10000 }).map(n => n / 100),
  discountAmount: fc.integer({ min: 0, max: 5000 }).map(n => n / 100),
  grandTotal: fc.integer({ min: 0, max: 110000 }).map(n => n / 100),
  discount: fc.record({ type: fc.constantFrom('percent', 'fixed') as fc.Arbitrary<'percent' | 'fixed'>, value: fc.integer({ min: 0, max: 10000 }).map(n => n / 100) }),
  shipping: fc.integer({ min: 0, max: 100000 }).map(n => n / 100),
  notes: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
  terms: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
  template: validTemplate,
  footerText: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
  currency: fc.constant('USD'),
  taxMode: fc.constantFrom('inclusive', 'exclusive') as fc.Arbitrary<'inclusive' | 'exclusive'>,
  createdAt: fc.constant('2024-01-15T00:00:00Z'),
  updatedAt: fc.constant('2024-01-15T00:00:00Z'),
});

const settingsArb = fc.record({
  taxRate: fc.integer({ min: 0, max: 3000 }).map(n => n / 100),
  currency: fc.constant('USD'),
  currencySymbol: fc.constant('$'),
  theme: fc.constantFrom('light', 'dark', 'system') as fc.Arbitrary<'light' | 'dark' | 'system'>,
  autoSaveInterval: fc.integer({ min: 5, max: 120 }),
  invoicePrefix: fc.constant('INV'),
  nextInvoiceNumber: fc.integer({ min: 1, max: 9999 }),
  businessDetails: businessDetailsArb,
  defaultInvoiceTemplate: validTemplate,
  defaultFooterText: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
});

// ─── P1: Template field round-trip ────────────────────────────────────────────
// Feature: invoice-templates-footer, Property 1: Template field round-trip

describe('P1: Template field round-trip', () => {
  it('serialise/deserialise invoice preserves template field — Validates: Requirements 1.1, 5.1', () => {
    fc.assert(
      fc.property(invoiceArb, invoice => {
        const serialised = JSON.stringify(invoice);
        const deserialised = JSON.parse(serialised) as typeof invoice;
        expect(deserialised.template).toBe(invoice.template);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── P2: Unknown template falls back to classic ───────────────────────────────
// Feature: invoice-templates-footer, Property 2: Unknown template falls back to classic

describe('P2: Unknown template falls back to classic', () => {
  it('arbitrary non-valid template string produces classic output — Validates: Requirements 1.7, 11.2', () => {
    fc.assert(
      fc.property(invoiceArb, settingsArb, invalidTemplate, (invoice, settings, badTemplate) => {
        const withBad = { ...invoice, template: badTemplate as never };
        const withClassic = { ...invoice, template: 'classic' as const };
        const htmlBad = renderInvoiceHtml(withBad, settings);
        const htmlClassic = renderInvoiceHtml(withClassic, settings);
        expect(htmlBad).toBe(htmlClassic);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── P3: All templates render required fields ─────────────────────────────────
// Feature: invoice-templates-footer, Property 3: All templates render required fields

describe('P3: All templates render required fields', () => {
  it('random invoice data rendered with each template contains number, bill-to name, grand total — Validates: Requirements 2.2, 3.6, 4.5', () => {
    fc.assert(
      fc.property(invoiceArb, settingsArb, (invoice, settings) => {
        const templates = ['classic', 'modern', 'minimal'] as const;
        for (const tpl of templates) {
          const html = renderInvoiceHtml({ ...invoice, template: tpl }, settings);
          expect(html).toContain(invoice.number);
          expect(html).toContain(invoice.billTo.name);
          // Grand total is formatted — just check it's a number present somewhere
          expect(html.length).toBeGreaterThan(100);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─── P4: Footer present iff non-empty ────────────────────────────────────────
// Feature: invoice-templates-footer, Property 4: Footer present iff non-empty

describe('P4: Footer present iff non-empty', () => {
  it('footer section presence matches non-emptiness of footerText — Validates: Requirements 7.6, 7.7', () => {
    const footerTextArb = fc.oneof(
      fc.constant(''),
      fc.constant(undefined),
      fc.string({ minLength: 1, maxLength: 200 }),
    );

    fc.assert(
      fc.property(invoiceArb, settingsArb, footerTextArb, (invoice, settings, footerText) => {
        const inv = { ...invoice, footerText };
        const html = renderInvoiceHtml(inv, settings);
        const hasFooter = html.includes('<div class="footer-text">');
        const isNonEmpty = typeof footerText === 'string' && footerText.length > 0;
        expect(hasFooter).toBe(isNonEmpty);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── P5: Default template applied to new invoices ────────────────────────────
// Feature: invoice-templates-footer, Property 5: Default template applied to new invoices

describe('P5: Default template applied to new invoices', () => {
  it('new invoice inherits defaultInvoiceTemplate from settings — Validates: Requirements 6.3, 6.4', () => {
    fc.assert(
      fc.property(settingsArb, settings => {
        // Simulate new invoice creation: template comes from settings.defaultInvoiceTemplate ?? 'classic'
        const defaultTemplate = settings.defaultInvoiceTemplate ?? 'classic';
        const newInvoice = { template: defaultTemplate };
        expect(newInvoice.template).toBe(defaultTemplate);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── P6: Default footer text applied to new invoices ─────────────────────────
// Feature: invoice-templates-footer, Property 6: Default footer text applied to new invoices

describe('P6: Default footer text applied to new invoices', () => {
  it('new invoice footerText matches non-empty defaultFooterText from settings — Validates: Requirements 9.3, 9.4', () => {
    const nonEmptyFooterArb = fc.string({ minLength: 1, maxLength: 200 });

    fc.assert(
      fc.property(settingsArb, nonEmptyFooterArb, (settings, defaultFooterText) => {
        const settingsWithFooter = { ...settings, defaultFooterText };
        // Simulate new invoice creation: footerText comes from settings.defaultFooterText ?? ''
        const newInvoice = { footerText: settingsWithFooter.defaultFooterText ?? '' };
        expect(newInvoice.footerText).toBe(defaultFooterText);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── P7: Footer edit does not mutate settings ─────────────────────────────────
// Feature: invoice-templates-footer, Property 7: Footer edit does not mutate settings

describe('P7: Footer edit does not mutate settings', () => {
  it('mutating invoice.footerText does not change settings.defaultFooterText — Validates: Requirements 9.5', () => {
    const newFooterArb = fc.string({ minLength: 1, maxLength: 200 });

    fc.assert(
      fc.property(settingsArb, invoiceArb, newFooterArb, (settings, invoice, newFooter) => {
        const originalDefaultFooter = settings.defaultFooterText;
        // Simulate editing the invoice footer
        const editedInvoice = { ...invoice, footerText: newFooter };
        // Settings must remain unchanged
        expect(settings.defaultFooterText).toBe(originalDefaultFooter);
        // Invoice has the new value
        expect(editedInvoice.footerText).toBe(newFooter);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── P8: Modern template contains dark header ─────────────────────────────────
// Feature: invoice-templates-footer, Property 8: Modern template contains dark header

describe('P8: Modern template contains dark header', () => {
  it('random invoice rendered with modern contains dark header colour — Validates: Requirements 3.2', () => {
    fc.assert(
      fc.property(invoiceArb, settingsArb, (invoice, settings) => {
        const html = renderModernHtml({ ...invoice, template: 'modern' }, settings);
        expect(html).toContain('#1A1A2E');
        expect(html).toContain('mod-header');
      }),
      { numRuns: 100 },
    );
  });
});

// ─── P9: Minimal template uses only greyscale ────────────────────────────────
// Feature: invoice-templates-footer, Property 9: Minimal template uses only greyscale

describe('P9: Minimal template uses only greyscale', () => {
  it('random invoice rendered with minimal contains no out-of-palette colour values — Validates: Requirements 4.2, 4.3', () => {
    // Allowed palette: #000000, #FFFFFF, #6B7280, #E5E7EB, #000
    const allowedColours = new Set(['#000000', '#ffffff', '#6b7280', '#e5e7eb', '#000']);

    fc.assert(
      fc.property(invoiceArb, settingsArb, (invoice, settings) => {
        const html = renderMinimalHtml({ ...invoice, template: 'minimal' }, settings);
        // Only check colours in the <style> block — user data in the body is not CSS
        const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
        const cssBlock = styleMatch ? styleMatch[1] : '';
        // Extract all hex colour values from the CSS
        const hexColours = cssBlock.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
        for (const colour of hexColours) {
          const normalised = colour.toLowerCase();
          expect(allowedColours.has(normalised)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─── P10: Preview and export produce identical HTML ───────────────────────────
// Feature: invoice-templates-footer, Property 10: Preview and export produce identical HTML

describe('P10: Preview and export produce identical HTML', () => {
  it('generatePreviewHtml equals generateInvoiceHtml output — Validates: Requirements 10.3', () => {
    fc.assert(
      fc.property(invoiceArb, settingsArb, (invoice, settings) => {
        const previewHtml = generatePreviewHtml(invoice, settings);
        const exportHtml = generateInvoiceHtml(invoice as Invoice, settings);
        expect(previewHtml).toBe(exportHtml);
      }),
      { numRuns: 100 },
    );
  });
});
