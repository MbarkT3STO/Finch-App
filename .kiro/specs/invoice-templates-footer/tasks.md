# Tasks: Invoice Templates & Footer

## Task List

- [x] 1. Update shared types and constants
  - [x] 1.1 Add `template` and `footerText` optional fields to the `Invoice` interface in `src/shared/types.ts`
  - [x] 1.2 Add `defaultInvoiceTemplate` and `defaultFooterText` optional fields to the `AppSettings` interface in `src/shared/types.ts`
  - [x] 1.3 Add `defaultInvoiceTemplate: 'classic'` and `defaultFooterText: ''` to `DEFAULT_SETTINGS` in `src/shared/constants.ts`

- [x] 2. Create shared invoice HTML rendering module
  - [x] 2.1 Create `src/shared/invoice-html.ts` with the `InvoiceTemplate` type and shared helper utilities (`esc`, `addr`, `renderTotalsHtml`, `renderNotesHtml`, `renderFooterTextHtml`)
  - [x] 2.2 Implement `renderClassicHtml` in `src/shared/invoice-html.ts` by migrating the existing HTML/CSS from `pdf-template.ts`, adding `footerText` rendering
  - [x] 2.3 Implement `renderModernHtml` in `src/shared/invoice-html.ts` with dark header band, alternating row table, and contrasting grand-total row
  - [x] 2.4 Implement `renderMinimalHtml` in `src/shared/invoice-html.ts` with greyscale-only palette, no border-radius, no coloured badges, horizontal-rule section separators
  - [x] 2.5 Implement `renderInvoiceHtml` dispatcher in `src/shared/invoice-html.ts` that routes to the correct template function based on `invoice.template`, falling back to `'classic'`

- [x] 3. Update PDF generation in main process and renderer
  - [x] 3.1 Update `src/main/pdf-template.ts` — replace the existing `generateInvoiceHtml` body with a call to `renderInvoiceHtml` from `src/shared/invoice-html.ts`
  - [x] 3.2 Update `src/renderer/scripts/pdf-generator.ts` — replace the existing `generatePreviewHtml` body with a call to `renderInvoiceHtml` from `src/shared/invoice-html.ts`

- [x] 4. Update invoice editor UI
  - [x] 4.1 In `renderForm()` in `src/renderer/scripts/invoice-editor.ts`, add a Template Selector `<select>` control (Classic / Modern / Minimal) to the Invoice Details section, pre-selected from `invoice.template`
  - [x] 4.2 In `renderForm()`, add a Footer `<textarea>` field after the Terms & Conditions field, pre-populated from `invoice.footerText`
  - [x] 4.3 In `bindFormEvents()`, wire the template selector to update `invoice.template` and call `recalculate()` on change
  - [x] 4.4 In `bindFormEvents()`, wire the footer textarea to update `invoice.footerText` and call `recalculate()` on input
  - [x] 4.5 In `setupEditorEvents()`, initialise `invoice.template` from `settings.defaultInvoiceTemplate ?? 'classic'` for new invoices
  - [x] 4.6 In `setupEditorEvents()`, initialise `invoice.footerText` from `settings.defaultFooterText ?? ''` for new invoices

- [x] 5. Update settings UI
  - [x] 5.1 In `renderSettings()` in `src/renderer/scripts/settings.ts`, add a template selector `<select>` (Classic / Modern / Minimal) under the "Invoice Defaults" section, pre-selected from `s.defaultInvoiceTemplate`
  - [x] 5.2 In `renderSettings()`, add a "Default Invoice Footer" `<textarea>` under the "Invoice Defaults" section, pre-populated from `s.defaultFooterText`
  - [x] 5.3 In `saveSettings()`, include `defaultInvoiceTemplate` and `defaultFooterText` in the `partial` object passed to `window.finchAPI.settings.set`

- [x] 6. Write tests
  - [x] 6.1 Create `src/shared/__tests__/invoice-html.test.ts` with unit tests covering: each template renders key data fields, footer section present/absent based on footerText, unknown template falls back to classic, all three templates produce distinct HTML
  - [x] 6.2 Create `src/shared/__tests__/invoice-html.property.test.ts` with property-based tests using fast-check:
    - [x] 6.2.1 P1: Template field round-trip — serialise/deserialise invoice, assert template unchanged (Validates: Requirements 1.1, 5.1)
    - [x] 6.2.2 P2: Unknown template falls back to classic — arbitrary non-valid template string produces classic output (Validates: Requirements 1.7, 11.2)
    - [x] 6.2.3 P3: All templates render required fields — random invoice data rendered with each template contains number, bill-to name, grand total (Validates: Requirements 2.2, 3.6, 4.5)
    - [x] 6.2.4 P4: Footer present iff non-empty — random footerText; assert footer section presence matches non-emptiness (Validates: Requirements 7.6, 7.7)
    - [x] 6.2.5 P5: Default template applied to new invoices — random valid defaultInvoiceTemplate; assert new invoice inherits it (Validates: Requirements 6.3, 6.4)
    - [x] 6.2.6 P6: Default footer text applied to new invoices — random non-empty defaultFooterText; assert new invoice footerText matches (Validates: Requirements 9.3, 9.4)
    - [x] 6.2.7 P7: Footer edit does not mutate settings — mutate invoice.footerText; assert settings.defaultFooterText unchanged (Validates: Requirements 9.5)
    - [x] 6.2.8 P8: Modern template contains dark header — random invoice rendered with modern; assert dark header colour present (Validates: Requirements 3.2)
    - [x] 6.2.9 P9: Minimal template uses only greyscale — random invoice rendered with minimal; assert no out-of-palette colour values (Validates: Requirements 4.2, 4.3)
    - [x] 6.2.10 P10: Preview and export produce identical HTML — random invoice + settings; assert generatePreviewHtml equals generateInvoiceHtml output (Validates: Requirements 10.3)
