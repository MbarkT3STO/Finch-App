# Design Document: Invoice Templates & Footer

## Overview

This feature extends the Finch Invoice app with three PDF visual templates (Classic, Modern, Minimal) and a per-invoice custom footer text field. Both capabilities are stored on the `Invoice` record, surfaced in the invoice editor UI, and rendered by the PDF generation pipeline.

The key design principle is **shared rendering logic**: the same template-aware HTML generator is used for both the live preview iframe and the final PDF export, guaranteeing visual consistency between what the user sees and what gets exported.

---

## Architecture

The change touches four layers:

```
┌─────────────────────────────────────────────────────────┐
│  Shared Types & Constants                               │
│  src/shared/types.ts  ·  src/shared/constants.ts        │
│  • Invoice.template, Invoice.footerText                 │
│  • AppSettings.defaultInvoiceTemplate, .defaultFooterText│
│  • DEFAULT_SETTINGS updated                             │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌─────────────────────┐     ┌──────────────────────────────┐
│  Main Process       │     │  Renderer Process            │
│  pdf-template.ts    │     │  pdf-generator.ts (preview)  │
│  generateInvoiceHtml│     │  generatePreviewHtml         │
│  dispatches to      │     │  dispatches to same          │
│  renderClassic /    │     │  renderClassic /             │
│  renderModern /     │     │  renderModern /              │
│  renderMinimal      │     │  renderMinimal               │
└─────────────────────┘     └──────────────────────────────┘
                                         │
                             ┌───────────┴──────────────┐
                             ▼                          ▼
                   ┌──────────────────┐    ┌──────────────────────┐
                   │ invoice-editor.ts│    │ settings.ts          │
                   │ • Template select│    │ • defaultInvoiceTemp │
                   │ • Footer textarea│    │ • defaultFooterText  │
                   └──────────────────┘    └──────────────────────┘
```

The HTML generation logic (CSS + markup) for each template is **duplicated** between `pdf-template.ts` (main process) and `pdf-generator.ts` (renderer). This mirrors the existing pattern in the codebase and avoids IPC round-trips during live preview. A shared helper module (`src/shared/invoice-html.ts`) will be introduced to hold the template rendering functions, imported by both files, eliminating the duplication.

---

## Components and Interfaces

### 1. Shared Template Helper — `src/shared/invoice-html.ts` (new)

Exports three pure functions and one dispatcher:

```typescript
export type InvoiceTemplate = 'classic' | 'modern' | 'minimal';

export function renderClassicHtml(invoice: Partial<Invoice>, settings: AppSettings): string
export function renderModernHtml(invoice: Partial<Invoice>, settings: AppSettings): string
export function renderMinimalHtml(invoice: Partial<Invoice>, settings: AppSettings): string

export function renderInvoiceHtml(invoice: Partial<Invoice>, settings: AppSettings): string {
  const tpl = invoice.template ?? 'classic';
  if (tpl === 'modern')  return renderModernHtml(invoice, settings);
  if (tpl === 'minimal') return renderMinimalHtml(invoice, settings);
  return renderClassicHtml(invoice, settings);
}
```

Both `pdf-template.ts` and `pdf-generator.ts` will delegate to `renderInvoiceHtml`.

### 2. `src/main/pdf-template.ts` — updated

`generateInvoiceHtml` becomes a thin wrapper:

```typescript
export function generateInvoiceHtml(invoice: Invoice, settings: AppSettings): string {
  return renderInvoiceHtml(invoice, settings);
}
```

### 3. `src/renderer/scripts/pdf-generator.ts` — updated

`generatePreviewHtml` becomes a thin wrapper:

```typescript
export function generatePreviewHtml(invoice: Partial<Invoice>, settings: AppSettings): string {
  return renderInvoiceHtml(invoice, settings);
}
```

### 4. `src/renderer/scripts/invoice-editor.ts` — updated

- `renderForm()` gains a **Template Selector** (segmented control / `<select>`) in the Invoice Details section and a **Footer textarea** after the Terms & Conditions field.
- `bindFormEvents()` wires both new controls to update `invoice.template` and `invoice.footerText` respectively, then calls `recalculate()` (which already calls `updatePreview()`).
- `setupEditorEvents()` initialises `invoice.template` from `settings.defaultInvoiceTemplate ?? 'classic'` and `invoice.footerText` from `settings.defaultFooterText ?? ''` for new invoices.

