/**
 * Property-based tests for CSV export utility
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */
import { describe, it, expect } from 'vitest';
import { toCSV } from '../utils';

// ─── Simple RFC 4180 CSV parser (for round-trip verification) ─────────────────

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  // Split on CRLF (or LF for robustness), but not inside quoted fields
  let pos = 0;
  const len = csv.length;

  while (pos <= len) {
    const row: string[] = [];
    // Parse one row
    while (pos <= len) {
      if (pos === len || (csv[pos] === '\r' && csv[pos + 1] === '\n')) {
        // End of row
        row.push('');
        break;
      }
      if (csv[pos] === '"') {
        // Quoted field
        pos++; // skip opening quote
        let field = '';
        while (pos < len) {
          if (csv[pos] === '"') {
            if (csv[pos + 1] === '"') {
              // Escaped quote
              field += '"';
              pos += 2;
            } else {
              // Closing quote
              pos++;
              break;
            }
          } else {
            field += csv[pos];
            pos++;
          }
        }
        row.push(field);
        // After quoted field, expect comma or end-of-row
        if (pos < len && csv[pos] === ',') pos++;
      } else {
        // Unquoted field — read until comma or CRLF/end
        let field = '';
        while (pos < len && csv[pos] !== ',' && !(csv[pos] === '\r' && csv[pos + 1] === '\n')) {
          field += csv[pos];
          pos++;
        }
        row.push(field);
        if (pos < len && csv[pos] === ',') pos++;
      }
      // Check for end of row
      if (pos < len && csv[pos] === '\r' && csv[pos + 1] === '\n') break;
      if (pos >= len) break;
    }
    // Advance past CRLF
    if (pos < len && csv[pos] === '\r' && csv[pos + 1] === '\n') pos += 2;
    else pos++;

    // Remove the trailing empty string artifact from the row-end detection
    if (row.length > 0 && row[row.length - 1] === '' && row.length > 1) {
      row.pop();
    }
    if (row.length > 0) rows.push(row);
  }
  return rows;
}

// ─── Property 6: Round-trip integrity ────────────────────────────────────────

