import { describe, it, expect } from 'vitest';
import {
  renderClassicHtml,
  renderModernHtml,
  renderMinimalHtml,
  renderInvoiceHtml,
} from '../invoice-html';
import type { Invoice, AppSettings } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    taxRate: 0,
    currency: 'USD',
    currencySymbol: '$',
    theme: 'system',
    autoSaveInterval: 30,
    invoicePrefix: 'INV',
    nextInvoiceNumber: 1,
    businessDetails: {
      name: 'Acme Corp',
      address: '1 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
      country: 'US',
      email: 'acme@example.com',
      phone: '555-0100',
    },
    defaultInvoiceTemplate: 'classic',
    defaultFooterText: '',
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Partial<Invoice> {
  return {
    id: 'inv-1',
    number: 'INV-001',
    status: 'unpaid',
    issueDate: '2024-01-15',
    dueDate: '2024-02-15',
    currencySymbol: '$',
    billFrom: {
      name: 'Acme Corp',
      address: '1 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
      country: 'US',
      email: 'acme@example.com',
      phone: '555-0100',
    },
    billTo: {
      name: 'Bob Client',
      company: 'Bob Co',
      address: '2 Client Ave',
      city: 'Shelbyville',
      state: 'IL',
      zip: '62565',
      country: 'US',
      email: 'bob@example.com',
    },
    lineItems: [
      {
        id: 'li-1',
        description: 'Consulting',
        quantity: 2,
        unitPrice: 500,
        taxRate: 10,
        amount: 1000,
      },
    ],
    subtotal: 1000,
    taxTotal: 100,
    discountAmount: 0,
    grandTotal: 1100,
    discount: { type: 'percent', value: 0 },
    shipping: 0,
    notes: 'Thank you for your business.',
    terms: 'Net 30',
    footerText: 'Bank: IBAN XX00 0000 0000',
    template: 'classic',
    ...overrides,
  };
}

const settings = makeSettings();

// ─── Classic template ─────────────────────────────────────────────────────────

describe('Classic template', () => {
  it('renders invoice number', () => {
    const html = renderClassicHtml(makeInvoice(), settings);
    expect(html).toContain('INV-001');
  });

  it('renders bill-to name', () => {
    const html = renderClassicHtml(makeInvoice(), settings);
    expect(html).toContain('Bob Client');
  });

  it('renders grand total', () => {
    const html = renderClassicHtml(makeInvoice(), settings);
    expect(html).toContain('1,100');
  });

  it('renders notes and terms', () => {
    const html = renderClassicHtml(makeInvoice(), settings);
    expect(html).toContain('Thank you for your business.');
    expect(html).toContain('Net 30');
  });

  it('renders footer text when present', () => {
    const html = renderClassicHtml(makeInvoice({ footerText: 'Pay via IBAN' }), settings);
    expect(html).toContain('Pay via IBAN');
    expect(html).toContain('<div class="footer-text">');
  });

  it('omits footer section when footerText is empty', () => {
    const html = renderClassicHtml(makeInvoice({ footerText: '' }), settings);
    expect(html).not.toContain('<div class="footer-text">');
  });

  it('omits footer section when footerText is absent', () => {
    const html = renderClassicHtml(makeInvoice({ footerText: undefined }), settings);
    expect(html).not.toContain('<div class="footer-text">');
  });

  it('renders line item description', () => {
    const html = renderClassicHtml(makeInvoice(), settings);
    expect(html).toContain('Consulting');
  });
});

// ─── Modern template ──────────────────────────────────────────────────────────

describe('Modern template', () => {
  it('renders invoice number', () => {
    const html = renderModernHtml(makeInvoice(), settings);
    expect(html).toContain('INV-001');
  });

  it('renders bill-to name', () => {
    const html = renderModernHtml(makeInvoice(), settings);
    expect(html).toContain('Bob Client');
  });

  it('renders grand total', () => {
    const html = renderModernHtml(makeInvoice(), settings);
    expect(html).toContain('1,100');
  });

  it('contains dark header band', () => {
    const html = renderModernHtml(makeInvoice(), settings);
    expect(html).toContain('#1A1A2E');
    expect(html).toContain('mod-header');
  });

  it('renders footer text when present', () => {
    const html = renderModernHtml(makeInvoice({ footerText: 'Modern footer' }), settings);
    expect(html).toContain('Modern footer');
    expect(html).toContain('<div class="footer-text">');
  });

  it('omits footer section when footerText is empty', () => {
    const html = renderModernHtml(makeInvoice({ footerText: '' }), settings);
    expect(html).not.toContain('<div class="footer-text">');
  });
});