### 5. `src/renderer/scripts/settings.ts` — updated

The "Invoice Defaults" section gains:
- A template selector (`<select>` with Classic / Modern / Minimal options), bound to `s.defaultInvoiceTemplate`.
- A "Default Invoice Footer" `<textarea>`, bound to `s.defaultFooterText`.
- `saveSettings()` includes both new fields in the `partial` object.

---

## Data Models

### `Invoice` type — `src/shared/types.ts`

```typescript
export interface Invoice {
  // ... existing fields ...
  template?: 'classic' | 'modern' | 'minimal'; // default 'classic'
  footerText?: string;
}
```

Both fields are optional so existing stored invoices without them continue to work (the generator falls back to `'classic'` and omits the footer section).

### `AppSettings` type — `src/shared/types.ts`

```typescript
export interface AppSettings {
  // ... existing fields ...
  defaultInvoiceTemplate?: 'classic' | 'modern' | 'minimal';
  defaultFooterText?: string;
}
```

### `DEFAULT_SETTINGS` — `src/shared/constants.ts`

```typescript
export const DEFAULT_SETTINGS: AppSettings = {
  // ... existing fields ...
  defaultInvoiceTemplate: 'classic',
  defaultFooterText: '',
};
```

---

## Template Visual Specifications

### Classic (existing layout — preserved as-is)

The current HTML/CSS in `pdf-template.ts` becomes `renderClassicHtml`. No visual changes.

Key characteristics: cream/off-white date band (`#F5F4F0`), rounded badge, subtle table borders.

### Modern

Key characteristics:
- Full-width dark header band (`#1A1A2E`) containing logo, business name (white), and invoice number (white).
- Status badge rendered inside the header band.
- Address blocks in a two-column layout below the header on a white background.
- Line-items table with alternating row backgrounds (`#F9F9F9` / `#FFFFFF`).
- Totals block: grand-total row uses a dark background (`#1A1A2E`) with white text.
- Footer text and page footer rendered the same as Classic.

### Minimal

Key characteristics:
- Palette: `#000000`, `#FFFFFF`, `#6B7280` (one grey) only — no coloured badges, no tinted backgrounds.
- Status displayed as plain uppercase text (no badge pill).
- Sections separated by `1px solid #E5E7EB` horizontal rules only — no `border-radius`, no background bands.
- Date block: plain text layout, no background fill.
- Totals: plain rows, grand total separated by a `2px solid #000` rule.
- Footer text and page footer rendered the same as Classic.

### Footer Text Section (all templates)

Rendered below the Terms & Conditions block when `footerText` is non-empty:

```html
<hr style="border:none;border-top:1px solid #E2E0D8;margin:24px 0">
<div class="footer-text">
  <div class="lbl">Footer</div>
  <p><!-- footerText content --></p>
</div>
```

The Minimal template uses `border-top:1px solid #E5E7EB` for the rule.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Template field round-trip

*For any* invoice with a `template` value of `'classic'`, `'modern'`, or `'minimal'`, serialising the invoice to storage and deserialising it should produce an invoice with the same `template` value.

**Validates: Requirements 1.1, 5.1**

---

### Property 2: Unknown template falls back to classic

*For any* invoice whose `template` field is absent, `undefined`, or an unrecognised string, calling `renderInvoiceHtml` should produce HTML that is identical to calling it with `template: 'classic'`.

**Validates: Requirements 1.7, 11.2**

---

### Property 3: All templates render required data fields

*For any* invoice with all data fields populated (logo, number, status, bill-from, bill-to, dates, line items, totals, notes, terms, footerText) and any valid template value, the rendered HTML string should contain the invoice number, the bill-to name, and the grand total string.

**Validates: Requirements 2.2, 3.6, 4.5**

---

### Property 4: Footer text present iff non-empty

*For any* invoice, if `footerText` is a non-empty string then the rendered HTML should contain that string; if `footerText` is absent or empty then the rendered HTML should not contain the footer section marker.

**Validates: Requirements 7.6, 7.7**

