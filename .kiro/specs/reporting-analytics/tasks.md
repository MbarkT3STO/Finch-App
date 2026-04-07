# Tasks — Reporting & Analytics

## Task List

- [x] 1. Shared types and constants
  - [x] 1.1 Add `Expense`, `ForecastResult`, `ForecastPeriod`, `TaxSummaryRow`, `TaxSummary` types to `src/shared/types.ts`
  - [x] 1.2 Add `expense.*` and `report.*` namespaces to `FinchAPI` interface in `src/shared/types.ts`
  - [x] 1.3 Add `EXPENSE_CREATE`, `EXPENSE_UPDATE`, `EXPENSE_DELETE`, `EXPENSE_GET_ALL`, `REPORT_EXPORT_CSV`, `REPORT_EXPORT_PDF` to `IPC_CHANNELS` in `src/shared/constants.ts`

- [x] 2. Revenue Forecasting — pure function
  - [x] 2.1 Create `src/shared/forecast-engine.ts` implementing `forecastRevenue(invoices: Invoice[], referenceDate: Date): ForecastResult[]`
  - [x] 2.2 Write unit tests in `src/shared/__tests__/forecast-engine.test.ts` (empty array, single invoice, year-boundary cases)
  - [x] 2.3 Write property tests in `src/shared/__tests__/forecast-engine.property.test.ts` for Property 1 (output shape) and Property 2 (average correctness)

- [x] 3. Tax Report Generator — pure function
  - [x] 3.1 Create `src/shared/tax-report-generator.ts` implementing `buildTaxSummary(invoices: Invoice[], year: number): TaxSummary`
  - [x] 3.2 Write unit tests in `src/shared/__tests__/tax-report-generator.test.ts` (mixed statuses, year boundary, all-zero year)
  - [x] 3.3 Write property tests in `src/shared/__tests__/tax-report-generator.property.test.ts` for Property 7 (tax aggregation invariant) and Property 8 (only paid invoices)

- [x] 4. Theme Resolver — pure function
  - [x] 4.1 Create `src/shared/theme-resolver.ts` implementing `resolveTheme(theme: AppSettings['theme'], systemIsDark: boolean): 'light' | 'dark'`
  - [x] 4.2 Write unit tests in `src/shared/__tests__/theme-resolver.test.ts` for the `'system'` + `true`/`false` examples (Req 4.8, 4.9)
  - [x] 4.3 Write property tests in `src/shared/__tests__/theme-resolver.property.test.ts` for Property 9 (determinism, light/dark passthrough)

- [x] 5. Dark Mode PDF — invoice-html.ts and pdf-template.ts
  - [x] 5.1 Add optional `resolvedTheme?: 'light' | 'dark'` parameter to `renderClassicHtml`, `renderModernHtml`, `renderMinimalHtml`, and `renderInvoiceHtml` in `src/shared/invoice-html.ts`
  - [x] 5.2 Inject dark-mode CSS overrides (dark background, light text, adjusted borders) when `resolvedTheme === 'dark'`
  - [x] 5.3 Invert the modern template header from dark to light when `resolvedTheme === 'dark'` (Req 4.11)
  - [x] 5.4 Update `generateInvoiceHtml` in `src/main/pdf-template.ts` to accept and forward `resolvedTheme`
  - [x] 5.5 Add property test to `src/shared/__tests__/invoice-html.property.test.ts` for Property 10 (modern template dark header inversion)

- [x] 6. Expense Store — persistence layer
  - [x] 6.1 Create `src/services/expense-store.ts` with `createExpense`, `updateExpense`, `deleteExpense`, `getAllExpenses` scoped by `userId`
  - [x] 6.2 Write unit tests in `src/services/__tests__/expense-store.test.ts` (CRUD lifecycle, user isolation)
  - [x] 6.3 Write property tests in `src/services/__tests__/expense-store.property.test.ts` for Properties 3, 4, 5, and 6

- [x] 7. IPC handlers — main process
  - [x] 7.1 Register `expense:create`, `expense:update`, `expense:delete`, `expense:get-all` handlers in `src/main/ipc-handlers.ts` delegating to `expense-store.ts`
  - [x] 7.2 Register `report:export-csv` handler (delegates to existing `csv:save` logic)
  - [x] 7.3 Register `report:export-pdf` handler: calls `resolveTheme` with `nativeTheme.shouldUseDarkColors`, renders HTML to PDF via hidden `BrowserWindow`, shows save dialog
  - [x] 7.4 Update existing `pdf:export` and `pdf:export-batch` handlers to pass `resolvedTheme` to `generateInvoiceHtml`

- [x] 8. Preload bridge
  - [x] 8.1 Expose `expense.*` namespace in `src/preload/preload.ts` via `contextBridge`
  - [x] 8.2 Expose `report.*` namespace in `src/preload/preload.ts` via `contextBridge`

- [x] 9. Reports renderer — UI integration
  - [x] 9.1 Import and call `forecastRevenue()` in `reports.ts`; append 3 forecast bars in a distinct colour to the existing monthly chart
  - [x] 9.2 Add Expense section to `reports.ts`: add/edit form with inline validation, expense list, delete buttons
  - [x] 9.3 Add Profit/Loss table to `reports.ts` showing revenue, expenses, and net per month for the selected year
  - [x] 9.4 Replace the existing inline CSV export button with an "Export Tax Report" dropdown offering CSV (via `report.exportCsv`) and PDF (via `report.exportPdf`) options
  - [x] 9.5 Wire success/error toasts and "Show in Folder" offer after export completes