// ─── Minimal template ─────────────────────────────────────────────────────────

describe('Minimal template', () => {
  it('renders invoice number', () => {
    const html = renderMinimalHtml(makeInvoice(), settings);
    expect(html).toContain('INV-001');
  });

  it('renders bill-to name', () => {
    const html = renderMinimalHtml(makeInvoice(), settings);
    expect(html).toContain('Bob Client');
  });

  it('renders grand total', () => {
    const html = renderMinimalHtml(makeInvoice(), settings);
    expect(html).toContain('1,100');
  });

  it('uses only greyscale palette (no coloured badges)', () => {
    const html = renderMinimalHtml(makeInvoice(), settings);
    // Should not contain badge pill with colour
    expect(html).not.toContain('border-radius:100px');
  });

  it('renders footer text when present', () => {
    const html = renderMinimalHtml(makeInvoice({ footerText: 'Minimal footer' }), settings);
    expect(html).toContain('Minimal footer');
    expect(html).toContain('<div class="footer-text">');
  });

  it('omits footer section when footerText is empty', () => {
    const html = renderMinimalHtml(makeInvoice({ footerText: '' }), settings);
    expect(html).not.toContain('<div class="footer-text">');
  });
});

// ─── Dispatcher: renderInvoiceHtml ────────────────────────────────────────────

describe('renderInvoiceHtml dispatcher', () => {
  it('routes classic template to classic renderer', () => {
    const html = renderInvoiceHtml(makeInvoice({ template: 'classic' }), settings);
    const classic = renderClassicHtml(makeInvoice({ template: 'classic' }), settings);
    expect(html).toBe(classic);
  });

  it('routes modern template to modern renderer', () => {
    const html = renderInvoiceHtml(makeInvoice({ template: 'modern' }), settings);
    const modern = renderModernHtml(makeInvoice({ template: 'modern' }), settings);
    expect(html).toBe(modern);
  });

  it('routes minimal template to minimal renderer', () => {
    const html = renderInvoiceHtml(makeInvoice({ template: 'minimal' }), settings);
    const minimal = renderMinimalHtml(makeInvoice({ template: 'minimal' }), settings);
    expect(html).toBe(minimal);
  });

  it('falls back to classic when template is undefined', () => {
    const html = renderInvoiceHtml(makeInvoice({ template: undefined }), settings);
    const classic = renderClassicHtml(makeInvoice({ template: undefined }), settings);
    expect(html).toBe(classic);
  });

  it('falls back to classic when template is an unknown string', () => {
    const html = renderInvoiceHtml(makeInvoice({ template: 'fancy' as never }), settings);
    const classic = renderClassicHtml(makeInvoice({ template: 'fancy' as never }), settings);
    expect(html).toBe(classic);
  });
});

// ─── All three templates produce distinct HTML ────────────────────────────────

describe('Template distinctness', () => {
  it('classic, modern, and minimal produce different HTML', () => {
    const inv = makeInvoice({ template: 'classic' });
    const classic = renderClassicHtml(inv, settings);
    const modern = renderModernHtml(inv, settings);
    const minimal = renderMinimalHtml(inv, settings);

    expect(classic).not.toBe(modern);
    expect(classic).not.toBe(minimal);
    expect(modern).not.toBe(minimal);
  });
});

// ─── Footer section presence/absence ─────────────────────────────────────────

describe('Footer section presence', () => {
  const templates = ['classic', 'modern', 'minimal'] as const;

  for (const tpl of templates) {
    it(`[${tpl}] footer section present when footerText is non-empty`, () => {
      const html = renderInvoiceHtml(makeInvoice({ template: tpl, footerText: 'Some footer' }), settings);
      expect(html).toContain('<div class="footer-text">');
      expect(html).toContain('Some footer');
    });

    it(`[${tpl}] footer section absent when footerText is empty string`, () => {
      const html = renderInvoiceHtml(makeInvoice({ template: tpl, footerText: '' }), settings);
      expect(html).not.toContain('<div class="footer-text">');
    });

    it(`[${tpl}] footer section absent when footerText is undefined`, () => {
      const html = renderInvoiceHtml(makeInvoice({ template: tpl, footerText: undefined }), settings);
      expect(html).not.toContain('<div class="footer-text">');
    });
  }
});
