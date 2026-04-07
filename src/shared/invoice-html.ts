import { Invoice, AppSettings } from './types';
import { formatCurrency, formatDate } from './utils';

export type InvoiceTemplate = 'classic' | 'modern' | 'minimal';

// ─── Shared Helpers ───────────────────────────────────────────────────────────

export function esc(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function addr(
  name: string | undefined,
  company: string | undefined,
  address: string | undefined,
  city: string | undefined,
  state: string | undefined,
  zip: string | undefined,
  country: string | undefined,
  email: string | undefined,
  phone: string | undefined,
): string {
  const parts: string[] = [];
  if (name) parts.push(`<strong>${esc(name)}</strong>`);
  if (company) parts.push(esc(company));
  if (address) parts.push(esc(address));
  const csz = [city, state, zip].filter(Boolean).join(', ');
  if (csz) parts.push(esc(csz));
  if (country) parts.push(esc(country));
  if (email) parts.push(esc(email));
  if (phone) parts.push(esc(phone));
  return parts.join('<br>');
}

export function renderTotalsHtml(invoice: Partial<Invoice>, sym: string): string {
  const subtotal = invoice.subtotal ?? 0;
  const discountAmount = invoice.discountAmount ?? 0;
  const taxTotal = invoice.taxTotal ?? 0;
  const shipping = invoice.shipping ?? 0;
  const grandTotal = invoice.grandTotal ?? 0;
  const discount = invoice.discount;

  return `
  <div class="tr"><span class="tl">Subtotal</span><span class="tv">${formatCurrency(subtotal, sym)}</span></div>
  ${discountAmount > 0 ? `<div class="tr"><span class="tl">Discount${discount?.type === 'percent' ? ` (${discount.value}%)` : ''}</span><span class="tv">−${formatCurrency(discountAmount, sym)}</span></div>` : ''}
  ${taxTotal > 0 ? `<div class="tr"><span class="tl">Tax</span><span class="tv">${formatCurrency(taxTotal, sym)}</span></div>` : ''}
  ${shipping > 0 ? `<div class="tr"><span class="tl">Shipping</span><span class="tv">${formatCurrency(shipping, sym)}</span></div>` : ''}`;
}

export function renderNotesHtml(invoice: Partial<Invoice>): string {
  let html = '';
  if (invoice.notes) {
    html += `<div class="notes"><div class="lbl">Notes</div><p>${esc(invoice.notes)}</p></div>`;
  }
  if (invoice.terms) {
    html += `<div class="notes"><div class="lbl">Terms &amp; Conditions</div><p>${esc(invoice.terms)}</p></div>`;
  }
  return html;
}

export function renderFooterTextHtml(footerText: string | undefined, minimal = false): string {
  if (!footerText) return '';
  const borderColor = minimal ? '#E5E7EB' : '#E2E0D8';
  return `<hr style="border:none;border-top:1px solid ${borderColor};margin:24px 0">
<div class="footer-text">
  <div class="lbl">Footer</div>
  <p>${esc(footerText)}</p>
</div>`;
}

// ─── Classic Template ─────────────────────────────────────────────────────────

export function renderClassicHtml(invoice: Partial<Invoice>, _settings: AppSettings): string {
  const sym = invoice.currencySymbol || '$';
  const statusColor: Record<string, string> = {
    draft: '#6B7280',
    unpaid: '#D97706',
    paid: '#059669',
    overdue: '#DC2626',
    cancelled: '#9CA3AF',
  };
  const sc = statusColor[invoice.status ?? 'draft'] ?? '#6B7280';

  const rows = (invoice.lineItems ?? [])
    .map(
      item => `<tr>
      <td>${esc(item.description)}</td>
      <td class="c">${item.quantity}</td>
      <td class="r">${formatCurrency(item.unitPrice, sym)}</td>
      <td class="c">${item.taxRate}%</td>
      <td class="r">${formatCurrency(item.quantity * item.unitPrice, sym)}</td>
    </tr>`,
    )
    .join('');

  const bf = invoice.billFrom ?? ({} as Partial<Invoice['billFrom']>);
  const bt = invoice.billTo ?? {};

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Invoice ${esc(invoice.number)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.5;color:#1A1A2E;padding:48px;max-width:820px;margin:0 auto;background:#fff}
.hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px}
.brand{font-size:22px;font-weight:700;letter-spacing:-0.5px}
.inv-num{font-size:18px;font-weight:700;text-align:right}
.badge{display:inline-block;padding:2px 10px;border-radius:100px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:${sc};margin-top:4px}
.addrs{display:flex;gap:40px;margin-bottom:32px}
.addr-block{flex:1}
.lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280;margin-bottom:6px}
.dates{display:flex;gap:24px;background:#F5F4F0;border-radius:8px;padding:14px 18px;margin-bottom:32px}
.dl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280}
.dv{font-size:13px;font-weight:600;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
thead th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280;padding:8px 10px;border-bottom:2px solid #E2E0D8;text-align:left}
tbody td{padding:10px;border-bottom:1px solid #F0EFE9;color:#1A1A2E}
tbody tr:last-child td{border-bottom:none}
.c{text-align:center}.r{text-align:right;font-family:'SF Mono',Consolas,monospace}
.totals{margin-left:auto;width:260px}
.tr{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
.tg{border-top:2px solid #1A1A2E;margin-top:8px;padding-top:10px;font-size:15px;font-weight:700}
.tl{color:#6B7280}.tv{font-family:'SF Mono',Consolas,monospace}
.notes{margin-top:32px;padding-top:20px;border-top:1px solid #E2E0D8}
.notes .lbl{margin-bottom:6px}
.notes p{color:#4B5563;line-height:1.6;white-space:pre-wrap}
.footer-text{margin-top:8px}
.footer-text .lbl{margin-bottom:6px}
.footer-text p{color:#4B5563;line-height:1.6;white-space:pre-wrap}
.footer{margin-top:40px;text-align:center;font-size:11px;color:#9CA3AF}
@media print{body{padding:24px}}
</style></head><body>
<div class="hd">
  <div>
    ${bf.logo ? `<img src="${bf.logo}" alt="logo" style="max-height:56px;max-width:160px;margin-bottom:8px;display:block">` : ''}
    <div class="brand">${esc(bf.name) || 'Your Business'}</div>
  </div>
  <div>
    <div class="inv-num">Invoice&nbsp;${esc(invoice.number)}</div>
    <div style="text-align:right"><span class="badge">${esc(invoice.status)}</span></div>
  </div>
</div>

<div class="addrs">
  <div class="addr-block"><div class="lbl">From</div>
    ${addr(bf.name, undefined, bf.address, bf.city, bf.state, bf.zip, bf.country, bf.email, bf.phone)}
  </div>
  <div class="addr-block"><div class="lbl">Bill To</div>
    ${addr(bt.name, bt.company, bt.address, bt.city, bt.state, bt.zip, bt.country, bt.email, bt.phone)}
  </div>
</div>

<div class="dates">
  <div><div class="dl">Issue Date</div><div class="dv">${formatDate(invoice.issueDate ?? '')}</div></div>
  <div><div class="dl">Due Date</div><div class="dv">${formatDate(invoice.dueDate ?? '')}</div></div>
  ${invoice.poNumber ? `<div><div class="dl">PO Number</div><div class="dv">${esc(invoice.poNumber)}</div></div>` : ''}
</div>

<table>
  <thead><tr><th>Description</th><th class="c">Qty</th><th class="r">Unit Price</th><th class="c">Tax</th><th class="r">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="totals">
  ${renderTotalsHtml(invoice, sym)}
  <div class="tr tg"><span>Total</span><span class="tv">${formatCurrency(invoice.grandTotal ?? 0, sym)}</span></div>
</div>

${renderNotesHtml(invoice)}
${renderFooterTextHtml(invoice.footerText)}

<div class="footer">Generated by Finch Invoice</div>
</body></html>`;
}

// ─── Modern Template ──────────────────────────────────────────────────────────

export function renderModernHtml(invoice: Partial<Invoice>, _settings: AppSettings): string {
  const sym = invoice.currencySymbol || '$';
  const statusColor: Record<string, string> = {
    draft: '#6B7280',
    unpaid: '#D97706',
    paid: '#059669',
    overdue: '#DC2626',
    cancelled: '#9CA3AF',
  };
  const sc = statusColor[invoice.status ?? 'draft'] ?? '#6B7280';

  const bf = invoice.billFrom ?? ({} as Partial<Invoice['billFrom']>);
  const bt = invoice.billTo ?? {};

  const rows = (invoice.lineItems ?? [])
    .map(
      (item, i) => `<tr style="background:${i % 2 === 0 ? '#F9F9F9' : '#FFFFFF'}">
      <td>${esc(item.description)}</td>
      <td class="c">${item.quantity}</td>
      <td class="r">${formatCurrency(item.unitPrice, sym)}</td>
      <td class="c">${item.taxRate}%</td>
      <td class="r">${formatCurrency(item.quantity * item.unitPrice, sym)}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Invoice ${esc(invoice.number)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.5;color:#1A1A2E;max-width:820px;margin:0 auto;background:#fff}
.mod-header{background:#1A1A2E;padding:32px 48px;display:flex;justify-content:space-between;align-items:flex-start}
.mod-header .brand{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#fff}
.mod-header .inv-num{font-size:18px;font-weight:700;color:#fff;text-align:right}
.badge{display:inline-block;padding:2px 10px;border-radius:100px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:${sc};margin-top:4px}
.body-pad{padding:40px 48px}
.addrs{display:flex;gap:40px;margin-bottom:32px}
.addr-block{flex:1}
.lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280;margin-bottom:6px}
.dates{display:flex;gap:24px;margin-bottom:32px}
.dl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280}
.dv{font-size:13px;font-weight:600;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
thead th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280;padding:8px 10px;border-bottom:2px solid #E2E0D8;text-align:left}
tbody td{padding:10px;color:#1A1A2E}
.c{text-align:center}.r{text-align:right;font-family:'SF Mono',Consolas,monospace}
.totals{margin-left:auto;width:280px}
.tr{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
.tg{background:#1A1A2E;color:#fff;padding:10px 12px;margin-top:8px;font-size:15px;font-weight:700;border-radius:4px}
.tg .tv{color:#fff}
.tl{color:#6B7280}.tv{font-family:'SF Mono',Consolas,monospace}
.notes{margin-top:32px;padding-top:20px;border-top:1px solid #E2E0D8}
.notes .lbl{margin-bottom:6px}
.notes p{color:#4B5563;line-height:1.6;white-space:pre-wrap}
.footer-text{margin-top:8px}
.footer-text .lbl{margin-bottom:6px}
.footer-text p{color:#4B5563;line-height:1.6;white-space:pre-wrap}
.footer{margin-top:40px;text-align:center;font-size:11px;color:#9CA3AF}
@media print{.mod-header{padding:24px 24px}.body-pad{padding:24px}}
</style></head><body>
<div class="mod-header">
  <div>
    ${bf.logo ? `<img src="${bf.logo}" alt="logo" style="max-height:56px;max-width:160px;margin-bottom:8px;display:block">` : ''}
    <div class="brand">${esc(bf.name) || 'Your Business'}</div>
  </div>
  <div>
    <div class="inv-num">Invoice&nbsp;${esc(invoice.number)}</div>
    <div style="text-align:right"><span class="badge">${esc(invoice.status)}</span></div>
  </div>
</div>

<div class="body-pad">
<div class="addrs">
  <div class="addr-block"><div class="lbl">From</div>
    ${addr(bf.name, undefined, bf.address, bf.city, bf.state, bf.zip, bf.country, bf.email, bf.phone)}
  </div>
  <div class="addr-block"><div class="lbl">Bill To</div>
    ${addr(bt.name, bt.company, bt.address, bt.city, bt.state, bt.zip, bt.country, bt.email, bt.phone)}
  </div>
</div>

<div class="dates">
  <div><div class="dl">Issue Date</div><div class="dv">${formatDate(invoice.issueDate ?? '')}</div></div>
  <div><div class="dl">Due Date</div><div class="dv">${formatDate(invoice.dueDate ?? '')}</div></div>
  ${invoice.poNumber ? `<div><div class="dl">PO Number</div><div class="dv">${esc(invoice.poNumber)}</div></div>` : ''}
</div>

<table>
  <thead><tr><th>Description</th><th class="c">Qty</th><th class="r">Unit Price</th><th class="c">Tax</th><th class="r">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="totals">
  ${renderTotalsHtml(invoice, sym)}
  <div class="tr tg"><span>Total</span><span class="tv">${formatCurrency(invoice.grandTotal ?? 0, sym)}</span></div>
</div>

${renderNotesHtml(invoice)}
${renderFooterTextHtml(invoice.footerText)}

<div class="footer">Generated by Finch Invoice</div>
</div>
</body></html>`;
}

// ─── Minimal Template ─────────────────────────────────────────────────────────

export function renderMinimalHtml(invoice: Partial<Invoice>, _settings: AppSettings): string {
  const sym = invoice.currencySymbol || '$';

  const bf = invoice.billFrom ?? ({} as Partial<Invoice['billFrom']>);
  const bt = invoice.billTo ?? {};

  const rows = (invoice.lineItems ?? [])
    .map(
      item => `<tr>
      <td>${esc(item.description)}</td>
      <td class="c">${item.quantity}</td>
      <td class="r">${formatCurrency(item.unitPrice, sym)}</td>
      <td class="c">${item.taxRate}%</td>
      <td class="r">${formatCurrency(item.quantity * item.unitPrice, sym)}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Invoice ${esc(invoice.number)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.5;color:#000000;padding:48px;max-width:820px;margin:0 auto;background:#FFFFFF}
.hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:16px;border-bottom:1px solid #E5E7EB}
.brand{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#000000}
.inv-num{font-size:18px;font-weight:700;text-align:right;color:#000000}
.status-text{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;text-align:right;margin-top:4px}
.addrs{display:flex;gap:40px;margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #E5E7EB}
.addr-block{flex:1}
.lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280;margin-bottom:6px}
.dates{display:flex;gap:24px;margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #E5E7EB}
.dl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280}
.dv{font-size:13px;font-weight:600;margin-top:2px;color:#000000}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
thead th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280;padding:8px 10px;border-bottom:1px solid #E5E7EB;text-align:left}
tbody td{padding:10px;border-bottom:1px solid #E5E7EB;color:#000000}
tbody tr:last-child td{border-bottom:none}
.c{text-align:center}.r{text-align:right;font-family:'SF Mono',Consolas,monospace}
.totals{margin-left:auto;width:260px}
.tr{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
.tg{border-top:2px solid #000000;margin-top:8px;padding-top:10px;font-size:15px;font-weight:700}
.tl{color:#6B7280}.tv{font-family:'SF Mono',Consolas,monospace}
.notes{margin-top:24px;padding-top:20px;border-top:1px solid #E5E7EB}
.notes .lbl{margin-bottom:6px}
.notes p{color:#6B7280;line-height:1.6;white-space:pre-wrap}
.footer-text{margin-top:8px}
.footer-text .lbl{margin-bottom:6px}
.footer-text p{color:#6B7280;line-height:1.6;white-space:pre-wrap}
.footer{margin-top:40px;text-align:center;font-size:11px;color:#6B7280}
@media print{body{padding:24px}}
</style></head><body>
<div class="hd">
  <div>
    ${bf.logo ? `<img src="${bf.logo}" alt="logo" style="max-height:56px;max-width:160px;margin-bottom:8px;display:block">` : ''}
    <div class="brand">${esc(bf.name) || 'Your Business'}</div>
  </div>
  <div>
    <div class="inv-num">Invoice&nbsp;${esc(invoice.number)}</div>
    <div class="status-text">${esc(invoice.status)}</div>
  </div>
</div>

<div class="addrs">
  <div class="addr-block"><div class="lbl">From</div>
    ${addr(bf.name, undefined, bf.address, bf.city, bf.state, bf.zip, bf.country, bf.email, bf.phone)}
  </div>
  <div class="addr-block"><div class="lbl">Bill To</div>
    ${addr(bt.name, bt.company, bt.address, bt.city, bt.state, bt.zip, bt.country, bt.email, bt.phone)}
  </div>
</div>

<div class="dates">
  <div><div class="dl">Issue Date</div><div class="dv">${formatDate(invoice.issueDate ?? '')}</div></div>
  <div><div class="dl">Due Date</div><div class="dv">${formatDate(invoice.dueDate ?? '')}</div></div>
  ${invoice.poNumber ? `<div><div class="dl">PO Number</div><div class="dv">${esc(invoice.poNumber)}</div></div>` : ''}
</div>

<table>
  <thead><tr><th>Description</th><th class="c">Qty</th><th class="r">Unit Price</th><th class="c">Tax</th><th class="r">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="totals">
  ${renderTotalsHtml(invoice, sym)}
  <div class="tr tg"><span>Total</span><span class="tv">${formatCurrency(invoice.grandTotal ?? 0, sym)}</span></div>
</div>

${renderNotesHtml(invoice)}
${renderFooterTextHtml(invoice.footerText, true)}

<div class="footer">Generated by Finch Invoice</div>
</body></html>`;
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function renderInvoiceHtml(invoice: Partial<Invoice>, settings: AppSettings): string {
  const tpl = invoice.template ?? 'classic';
  if (tpl === 'modern') return renderModernHtml(invoice, settings);
  if (tpl === 'minimal') return renderMinimalHtml(invoice, settings);
  return renderClassicHtml(invoice, settings);
}
