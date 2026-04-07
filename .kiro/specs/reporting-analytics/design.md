# Design Document — Reporting & Analytics

## Overview

This feature adds four capabilities to the existing Reports view of Finch Invoice, an offline-first Electron desktop app:

1. **Revenue Forecasting** — a pure `forecastRevenue()` function in `src/shared/` projects the next 3 calendar months of income from the trailing 6-month paid-invoice average, rendered as a visually distinct chart segment in `reports.ts`.
2. **Expense Tracking** — a new `Expense` type, a `StorageService`-backed `Expense_Store` (mirroring how `data-service.ts` handles invoices), IPC channels for CRUD, and a renderer UI section in `reports.ts` that shows a Profit/Loss table.
3. **Tax Report Export** — a pure `buildTaxSummary()` function in `src/shared/` aggregates paid invoices into a `TaxSummary`, with new IPC channels for PDF and CSV export wired through the existing `pdf-template.ts` / `toCSV` pipeline.
4. **Dark Mode PDF Export** — a pure `resolveTheme()` function in `src/shared/` maps `AppSettings.theme` + `nativeTheme.shouldUseDarkColors` to a concrete `'light' | 'dark'` value; `renderInvoiceHtml()` gains an optional `resolvedTheme` parameter that injects dark-mode CSS overrides.

All changes are additive. No existing interfaces are broken; existing light-mode PDF output is unchanged when `resolvedTheme` is `'light'` or omitted.

---

## Architecture

```mermaid
graph TD
  subgraph Renderer
    RT[reports.ts]
  end

  subgraph Shared
    FE[forecast-engine.ts\nforecastRevenue()]
    TRG[tax-report-generator.ts\nbuildTaxSummary()]
    TR[theme-resolver.ts\nresolveTheme()]
    IH[invoice-html.ts\nrenderInvoiceHtml(resolvedTheme)]
    UT[utils.ts\ntoCSV / groupByMonth / taxSummaryByMonth]
    TY[types.ts\nExpense / ForecastResult / TaxSummary]
  end

  subgraph Main
    IPC[ipc-handlers.ts]
    PT[pdf-template.ts]
    DS[data-service.ts + expense-store.ts]
    SS[storage-service.ts]
    NT[nativeTheme]
  end

  RT -->|IPC: expense:*| IPC
  RT -->|IPC: report:export-csv / report:export-pdf| IPC
  RT -->|IPC: pdf:export (existing)| IPC
  IPC --> DS
  IPC --> SS
  IPC --> PT
  IPC --> NT
  PT --> IH
  IH --> TR
  RT --> FE
  RT --> TRG
  RT --> UT
```

The renderer calls `forecastRevenue()` and `buildTaxSummary()` directly (they are pure functions with no Electron dependency). Expense persistence and report export go through IPC as usual.

---

## Components and Interfaces

### 1. `src/shared/types.ts` — new types

```ts
export interface Expense {
  id: string;
  userId: string;
  date: string;          // ISO 8601 date (YYYY-MM-DD)
  amount: number;        // >= 0
  category: string;      // non-empty
  description: string;   // non-empty
  createdAt: string;
  updatedAt: string;
}

export type ForecastPeriod = string; // "YYYY-MM"

export interface ForecastResult {
  period: ForecastPeriod;
  amount: number;        // >= 0
}

export interface TaxSummaryRow {
  month: number;         // 1-12
  label: string;         // "Jan" … "Dec"
  totalInvoiced: number;
  taxTotal: number;
  net: number;
}

export interface TaxSummary {
  year: number;
  rows: TaxSummaryRow[];
  annualTotalInvoiced: number;
  annualTaxTotal: number;
  annualNet: number;
}
```

`FinchAPI` gains three new namespaces (added to `src/shared/types.ts` and mirrored in `src/preload/preload.ts`):

