# Requirements Document

## Introduction

This feature adds two related capabilities to the Finch Invoice desktop app:

1. **Invoice PDF Templates** — users can choose from multiple visual themes (Classic, Modern, Minimal) that control how the exported PDF is rendered. The selected template is stored per-invoice so different invoices can use different styles.

2. **Custom Invoice Footer** — users can add a configurable footer text field to each individual invoice (e.g. payment terms, bank details, thank-you messages). This is a per-invoice field stored on the `Invoice` record, distinct from the global `notes` and `terms` fields.

Both capabilities extend the existing `Invoice` type, the `pdf-template.ts` HTML generator, and the invoice editor UI.

---

## Glossary

- **Invoice_Editor**: The renderer-side UI component in `invoice-editor.ts` responsible for creating and editing invoices.
- **PDF_Generator**: The main-process module in `pdf-template.ts` that produces the HTML string rendered into a PDF via Electron's `printToPDF`.
- **Template**: A named visual style (Classic, Modern, or Minimal) that determines the layout, typography, colour palette, and spacing of the generated PDF.
- **Footer_Text**: A free-form text field stored on an individual invoice, rendered at the bottom of the PDF output below notes and terms.
- **Template_Selector**: The UI control in the Invoice_Editor that allows the user to choose a Template for the current invoice.
- **AppSettings**: The global settings object persisted per user, containing invoice defaults and business details.
- **Invoice**: The data record as defined in `src/shared/types.ts`, extended by this feature with `template` and `footerText` fields.
- **Preview_Iframe**: The live-preview `<iframe>` in the Invoice_Editor that reflects changes in real time.

---

## Requirements

### Requirement 1: Invoice Template Selection

**User Story:** As a freelancer, I want to choose a visual template for each invoice, so that I can match the invoice style to my brand or client expectations.

#### Acceptance Criteria

1. THE Invoice type SHALL include a `template` field of type `'classic' | 'modern' | 'minimal'` with a default value of `'classic'`.
2. THE Invoice_Editor SHALL display a Template_Selector control that presents the three available templates: Classic, Modern, and Minimal.
3. WHEN the user selects a template in the Template_Selector, THE Invoice_Editor SHALL update the invoice's `template` field and refresh the Preview_Iframe within 300 milliseconds.
4. WHEN an invoice is loaded for editing, THE Template_Selector SHALL reflect the template value stored on that invoice.
5. WHEN a new invoice is created, THE Invoice_Editor SHALL set the `template` field to `'classic'` by default.
6. THE PDF_Generator SHALL accept the invoice's `template` field and render the PDF using the corresponding template layout.
7. WHEN the `template` field is absent or unrecognised, THE PDF_Generator SHALL fall back to the `'classic'` template.

---

### Requirement 2: Classic Template

**User Story:** As a user, I want a Classic template, so that I can produce a traditional, professional-looking invoice.

#### Acceptance Criteria

1. WHEN the invoice `template` is `'classic'`, THE PDF_Generator SHALL render the invoice using the existing single-template layout (the current design in `pdf-template.ts`), preserving all existing visual behaviour.
2. THE Classic template SHALL display the business logo, invoice number, status badge, bill-from/bill-to addresses, date block, line-items table, totals section, notes, terms, footer text, and page footer.

---

### Requirement 3: Modern Template

**User Story:** As a user, I want a Modern template, so that I can produce a bold, contemporary invoice with strong visual hierarchy.

#### Acceptance Criteria

1. WHEN the invoice `template` is `'modern'`, THE PDF_Generator SHALL render the invoice using a Modern layout distinct from the Classic layout.
2. THE Modern template SHALL use a full-width dark header band containing the business name, logo, and invoice number.
3. THE Modern template SHALL render bill-from and bill-to address blocks in a two-column layout below the header.
4. THE Modern template SHALL render the line-items table with alternating row background colours.
5. THE Modern template SHALL render the totals block with a visually distinct grand-total row using a contrasting background colour.
6. THE Modern template SHALL display all the same invoice data fields as the Classic template (logo, number, status, addresses, dates, line items, totals, notes, terms, footer text, page footer).

---

### Requirement 4: Minimal Template

**User Story:** As a user, I want a Minimal template, so that I can produce a clean, whitespace-focused invoice with no decorative elements.

#### Acceptance Criteria

1. WHEN the invoice `template` is `'minimal'`, THE PDF_Generator SHALL render the invoice using a Minimal layout distinct from the Classic and Modern layouts.
2. THE Minimal template SHALL use only black, white, and one shade of grey for all colours.
3. THE Minimal template SHALL use no background colour bands, no border-radius decorations, and no coloured badges.
4. THE Minimal template SHALL separate sections using thin horizontal rules only.
5. THE Minimal template SHALL display all the same invoice data fields as the Classic template (logo, number, status, addresses, dates, line items, totals, notes, terms, footer text, page footer).

---

### Requirement 5: Template Persistence

**User Story:** As a user, I want my template choice to be saved with the invoice, so that re-opening or re-exporting an invoice always uses the same template I originally chose.

#### Acceptance Criteria

