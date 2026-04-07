# Implementation Plan: Client Dashboard & Reports

## Overview

Implement financial visibility features across four areas: a home dashboard with revenue/activity summaries, a per-client invoice history panel, a reports view with charts and breakdowns, and an exportable tax summary. All data flows through the existing `window.finchAPI` IPC layer; no new main-process data services are required.

## Tasks

- [x] 1. Create shared aggregation utilities in `src/shared/utils.ts`
  - Add `aggregateRevenue(invoices, userId)` — sums `grandTotal` for `paid` invoices, excluding `cancelled`, scoped to `userId`
  - Add `aggregateOutstanding(invoices, userId)` — sums `grandTotal` for `unpaid` and `overdue` invoices, scoped to `userId`
  - Add `groupByMonth(invoices, year)` — returns a 12-element array of monthly revenue totals for `paid` invoices in the given year
  - Add `groupByYear(invoices)` — returns a map of year → revenue for all `paid` invoices
  - Add `taxSummaryByMonth(invoices, year)` — returns 12-element array of `{ invoiced, taxTotal, net }` for `paid` invoices
  - All functions must exclude `cancelled` invoices and filter by `userId`
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 1.1 Write property tests for aggregation utilities
    - **Property 1: Revenue excludes cancelled invoices** — for any invoice set, `aggregateRevenue` result equals sum of `grandTotal` where status is `paid` and status is not `cancelled`
    - **Property 2: Outstanding excludes cancelled invoices** — `aggregateOutstanding` never includes invoices with status `cancelled` or `paid`
    - **Property 3: Monthly grouping covers all 12 months** — `groupByMonth` always returns exactly 12 entries, zero-filled for months with no data
    - **Property 4: Yearly grouping consistency** — summing all values from `groupByYear` equals `aggregateRevenue` over all years
    - **Property 5: Tax summary net = invoiced − taxTotal** — for every month row, `net === invoiced - taxTotal`
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 5.3, 7.1**

- [x] 2. Add CSV export utility in `src/shared/utils.ts`
  - Add `toCSV(headers: string[], rows: string[][])` — serialises to RFC 4180-compliant CSV
  - Fields containing commas, double-quotes, or newlines must be double-quoted; internal double-quotes doubled
  - Always emits a header row as the first line
  - _Requirements: 8.3, 8.4_

  - [x] 2.1 Write property tests for CSV exporter
    - **Property 6: Round-trip integrity** — parsing the CSV output of `toCSV` back into rows produces a dataset equivalent to the input rows
    - **Property 7: Header always present** — every output of `toCSV` starts with the header row
    - **Property 8: Special-character escaping** — any field containing `,`, `"`, or `\n` is enclosed in double-quotes with internal quotes doubled
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [x] 3. Add IPC channel and handler for CSV file save
  - Add `CSV_SAVE` channel to `src/shared/constants.ts`
  - Add handler in `src/main/ipc-handlers.ts`: accepts `{ csv: string, defaultName: string }`, opens a native save dialog filtered to `.csv`, writes the file, returns `ApiResponse<string>` (file path)
  - If write fails, return error and ensure no partial file is left at the target path
  - Expose `csv: { save(data: { csv: string; defaultName: string }): Promise<ApiResponse<string>> }` in `src/preload/preload.ts` and add the type to `FinchAPI` in `src/shared/types.ts`
  - _Requirements: 7.4, 7.5, 7.6, 7.7_

- [x] 4. Implement Dashboard view in `src/renderer/scripts/dashboard.ts`
  - Create `initDashboard(container: HTMLElement, navigate: (r: string) => void)` following the same pattern as `initInvoiceList`
  - Render four metric cards: current-month revenue, total outstanding, overdue count, draft count — using `aggregateRevenue`, `aggregateOutstanding`, and status counts from `window.finchAPI.invoice.getAll()`
  - On Data_Service error, display an inline error message and show no metric values (no partial/stale data)
  - Render a "Recent Activity" list of the 5 most recently updated invoices (sorted by `updatedAt` desc), showing invoice number, client name, grand total, and status badge
  - Clicking a recent activity row navigates to `#/invoice/edit/{id}`
  - When fewer than 5 invoices exist, show all without padding rows
  - All data derived exclusively from `window.finchAPI.invoice.getAll()` — no network requests
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4_

  - [x] 4.1 Write unit tests for dashboard metric calculations
    - Test revenue card shows correct month-scoped total
    - Test error state renders inline message and hides metric values
    - Test recent activity list truncates to 5 and sorts by `updatedAt` desc
    - _Requirements: 1.1, 1.2, 1.5, 2.1_