```ts
expense: {
  create(data: Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Expense>>;
  update(data: { id: string; expense: Partial<Expense> }): Promise<ApiResponse<Expense>>;
  delete(id: string): Promise<ApiResponse>;
  getAll(): Promise<ApiResponse<Expense[]>>;
};
report: {
  exportCsv(data: { csv: string; defaultName: string }): Promise<ApiResponse<string>>;
  exportPdf(data: { html: string; defaultName: string }): Promise<ApiResponse<string>>;
};
```

(`report.exportCsv` delegates to the existing `csv:save` handler logic; `report.exportPdf` is a new handler that renders arbitrary HTML to PDF.)

### 2. `src/shared/forecast-engine.ts` — new file

```ts
export function forecastRevenue(invoices: Invoice[], referenceDate: Date): ForecastResult[]
```

- Filters to `status === 'paid'` invoices within the 6 calendar months ending at `referenceDate`.
- Computes the average monthly paid revenue (0 if fewer than 1 paid invoice exists).
- Returns exactly 3 `ForecastResult` items for the 3 calendar months immediately following `referenceDate`.

### 3. `src/shared/tax-report-generator.ts` — new file

```ts
export function buildTaxSummary(invoices: Invoice[], year: number): TaxSummary
```

- Filters to `status === 'paid'` invoices whose `issueDate` falls in `year`.
- Aggregates `grandTotal` → `totalInvoiced` and `taxTotal` → `taxTotal` per calendar month.
- Computes `net = totalInvoiced - taxTotal` per row and annual totals.

### 4. `src/shared/theme-resolver.ts` — new file

```ts
export function resolveTheme(
  theme: AppSettings['theme'],
  systemIsDark: boolean,
): 'light' | 'dark'
```

Pure function; no Electron imports. Used by both the main process (passing `nativeTheme.shouldUseDarkColors`) and tests.

### 5. `src/shared/invoice-html.ts` — modified

`renderInvoiceHtml`, `renderClassicHtml`, `renderModernHtml`, and `renderMinimalHtml` each gain an optional `resolvedTheme?: 'light' | 'dark'` parameter (default `'light'`).

When `resolvedTheme === 'dark'`:
- Body background becomes `#1a1a2e`, text becomes `#e5e7eb`, borders become `#374151`.
- For the `modern` template the dark header (`#1A1A2E`) is inverted to `#f3f4f6` with dark text to maintain legibility (Req 4.11).
- All other light-mode output is unchanged when `resolvedTheme` is `'light'` or omitted.

### 6. `src/main/pdf-template.ts` — modified

```ts
export function generateInvoiceHtml(
  invoice: Invoice,
  settings: AppSettings,
  resolvedTheme?: 'light' | 'dark',
): string
```

Passes `resolvedTheme` through to `renderInvoiceHtml`.

### 7. `src/services/expense-store.ts` — new file

Mirrors the pattern of `data-service.ts`: reads/writes `expenses.json` under `app.getPath('userData')/users/{userId}/`. Exports:

```ts
export function createExpense(userId: string, data: Omit<Expense, 'id'|'userId'|'createdAt'|'updatedAt'>): ApiResponse<Expense>
export function updateExpense(userId: string, id: string, data: Partial<Expense>): ApiResponse<Expense>
export function deleteExpense(userId: string, id: string): ApiResponse
export function getAllExpenses(userId: string): ApiResponse<Expense[]>
```

### 8. `src/shared/constants.ts` — modified

New IPC channel constants:

```ts
EXPENSE_CREATE:    'expense:create',
EXPENSE_UPDATE:    'expense:update',
EXPENSE_DELETE:    'expense:delete',
EXPENSE_GET_ALL:   'expense:get-all',
REPORT_EXPORT_CSV: 'report:export-csv',
REPORT_EXPORT_PDF: 'report:export-pdf',
```

### 9. `src/main/ipc-handlers.ts` — modified

Registers handlers for the 6 new channels. The `report:export-pdf` handler:
1. Calls `resolveTheme(settings.theme, nativeTheme.shouldUseDarkColors)`.
2. Loads the provided HTML into a hidden `BrowserWindow` and calls `printToPDF`.
3. Shows a save dialog and writes the buffer.

The existing `pdf:export` handler is updated to pass `resolvedTheme` to `generateInvoiceHtml`.