---

### Property 5: Default template applied to new invoices

*For any* `AppSettings` with a valid `defaultInvoiceTemplate` value, a new invoice initialised from those settings should have its `template` field equal to `settings.defaultInvoiceTemplate`.

**Validates: Requirements 6.3, 6.4**

---

### Property 6: Default footer text applied to new invoices

*For any* `AppSettings` with a non-empty `defaultFooterText`, a new invoice initialised from those settings should have its `footerText` field equal to `settings.defaultFooterText`.

**Validates: Requirements 9.3, 9.4**

---

### Property 7: Editing footer does not mutate settings

*For any* settings object and any invoice initialised from it, mutating `invoice.footerText` should leave `settings.defaultFooterText` unchanged.

**Validates: Requirements 9.5**

---

### Property 8: Modern template contains dark header

*For any* invoice rendered with the `'modern'` template, the rendered HTML should contain the dark header band colour (`#1A1A2E`) in a header context.

**Validates: Requirements 3.2**

---

### Property 9: Minimal template uses only greyscale

*For any* invoice rendered with the `'minimal'` template, the rendered HTML should not contain any colour values outside the allowed palette (`#000000`, `#FFFFFF`, `#6B7280`, `#E5E7EB`, `#000`).

**Validates: Requirements 4.2, 4.3**

---

### Property 10: Preview and export produce identical HTML

*For any* invoice and settings, calling `generatePreviewHtml` (renderer) and `generateInvoiceHtml` (main process) with the same inputs should produce identical HTML output, since both delegate to the same shared `renderInvoiceHtml` function.

**Validates: Requirements 10.3**

---

## Error Handling

| Scenario | Handling |
|---|---|
| `invoice.template` is absent or unrecognised | Fall back to `'classic'` in `renderInvoiceHtml` |
| `invoice.footerText` is absent or empty string | Omit footer section entirely from rendered HTML |
| `settings.defaultInvoiceTemplate` is absent | Invoice editor defaults to `'classic'` |
| `settings.defaultFooterText` is absent | Invoice editor leaves `footerText` empty |
| Batch export invoice missing `template` | Each invoice independently falls back to `'classic'` |

No new error toasts or user-facing error states are required — all failure modes degrade gracefully to the Classic template with no footer.

---

## Testing Strategy

### Unit Tests

Located in `src/shared/__tests__/invoice-html.test.ts` (new file).

Focus on:
- Specific examples: rendering a fully-populated invoice with each template and asserting key HTML fragments are present.
- Edge cases: empty `footerText`, missing `template`, all-empty invoice fields.
- Integration: `renderInvoiceHtml` dispatcher routes to the correct template function.

### Property-Based Tests

Located in `src/shared/__tests__/invoice-html.property.test.ts` (new file).

Uses **fast-check** (already available in the project's dev dependencies via vitest ecosystem; add if absent).

Each property test runs a minimum of **100 iterations**.

Tag format: `// Feature: invoice-templates-footer, Property N: <property text>`

| Property | Test description |
|---|---|
| P1: Template round-trip | Generate random invoice with random valid template; serialise/deserialise; assert template unchanged |
| P2: Unknown template fallback | Generate invoice with arbitrary non-valid template string; assert output equals classic output |
| P3: All templates render required fields | Generate random invoice data; render with each template; assert number, bill-to name, grand total present |
| P4: Footer present iff non-empty | Generate random invoice with random footerText (including empty); assert footer section presence matches non-emptiness |
| P5: Default template to new invoice | Generate random valid AppSettings.defaultInvoiceTemplate; assert new invoice inherits it |
| P6: Default footer to new invoice | Generate random non-empty defaultFooterText; assert new invoice footerText matches |
| P7: Footer edit does not mutate settings | Generate settings + invoice; mutate invoice.footerText; assert settings unchanged |
| P8: Modern header colour | Generate random invoice; render modern; assert dark header colour present |
| P9: Minimal greyscale only | Generate random invoice; render minimal; assert no out-of-palette colour values |
| P10: Preview/export parity | Generate random invoice + settings; assert generatePreviewHtml output equals generateInvoiceHtml output |

Both unit and property tests are run via `vitest --run`.