- [x] 5. Register Dashboard route in `src/renderer/scripts/app.ts`
  - Import `initDashboard` and add a `#/dashboard` route case in `navigate()`
  - Change the default/initial route from `#/invoices` to `#/dashboard`
  - Add a "Dashboard" nav item in `src/renderer/index.html` with `data-route="#/dashboard"`
  - Update `updateNavHighlight` to handle the dashboard route
  - _Requirements: 1.1, 2.1_

- [x] 6. Implement Client History Panel inside `src/renderer/scripts/client-manager.ts`
  - When a client row is clicked (instead of edit/delete buttons), render a detail panel replacing the table, showing:
    - All invoices where `clientId === client.id`, sorted by `issueDate` desc
    - Each row: invoice number, issue date, due date, grand total, status badge
    - Summary row: total revenue (paid) and total outstanding (unpaid + overdue) for that client
    - Empty-state message when no invoices exist for the client
    - "New Invoice" button that navigates to `#/invoice/new` with the client pre-populated (pass client id via hash or state)
    - Clicking an invoice row navigates to `#/invoice/edit/{id}`
  - Add a "Back" button to return to the client list
  - Accept a `navigate` callback parameter in `initClientManager` (update call site in `app.ts`)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 6.1 Write unit tests for client history panel
    - Test invoices are filtered by `clientId` and sorted by `issueDate` desc
    - Test revenue and outstanding totals are correct
    - Test empty-state renders when no invoices match
    - _Requirements: 3.1, 3.3, 3.4, 3.7_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Reports view in `src/renderer/scripts/reports.ts`
  - Create `initReports(container: HTMLElement)` 
  - Render a year selector (dropdown populated from years present in invoice data, defaulting to current year)
  - Render a view toggle: "Monthly" / "Yearly"
  - Render a bar chart for revenue: monthly bars for selected year (monthly view) or yearly bars for all years (yearly view)
    - Chart rendered with `<canvas>` using the Canvas 2D API — no external charting library
    - Zero-value bars rendered for periods with no paid invoices (not omitted)
    - Chart updates within 300ms of year/view selection change
  - Render a Paid vs Unpaid breakdown section for the selected period:
    - Absolute currency values and percentages for paid and unpaid+overdue totals
    - When combined total is zero, display 0 values and 0% without dividing by zero
    - Updates within 300ms of period change
  - Render an Invoice Count Summary section: total issued, paid count, unpaid+overdue count, draft count for the selected period
    - Updates within 300ms of period change
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2_

  - [x] 8.1 Write unit tests for reports data transformations
    - Test monthly grouping produces 12 bars including zero-value months
    - Test paid vs unpaid percentages are correct and handle zero-total case
    - Test invoice count summary counts each status correctly
    - _Requirements: 4.4, 5.2, 5.3, 6.1_

- [x] 9. Implement Tax Summary section within the Reports view
  - Add a "Tax Summary" tab or section to `src/renderer/scripts/reports.ts`
  - Render a table with columns: Month, Total Invoiced, Tax Collected, Net Amount — for `paid` invoices in the selected year
  - Always show all 12 months; zero-fill months with no paid invoices
  - Render a totals row summing all monthly values
  - Updates within 300ms of year change
  - Add an "Export CSV" button that calls `toCSV` with the displayed table data and invokes `window.finchAPI.csv.save({ csv, defaultName: 'tax-summary-{year}.csv' })`
  - On save success, show a success toast; on failure, show an error toast with the reason
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 8.1, 8.2_

  - [x] 9.1 Write property test for tax summary CSV round-trip
    - **Property 9: CSV round-trip** — for any valid tax summary dataset, parsing the exported CSV back into rows produces a dataset equivalent to the original table rows
    - **Validates: Requirements 8.1, 8.2**

- [x] 10. Register Reports route in `src/renderer/scripts/app.ts`
  - Import `initReports` and add a `#/reports` route case in `navigate()`
  - Add a "Reports" nav item in `src/renderer/index.html` with `data-route="#/reports"`
  - Update `updateNavHighlight` to handle the reports route
  - _Requirements: 4.1, 7.1_

- [x] 11. Add CSS for new views in `src/renderer/styles/components.css`
  - Metric card styles (`.metric-card`, `.metric-value`, `.metric-label`)
  - Bar chart canvas container (`.chart-container`)
  - Tax summary table styles (`.tax-table`, `.tax-table .totals-row`)
  - Reuse existing design tokens (`--accent`, `--success`, `--warning`, `--danger`, `--border`, etc.)
  - _Requirements: 1.1, 4.1, 7.1_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