### 10. `src/preload/preload.ts` — modified

Exposes `expense.*` and `report.*` namespaces via `contextBridge`.

### 11. `src/renderer/scripts/reports.ts` — modified

- Calls `forecastRevenue()` and appends 3 forecast bars (distinct colour) to the existing monthly chart.
- Adds an Expense section: form for add/edit, list, delete buttons.
- Adds a Profit/Loss table (revenue from `groupByMonth`, expenses from `expense.getAll`).
- Replaces the existing inline CSV export button with an "Export Tax Report" dropdown offering CSV and PDF.

---

## Data Models

### Expense persistence

File: `{userData}/users/{userId}/expenses.json`

```json
{
  "expenses": [
    {
      "id": "abc123",
      "userId": "user1",
      "date": "2024-03-15",
      "amount": 49.99,
      "category": "Software",
      "description": "Figma subscription",
      "createdAt": "2024-03-15T10:00:00.000Z",
      "updatedAt": "2024-03-15T10:00:00.000Z"
    }
  ]
}
```

Scoped per user; never mixed across `userId` values (Req 2.7).

### ForecastResult

```ts
{ period: "2024-04", amount: 3200 }
```

### TaxSummary

```ts
{
  year: 2024,
  rows: [
    { month: 1, label: "Jan", totalInvoiced: 5000, taxTotal: 500, net: 4500 },
    ...
  ],
  annualTotalInvoiced: 60000,
  annualTaxTotal: 6000,
  annualNet: 54000
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Forecast output shape

*For any* array of invoices (including empty) and any valid reference date, `forecastRevenue()` returns exactly 3 `ForecastResult` items, each with a non-empty `period` string and a non-negative `amount`.

**Validates: Requirements 1.1, 1.2, 1.6**

### Property 2: Forecast average correctness

*For any* array of paid invoices and a reference date, the `amount` in each `ForecastResult` equals the arithmetic mean of the `grandTotal` values of paid invoices whose `issueDate` falls within the 6 calendar months ending at the reference date (or `0` if none exist).

**Validates: Requirements 1.1, 1.2**

### Property 3: Expense create round-trip

*For any* valid expense payload (non-empty category, non-empty description, non-negative amount, valid ISO date), creating an expense and then calling `getAllExpenses` for the same userId returns a list that contains the created expense.

**Validates: Requirements 2.2, 2.8**

### Property 4: Expense validation rejects invalid inputs

*For any* expense payload where at least one of the following is true — `amount < 0`, `category` is empty/whitespace, `description` is empty/whitespace, `date` is missing — the create operation should return `success: false` and `getAllExpenses` should be unchanged.

**Validates: Requirements 2.3**

### Property 5: Expense delete round-trip

*For any* expense that has been created, deleting it and then calling `getAllExpenses` returns a list that does not contain that expense.

**Validates: Requirements 2.4**

### Property 6: Expense user isolation

*For any* two distinct userIds A and B, expenses written for userId A should never appear in `getAllExpenses` for userId B.

**Validates: Requirements 2.7**

### Property 7: Tax aggregation invariant

*For any* array of invoices and any year, the sum of `row.taxTotal` across all rows in the `TaxSummary` returned by `buildTaxSummary()` equals the sum of `invoice.taxTotal` for all invoices with `status === 'paid'` and `issueDate` in that year.

**Validates: Requirements 3.8**

### Property 8: Tax summary only includes paid invoices

*For any* array of invoices containing a mix of statuses, `buildTaxSummary()` should produce the same result as if only the `status === 'paid'` invoices were passed.

**Validates: Requirements 3.2, 3.8**

### Property 9: resolveTheme correctness and determinism

*For any* `theme` in `{'light', 'dark', 'system'}` and any boolean `systemIsDark`:
- `resolveTheme(theme, systemIsDark)` returns the same value when called twice with the same arguments (determinism / idempotence).
- `resolveTheme('light', systemIsDark)` always returns `'light'`.
- `resolveTheme('dark', systemIsDark)` always returns `'dark'`.

**Validates: Requirements 4.5, 4.6, 4.7**

### Property 10: Modern template dark header inversion

*For any* invoice rendered with the `modern` template and `resolvedTheme === 'dark'`, the generated HTML should not use the dark header background colour (`#1A1A2E`) as a background in the header element, ensuring legibility.

