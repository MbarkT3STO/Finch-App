# Requirements Document

## Introduction

The Reporting & Analytics feature extends Finch Invoice's existing reports view with four bundled capabilities:

1. **Revenue Forecasting** — project future income based on recurring invoice patterns
2. **Expense Tracking** — record and track costs alongside revenue to produce a profit/loss view
3. **Tax Report Export** — generate a tax-ready summary exportable as PDF or CSV
4. **Dark Mode PDF Export** — honour the app's active theme (light / dark / system) when generating exported PDFs

All capabilities are offline-first and operate entirely within the Electron desktop app. They extend the existing `reports.ts` renderer, `pdf-template.ts` / `invoice-html.ts` PDF pipeline, and `AppSettings` (which already carries `theme: 'light' | 'dark' | 'system'`).

---

## Glossary

- **Forecast_Engine**: The shared utility (in `src/shared/`) responsible for projecting future revenue from invoice history.
- **Expense_Store**: The persistence layer (via `StorageService`) that stores and retrieves `Expense` records for the authenticated user.
- **Expense_Tracker**: The renderer-side module that manages expense entry, editing, deletion, and the profit/loss view.
- **Tax_Report_Generator**: The shared utility that aggregates paid invoices into a tax-ready summary structure.
- **Report_Exporter**: The main-process handler that serialises a tax summary to PDF or CSV and saves it to disk.
- **Theme_Resolver**: The shared utility that maps `AppSettings.theme` (`'light' | 'dark' | 'system'`) to a concrete `'light' | 'dark'` value using the OS preference when `'system'` is selected.
- **PDF_Renderer**: The existing main-process component (`pdf-template.ts` / `invoice-html.ts`) that generates HTML and converts it to PDF via Electron's `webContents.printToPDF`.
- **Reports_View**: The existing renderer view (`reports.ts`) that hosts all reporting UI.
- **Expense**: A user-defined cost record with at minimum: `id`, `userId`, `date` (ISO 8601), `amount` (number ≥ 0), `category` (string), and `description` (string).
- **Forecast_Period**: A future calendar month expressed as `YYYY-MM`.
- **Tax_Summary**: An aggregated structure containing, per calendar month: total invoiced, tax collected, and net amount, plus annual totals — derived exclusively from invoices with `status === 'paid'`.
- **Profit_Loss_Row**: A per-month record containing: revenue (paid invoices), total expenses, and net profit/loss.

---

## Requirements

### Requirement 1: Revenue Forecasting

**User Story:** As a freelancer, I want to see projected income for upcoming months based on my recurring invoice history, so that I can plan my cash flow.

#### Acceptance Criteria

1. WHEN the Reports_View is opened, THE Forecast_Engine SHALL compute a revenue forecast for the next 3 calendar months using the average monthly paid revenue from the most recent 6 months of invoice history.
2. WHEN fewer than 1 paid invoice exists in the trailing 6-month window, THE Forecast_Engine SHALL return a forecast of `0` for each Forecast_Period rather than producing an error.
3. THE Reports_View SHALL display the 3-month forecast as a labelled bar or line chart segment visually distinct from historical revenue bars.
4. WHEN the user selects a different year in the existing year filter, THE Reports_View SHALL recalculate the forecast baseline using the 6 months immediately preceding the selected year's end.
5. THE Forecast_Engine SHALL expose a pure function `forecastRevenue(invoices: Invoice[], referenceDate: Date): ForecastResult[]` in `src/shared/` so that it can be unit-tested independently of the UI.
6. WHEN `forecastRevenue` is called with any array of paid invoices and any valid reference date, THE Forecast_Engine SHALL return exactly 3 `ForecastResult` items each containing a `period` (Forecast_Period string) and a non-negative `amount`.

### Requirement 2: Expense Tracking

**User Story:** As a freelancer, I want to record business expenses and see them alongside my revenue, so that I can understand my actual profit or loss each month.

#### Acceptance Criteria

1. THE Reports_View SHALL provide a UI section for adding, editing, and deleting Expense records for the authenticated user.
2. WHEN the user submits a new expense with a valid `date`, `amount` ≥ 0, non-empty `category`, and non-empty `description`, THE Expense_Tracker SHALL persist the Expense via `Expense_Store` and display it in the expense list without requiring a page reload.
3. IF the user submits an expense with a missing `date`, negative `amount`, empty `category`, or empty `description`, THEN THE Expense_Tracker SHALL display an inline validation error and SHALL NOT persist the record.
4. WHEN the user deletes an expense, THE Expense_Tracker SHALL remove the record from `Expense_Store` and update the expense list and profit/loss view immediately.
5. THE Reports_View SHALL display a Profit_Loss_Row table showing, for each month of the selected year: revenue (sum of paid invoice `grandTotal`), total expenses, and net (revenue minus expenses).
6. WHEN no expenses exist for a given month, THE Reports_View SHALL display `$0.00` for expenses and show net equal to revenue for that month.
7. THE Expense_Store SHALL scope all expense reads and writes to the authenticated user's `userId` so that expenses from different users are never mixed.
8. WHEN the app is restarted, THE Expense_Store SHALL reload all previously saved expenses for the authenticated user without data loss.