describe('Property 6: Round-trip integrity', () => {
  it('parses back to equivalent data for simple rows', () => {
    const headers = ['Name', 'Amount', 'Date'];
    const rows = [
      ['Alice', '100.00', '2024-01-01'],
      ['Bob', '200.50', '2024-06-15'],
    ];
    const csv = toCSV(headers, rows);
    const parsed = parseCSV(csv);
    expect(parsed[0]).toEqual(headers);
    expect(parsed[1]).toEqual(rows[0]);
    expect(parsed[2]).toEqual(rows[1]);
  });

  it('round-trips fields containing commas', () => {
    const headers = ['Description', 'Value'];
    const rows = [['Item A, Item B', '50.00']];
    const csv = toCSV(headers, rows);
    const parsed = parseCSV(csv);
    expect(parsed[1]).toEqual(rows[0]);
  });

  it('round-trips fields containing double-quotes', () => {
    const headers = ['Note', 'Amount'];
    const rows = [['He said "hello"', '75.00']];
    const csv = toCSV(headers, rows);
    const parsed = parseCSV(csv);
    expect(parsed[1]).toEqual(rows[0]);
  });

  it('round-trips fields containing newlines', () => {
    const headers = ['Address', 'Total'];
    const rows = [['123 Main St\nSuite 4', '300.00']];
    const csv = toCSV(headers, rows);
    const parsed = parseCSV(csv);
    expect(parsed[1]).toEqual(rows[0]);
  });

  it('round-trips empty rows', () => {
    const headers = ['Month', 'Invoiced', 'Tax', 'Net'];
    const rows: string[][] = [];
    const csv = toCSV(headers, rows);
    const parsed = parseCSV(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(headers);
  });

  it('round-trips a full tax summary dataset', () => {
    const headers = ['Month', 'Total Invoiced', 'Tax Collected', 'Net Amount'];
    const rows = [
      ['January', '1000.00', '100.00', '900.00'],
      ['February', '0.00', '0.00', '0.00'],
      ['March', '2500.50', '250.05', '2250.45'],
      ['December', '500.00', '50.00', '450.00'],
    ];
    const csv = toCSV(headers, rows);
    const parsed = parseCSV(csv);
    expect(parsed[0]).toEqual(headers);
    rows.forEach((row, i) => {
      expect(parsed[i + 1]).toEqual(row);
    });
  });

  it('round-trips fields with all special characters combined', () => {
    const headers = ['Field'];
    const rows = [['value with, comma and "quotes" and\nnewline']];
    const csv = toCSV(headers, rows);
    const parsed = parseCSV(csv);
    expect(parsed[1]).toEqual(rows[0]);
  });

  it('round-trips numeric strings', () => {
    const headers = ['ID', 'Amount'];
    const rows = [
      ['1', '0.00'],
      ['2', '9999999.99'],
      ['3', '-100.00'],
    ];
    const csv = toCSV(headers, rows);
    const parsed = parseCSV(csv);
    rows.forEach((row, i) => {
      expect(parsed[i + 1]).toEqual(row);
    });
  });
});

// ─── Property 7: Header always present ───────────────────────────────────────

describe('Property 7: Header always present', () => {
  it('starts with the header row for non-empty data', () => {
    const headers = ['Month', 'Total'];
    const rows = [['January', '500.00']];
    const csv = toCSV(headers, rows);
    const firstLine = csv.split('\r\n')[0];
    expect(firstLine).toBe('Month,Total');
  });

  it('starts with the header row when there are no data rows', () => {
    const headers = ['A', 'B', 'C'];
    const csv = toCSV(headers, []);
    expect(csv).toBe('A,B,C');
  });

  it('header is the first parsed row regardless of data content', () => {
    const headers = ['Name', 'Value'];
    const rows = [
      ['row1', '1'],
      ['row2', '2'],
      ['row3', '3'],
    ];
    const csv = toCSV(headers, rows);
    const parsed = parseCSV(csv);
    expect(parsed[0]).toEqual(headers);
  });

  it('header with special characters is still the first line', () => {
    const headers = ['Name, Title', '"Quoted"', 'Line\nBreak'];
    const rows = [['a', 'b', 'c']];
    const csv = toCSV(headers, rows);
    const parsed = parseCSV(csv);
    expect(parsed[0]).toEqual(headers);
  });

  it('output always starts with header content even for large datasets', () => {
    const headers = ['Col1', 'Col2', 'Col3'];
    const rows = Array.from({ length: 50 }, (_, i) => [`val${i}`, `${i * 10}`, `note${i}`]);
    const csv = toCSV(headers, rows);
    const parsed = parseCSV(csv);
    expect(parsed[0]).toEqual(headers);
    expect(parsed).toHaveLength(51); // header + 50 rows
  });
});

// ─── Property 8: Special-character escaping ───────────────────────────────────

describe('Property 8: Special-character escaping', () => {
  it('wraps field containing comma in double-quotes', () => {
    const csv = toCSV(['A'], [['hello, world']]);
    expect(csv).toContain('"hello, world"');
  });

  it('wraps field containing double-quote in double-quotes and doubles the quote', () => {
    const csv = toCSV(['A'], [['say "hi"']]);
    expect(csv).toContain('"say ""hi"""');
  });

  it('wraps field containing newline in double-quotes', () => {
    const csv = toCSV(['A'], [['line1\nline2']]);
    expect(csv).toContain('"line1\nline2"');
  });

  it('does not wrap plain fields without special characters', () => {
    const csv = toCSV(['Name', 'Amount'], [['Alice', '100.00']]);
    expect(csv).toBe('Name,Amount\r\nAlice,100.00');
  });

  it('doubles internal double-quotes (RFC 4180)', () => {
    const csv = toCSV(['A'], [['"already quoted"']]);
    // The field starts and ends with a quote, so the whole thing gets wrapped
    // and internal quotes are doubled: ""already quoted""
    expect(csv).toBe('A\r\n"""already quoted"""');
  });

  it('escapes a field with both comma and double-quote', () => {
    const csv = toCSV(['A'], [['price: "10,00"']]);
    expect(csv).toContain('"price: ""10,00"""');
  });

  it('escapes header fields containing special characters', () => {
    const csv = toCSV(['Total, Amount'], [['100']]);
    const firstLine = csv.split('\r\n')[0];
    expect(firstLine).toBe('"Total, Amount"');
  });

  it('handles empty string fields without quoting', () => {
    const csv = toCSV(['A', 'B'], [['', 'value']]);
    expect(csv).toBe('A,B\r\n,value');
  });

  it('handles a field that is only a double-quote character', () => {
    const csv = toCSV(['A'], [['"']]);
    expect(csv).toBe('A\r\n""""');
  });
});