**Validates: Requirements 4.11**

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `forecastRevenue` receives 0 paid invoices in trailing window | Returns 3 results each with `amount: 0` (Req 1.2) |
| Expense create with invalid fields | Returns `{ success: false, error: '...' }`; nothing persisted (Req 2.3) |
| Expense/report IPC handler throws | Catches, logs via `electron-log`, returns `{ success: false, error: String(err) }` |
| File-save dialog cancelled | Returns `{ success: false, error: 'Cancelled' }`; renderer treats `'Cancelled'` as a no-op (no toast) (Req 3.4) |
| PDF/CSV write fails (disk full, permissions) | Returns `{ success: false, error: descriptive message }`; renderer shows error toast (Req 3.6) |
| `resolveTheme` called with unknown theme string | TypeScript type system prevents this at compile time; runtime falls back to `'light'` |
| `buildTaxSummary` receives invoices from multiple years | Filters by `year` parameter; other years are silently ignored |

---

## Testing Strategy

### Dual approach

Both unit tests and property-based tests are required. Unit tests cover specific examples, integration points, and error conditions. Property tests verify universal correctness across randomised inputs.

### Property-based testing library

Use **[fast-check](https://github.com/dubzzz/fast-check)** (already compatible with Vitest). Each property test runs a minimum of **100 iterations**.

Each property test must be tagged with a comment in this format:
```
// Feature: reporting-analytics, Property N: <property text>
```

### Unit tests (specific examples and edge cases)

| File | What to test |
|---|---|
| `src/shared/__tests__/forecast-engine.test.ts` | Empty invoice array → all zeros; single invoice → correct average; invoices spanning year boundary |
| `src/shared/__tests__/tax-report-generator.test.ts` | Mixed-status invoices → only paid counted; year boundary; all-zero year |
| `src/shared/__tests__/theme-resolver.test.ts` | `resolveTheme('system', true)` → `'dark'`; `resolveTheme('system', false)` → `'light'` (Req 4.8, 4.9) |
| `src/services/__tests__/expense-store.test.ts` | Create/read/update/delete lifecycle; user isolation with two userIds |
| `src/renderer/scripts/__tests__/reports.test.ts` | Expense form validation error display; profit/loss table renders $0 when no expenses |

### Property tests

| File | Property | Iterations |
|---|---|---|
| `src/shared/__tests__/forecast-engine.property.test.ts` | Property 1: output shape | 200 |
| `src/shared/__tests__/forecast-engine.property.test.ts` | Property 2: average correctness | 200 |
| `src/shared/__tests__/tax-report-generator.property.test.ts` | Property 7: tax aggregation invariant | 200 |
| `src/shared/__tests__/tax-report-generator.property.test.ts` | Property 8: only paid invoices counted | 200 |
| `src/services/__tests__/expense-store.property.test.ts` | Property 3: create round-trip | 100 |
| `src/services/__tests__/expense-store.property.test.ts` | Property 4: validation rejects invalid inputs | 100 |
| `src/services/__tests__/expense-store.property.test.ts` | Property 5: delete round-trip | 100 |
| `src/services/__tests__/expense-store.property.test.ts` | Property 6: user isolation | 100 |
| `src/shared/__tests__/theme-resolver.property.test.ts` | Property 9: resolveTheme correctness and determinism | 100 |
| `src/shared/__tests__/invoice-html.property.test.ts` | Property 10: modern template dark header inversion | 100 |

### Coverage targets

- All pure functions in `src/shared/` (forecast-engine, tax-report-generator, theme-resolver): 100% branch coverage.
- `expense-store.ts`: 100% branch coverage via unit + property tests.
- `ipc-handlers.ts` new handlers: covered by integration-style unit tests using mocked `dialog` and `fs`.
