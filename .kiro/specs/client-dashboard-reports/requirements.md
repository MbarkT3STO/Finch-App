# Requirements Document

## Introduction

This feature set adds financial visibility and client insight capabilities to the Finch Invoice desktop app. It covers four interconnected areas: a per-client invoice history panel, a home dashboard with revenue and activity summaries, a reports view with monthly/yearly charts and paid vs unpaid breakdowns, and an exportable tax summary for accounting purposes. All features operate fully offline using the existing local encrypted data store.

## Glossary

- **Dashboard**: The home view shown after login, summarising key financial metrics and recent activity.
- **Client_History_Panel**: A section within the client detail view listing all invoices associated with a specific client.
- **Reports_View**: A dedicated view presenting revenue charts and invoice status breakdowns over selectable time ranges.
- **Tax_Summary**: A structured report of tax collected per period, exportable as a CSV file.
- **Revenue**: The sum of `grandTotal` values for invoices with status `paid` within a given period.
- **Outstanding_Amount**: The sum of `grandTotal` values for invoices with status `unpaid` or `overdue`.
- **Overdue_Invoice**: An invoice whose `dueDate` is earlier than the current date and whose status is not `paid` or `cancelled`.
- **Period**: A calendar month or calendar year used as the time boundary for aggregation.
- **Data_Service**: The existing service layer (`data-service.ts`) that reads and writes invoice and client records from local encrypted storage.
- **Renderer**: The Electron renderer process running the UI (`app.ts` and related scripts).
- **CSV_Exporter**: The component responsible for serialising report data into RFC 4180-compliant CSV format and triggering a file-save dialog.
- **Chart**: A visual bar or line graph rendered in the Renderer without requiring a network connection.

---

## Requirements

### Requirement 1: Dashboard — Revenue Summary

**User Story:** As a freelancer, I want to see my total revenue, outstanding amounts, and overdue invoice count at a glance when I open the app, so that I understand my financial position without navigating away from the home screen.

#### Acceptance Criteria

1. WHEN the Dashboard is loaded, THE Renderer SHALL display the total revenue (sum of `grandTotal` for all `paid` invoices belonging to the current user) for the current calendar month.
2. WHEN the Dashboard is loaded, THE Renderer SHALL display the total outstanding amount (sum of `grandTotal` for all `unpaid` and `overdue` invoices belonging to the current user).
3. WHEN the Dashboard is loaded, THE Renderer SHALL display the count of Overdue_Invoices belonging to the current user.
4. WHEN the Dashboard is loaded, THE Renderer SHALL display the count of invoices with status `draft` belonging to the current user.
5. WHEN the Data_Service returns an error while loading dashboard metrics, THE Renderer SHALL display an inline error message and SHALL NOT display partial or stale metric values.
6. THE Dashboard SHALL derive all metric values exclusively from data returned by the Data_Service without making any network requests.

---

### Requirement 2: Dashboard — Recent Activity

**User Story:** As a freelancer, I want to see a list of my most recently created or updated invoices on the dashboard, so that I can quickly resume work or follow up on recent items.

#### Acceptance Criteria

1. WHEN the Dashboard is loaded, THE Renderer SHALL display the 5 most recently updated invoices, ordered by `updatedAt` descending.
2. THE Renderer SHALL show the invoice number, client name, grand total, and status badge for each item in the recent activity list.
3. WHEN a user clicks a recent activity item, THE Renderer SHALL navigate to the invoice editor for that invoice.
4. WHEN there are fewer than 5 invoices, THE Renderer SHALL display all available invoices in the recent activity list without padding or placeholder rows.

---

### Requirement 3: Client Invoice History

**User Story:** As a freelancer, I want to view all invoices associated with a specific client from the client page, so that I can review billing history and outstanding balances per client without manually filtering the invoice list.

#### Acceptance Criteria

1. WHEN a user selects a client from the client list, THE Renderer SHALL display a Client_History_Panel showing all invoices where `clientId` matches the selected client's `id`.
2. THE Client_History_Panel SHALL display each invoice's number, issue date, due date, grand total, and status badge.
3. THE Client_History_Panel SHALL display the total revenue (sum of `grandTotal` for `paid` invoices) and total outstanding amount (sum of `grandTotal` for `unpaid` and `overdue` invoices) for that client.
4. WHEN the Client_History_Panel contains no invoices for the selected client, THE Renderer SHALL display an empty-state message indicating no invoices exist for that client.
5. WHEN a user clicks an invoice row in the Client_History_Panel, THE Renderer SHALL navigate to the invoice editor for that invoice.
6. WHEN a user clicks "New Invoice" within the Client_History_Panel, THE Renderer SHALL navigate to the invoice editor with the client pre-populated in the `billTo` field.
7. THE Client_History_Panel SHALL sort invoices by `issueDate` descending by default.

---

### Requirement 4: Reports — Revenue Chart

**User Story:** As a freelancer, I want to see a monthly or yearly revenue chart, so that I can identify trends in my income over time.

#### Acceptance Criteria