1. WHEN an invoice is saved, THE Invoice_Editor SHALL include the `template` field value in the data passed to `window.finchAPI.invoice.create` or `window.finchAPI.invoice.update`.
2. WHEN an invoice is duplicated, THE duplicated invoice SHALL inherit the `template` field value of the source invoice.
3. THE PDF_Generator SHALL read the `template` field from the invoice record at export time and render the correct template without requiring any additional input from the user.

---

### Requirement 6: Default Template Setting

**User Story:** As a user, I want to configure a default template in Settings, so that all new invoices start with my preferred style without manual selection each time.

#### Acceptance Criteria

1. THE AppSettings type SHALL include a `defaultInvoiceTemplate` field of type `'classic' | 'modern' | 'minimal'` with a default value of `'classic'`.
2. THE Settings UI SHALL display a template selector control under the "Invoice Defaults" section allowing the user to choose the default template.
3. WHEN a new invoice is created, THE Invoice_Editor SHALL set the invoice's `template` field to the value of `AppSettings.defaultInvoiceTemplate`.
4. WHEN `AppSettings.defaultInvoiceTemplate` is absent or unrecognised, THE Invoice_Editor SHALL default to `'classic'`.

---

### Requirement 7: Custom Invoice Footer Text

**User Story:** As a freelancer, I want to add a custom footer text to each invoice, so that I can include payment instructions, bank details, or a personalised message specific to that invoice.

#### Acceptance Criteria

1. THE Invoice type SHALL include a `footerText` optional field of type `string`.
2. THE Invoice_Editor SHALL display a "Footer" textarea input in the invoice form, positioned after the "Terms & Conditions" field.
3. WHEN the user types in the Footer textarea, THE Invoice_Editor SHALL update the invoice's `footerText` field and refresh the Preview_Iframe within 300 milliseconds.
4. WHEN an invoice is loaded for editing, THE Footer textarea SHALL be pre-populated with the `footerText` value stored on that invoice.
5. WHEN a new invoice is created, THE Footer textarea SHALL be empty by default.
6. THE PDF_Generator SHALL render the `footerText` value in a dedicated footer section at the bottom of the invoice, below the notes and terms sections.
7. WHEN `footerText` is empty or absent, THE PDF_Generator SHALL omit the footer section from the rendered output entirely.
8. THE Footer section in the PDF SHALL be visually separated from the notes and terms sections by a horizontal rule.

---

### Requirement 8: Footer Text Persistence

**User Story:** As a user, I want the footer text to be saved with the invoice, so that it is preserved across sessions and re-exports.

#### Acceptance Criteria

1. WHEN an invoice is saved, THE Invoice_Editor SHALL include the `footerText` field value in the data passed to `window.finchAPI.invoice.create` or `window.finchAPI.invoice.update`.
2. WHEN an invoice is duplicated, THE duplicated invoice SHALL inherit the `footerText` value of the source invoice.
3. WHEN an invoice is exported to PDF, THE PDF_Generator SHALL read `footerText` from the stored invoice record.

---

### Requirement 9: Default Footer Text Setting

**User Story:** As a user, I want to set a default footer text in Settings, so that new invoices are pre-filled with my standard payment instructions without retyping them each time.

#### Acceptance Criteria

1. THE AppSettings type SHALL include a `defaultFooterText` optional field of type `string`.
2. THE Settings UI SHALL display a "Default Invoice Footer" textarea under the "Invoice Defaults" section.
3. WHEN a new invoice is created, THE Invoice_Editor SHALL pre-populate the `footerText` field with the value of `AppSettings.defaultFooterText`.
4. WHEN `AppSettings.defaultFooterText` is absent or empty, THE Invoice_Editor SHALL leave the `footerText` field empty for new invoices.
5. WHEN the user edits the Footer textarea on a specific invoice, THE change SHALL affect only that invoice and SHALL NOT modify `AppSettings.defaultFooterText`.

---

### Requirement 10: Live Preview Reflects Template and Footer

**User Story:** As a user, I want the live preview to update immediately when I change the template or footer text, so that I can see exactly how the PDF will look before exporting.

#### Acceptance Criteria

1. WHEN the user changes the Template_Selector value, THE Preview_Iframe SHALL re-render using the newly selected template within 300 milliseconds.
2. WHEN the user types in the Footer textarea, THE Preview_Iframe SHALL re-render with the updated footer text within 300 milliseconds (subject to the existing 300 ms debounce).
3. THE preview HTML used in the Preview_Iframe SHALL be generated by the same template-aware rendering logic used for PDF export, ensuring visual consistency between preview and output.

---

### Requirement 11: Batch PDF Export Respects Template

**User Story:** As a user, I want batch PDF exports to use each invoice's saved template, so that bulk exports produce correctly styled PDFs without manual intervention.

#### Acceptance Criteria

1. WHEN a batch PDF export is triggered via `window.finchAPI.pdf.exportBatch`, THE PDF_Generator SHALL render each invoice using its own stored `template` field value.
2. IF an invoice in the batch has no `template` field, THEN THE PDF_Generator SHALL render that invoice using the `'classic'` template.