### Requirement 3: Tax Report Export

**User Story:** As a freelancer, I want to export a tax-ready summary of my invoiced amounts and tax collected, so that I can file taxes or share the report with my accountant.

#### Acceptance Criteria

1. THE Reports_View SHALL provide an "Export Tax Report" action that allows the user to choose between PDF and CSV output formats.
2. WHEN the user selects CSV export, THE Report_Exporter SHALL produce an RFC 4180-compliant CSV file containing one row per calendar month with columns: Month, Total Invoiced, Tax Collected, Net Amount, and an annual totals row — using only invoices with `status === 'paid'` for the selected year.
3. WHEN the user selects PDF export, THE Report_Exporter SHALL produce a PDF file containing the same Tax_Summary data as the CSV, formatted for print with the business name, selected year, and generation date in the header.
4. IF the file-save dialog is cancelled by the user, THEN THE Report_Exporter SHALL take no action and SHALL NOT display an error.
5. WHEN a CSV or PDF export completes successfully, THE Reports_View SHALL display a success toast and offer to reveal the saved file in the OS file manager.
6. IF an error occurs during export, THEN THE Report_Exporter SHALL return a descriptive error message and THE Reports_View SHALL display it as an error toast.
7. THE Tax_Report_Generator SHALL expose a pure function `buildTaxSummary(invoices: Invoice[], year: number): TaxSummary` in `src/shared/` that is independently testable.
8. FOR ALL arrays of paid invoices for a given year, the sum of all monthly `taxTotal` values in the `TaxSummary` returned by `buildTaxSummary` SHALL equal the sum of `invoice.taxTotal` across all paid invoices in that year (aggregation invariant).
9. THE Report_Exporter SHALL use the existing `toCSV` utility from `src/shared/utils.ts` for CSV serialisation.

### Requirement 4: Dark Mode PDF Export

**User Story:** As a user who works in dark mode, I want exported PDFs to reflect the app's current theme, so that the PDF matches my visual environment and branding preference.

#### Acceptance Criteria

1. WHEN a PDF is exported (invoice or tax report) and `AppSettings.theme` is `'dark'`, THE PDF_Renderer SHALL apply a dark colour palette (dark background, light text) to the generated HTML before conversion.
2. WHEN a PDF is exported and `AppSettings.theme` is `'light'`, THE PDF_Renderer SHALL apply the existing light colour palette (unchanged from current behaviour).
3. WHEN a PDF is exported and `AppSettings.theme` is `'system'`, THE Theme_Resolver SHALL read the OS-level `prefers-color-scheme` preference via Electron's `nativeTheme.shouldUseDarkColors` and THE PDF_Renderer SHALL apply the resolved theme.
4. THE Theme_Resolver SHALL expose a pure function `resolveTheme(theme: AppSettings['theme'], systemIsDark: boolean): 'light' | 'dark'` in `src/shared/` so that it can be unit-tested without Electron APIs.
5. FOR ALL valid inputs `(theme, systemIsDark)`, `resolveTheme` called twice with the same arguments SHALL return the same value (idempotence).
6. WHEN `resolveTheme` is called with `theme === 'light'`, THE Theme_Resolver SHALL return `'light'` regardless of the value of `systemIsDark`.
7. WHEN `resolveTheme` is called with `theme === 'dark'`, THE Theme_Resolver SHALL return `'dark'` regardless of the value of `systemIsDark`.
8. WHEN `resolveTheme` is called with `theme === 'system'` and `systemIsDark` is `true`, THE Theme_Resolver SHALL return `'dark'`.
9. WHEN `resolveTheme` is called with `theme === 'system'` and `systemIsDark` is `false`, THE Theme_Resolver SHALL return `'light'`.
10. THE PDF_Renderer SHALL accept an optional `resolvedTheme: 'light' | 'dark'` parameter in the HTML generation function so that dark-mode styles can be injected without altering the existing light-mode output when `resolvedTheme` is `'light'`.
11. WHERE the invoice template is `'modern'`, THE PDF_Renderer SHALL invert the dark header background to a light equivalent when `resolvedTheme` is `'dark'` to maintain legibility.