1. WHEN the Reports_View is loaded, THE Renderer SHALL display a bar Chart showing total revenue (sum of `grandTotal` for `paid` invoices) grouped by calendar month for the current calendar year.
2. WHEN a user selects a different year from the year selector, THE Renderer SHALL update the Chart to show monthly revenue for the selected year within 300ms of the selection.
3. WHEN a user switches to the yearly view, THE Renderer SHALL display a bar Chart showing total revenue grouped by calendar year, covering all years for which invoice data exists.
4. WHEN a month or year has no paid invoices, THE Renderer SHALL render that period's bar with a value of zero rather than omitting the period.
5. THE Chart SHALL be rendered entirely within the Renderer process without requiring a network connection or external charting service.

---

### Requirement 5: Reports — Paid vs Unpaid Breakdown

**User Story:** As a freelancer, I want to see a breakdown of paid versus unpaid invoice amounts for a selected period, so that I can understand what proportion of my billed work has been collected.

#### Acceptance Criteria

1. WHEN the Reports_View is loaded, THE Renderer SHALL display the total amount for `paid` invoices and the total amount for `unpaid` and `overdue` invoices for the currently selected Period.
2. THE Renderer SHALL display the paid and unpaid totals as both absolute currency values and as percentages of the combined total.
3. WHEN the combined total of paid and unpaid invoices is zero for the selected Period, THE Renderer SHALL display zero values and 0% for both categories without dividing by zero.
4. WHEN a user changes the selected Period, THE Renderer SHALL update the paid vs unpaid breakdown within 300ms of the selection change.

---

### Requirement 6: Reports — Invoice Count Summary

**User Story:** As a freelancer, I want to see how many invoices I issued, how many were paid, and how many are outstanding for a selected period, so that I can track my invoicing activity.

#### Acceptance Criteria

1. WHEN the Reports_View is loaded, THE Renderer SHALL display the total number of invoices issued, the number with status `paid`, the number with status `unpaid` or `overdue`, and the number with status `draft` for the selected Period.
2. WHEN a user changes the selected Period, THE Renderer SHALL update the invoice count summary within 300ms of the selection change.

---

### Requirement 7: Tax Summary Report

**User Story:** As a freelancer, I want to generate a tax summary showing the tax collected per period, so that I can provide accurate figures to my accountant or complete my tax return.

#### Acceptance Criteria

1. WHEN a user opens the Tax Summary section, THE Renderer SHALL display a table listing each calendar month in the selected year with columns for: total invoiced amount, total tax collected (`taxTotal`), and net amount (invoiced minus tax), restricted to `paid` invoices.
2. THE Renderer SHALL display a totals row at the bottom of the tax summary table summing all monthly values.
3. WHEN a user selects a different year, THE Renderer SHALL update the tax summary table to reflect data for the selected year within 300ms.
4. WHEN a user clicks "Export CSV", THE CSV_Exporter SHALL serialise the currently displayed tax summary table into a valid RFC 4180-compliant CSV file.
5. WHEN the CSV_Exporter produces a CSV file, THE Renderer SHALL open a native file-save dialog allowing the user to choose the save location and filename.
6. WHEN the file-save dialog is confirmed, THE CSV_Exporter SHALL write the CSV file to the chosen path and SHALL notify the user with a success message upon completion.
7. IF the file write operation fails, THEN THE CSV_Exporter SHALL display an error message containing the reason for failure and SHALL NOT leave a partial file at the target path.
8. WHEN a year has no paid invoices, THE Renderer SHALL display all 12 months with zero values rather than an empty table.

---

### Requirement 8: CSV Round-Trip Integrity

**User Story:** As a freelancer, I want the exported CSV to accurately represent the data shown on screen, so that I can trust the exported file for accounting purposes.

#### Acceptance Criteria

1. THE CSV_Exporter SHALL produce a CSV where each data row corresponds exactly to one row in the tax summary table displayed in the Renderer at the time of export.
2. FOR ALL valid tax summary datasets, parsing the exported CSV back into a structured table SHALL produce a dataset equivalent to the original displayed data (round-trip property).
3. THE CSV_Exporter SHALL include a header row as the first line of every exported file.
4. THE CSV_Exporter SHALL enclose any field value containing a comma, double-quote, or newline character in double-quotes, and SHALL escape internal double-quotes by doubling them.

---

### Requirement 9: Data Aggregation Correctness

**User Story:** As a freelancer, I want all financial totals to be calculated consistently and accurately, so that I can rely on the numbers shown across the dashboard, reports, and tax summary.

#### Acceptance Criteria

1. THE Renderer SHALL calculate all monetary aggregations using the `grandTotal`, `taxTotal`, and `subtotal` fields stored on each Invoice record, without re-deriving them from line items at display time.
2. WHEN the same set of invoices is used to compute revenue on the Dashboard and in the Reports_View for the same Period, THE Renderer SHALL produce identical totals in both views.
3. THE Renderer SHALL restrict all aggregations to invoices whose `userId` matches the currently authenticated user's id.
4. WHEN an invoice has status `cancelled`, THE Renderer SHALL exclude it from all revenue, outstanding, and tax aggregations.
