import { Invoice, AppSettings } from '../shared/types';
import { formatCurrency, formatDate } from '../shared/utils';

function esc(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function addr(
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

export function generateInvoiceHtml(invoice: Invoice, _settings: AppSettings): string {
  const sym = invoice.currencySymbol || '$';
  const statusColor: Record<string, string> = {
    draft: '#6B7280',
    unpaid: '#D97706',
    paid: '#059669',
    overdue: '#DC2626',
    cancelled: '#9CA3AF',
  };
  const sc = statusColor[invoice.status] ?? '#6B7280';

  const rows = invoice.lineItems
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
.footer{margin-top:40px;text-align:center;font-size:11px;color:#9CA3AF}
@media print{body{padding:24px}}
</style></head><body>
<div class="hd">
  <div>
    ${invoice.billFrom.logo ? `<img src="${invoice.billFrom.logo}" alt="logo" style="max-height:56px;max-width:160px;margin-bottom:8px;display:block">` : ''}
    <div class="brand">${esc(invoice.billFrom.name) || 'Your Business'}</div>
  </div>
  <div>
    <div class="inv-num">Invoice&nbsp;${esc(invoice.number)}</div>
    <div style="text-align:right"><span class="badge">${invoice.status}</span></div>
  </div>
</div>

<div class="addrs">
  <div class="addr-block"><div class="lbl">From</div>
    ${addr(invoice.billFrom.name, undefined, invoice.billFrom.address, invoice.billFrom.city, invoice.billFrom.state, invoice.billFrom.zip, invoice.billFrom.country, invoice.billFrom.email, invoice.billFrom.phone)}
  </div>
  <div class="addr-block"><div class="lbl">Bill To</div>
    ${addr(invoice.billTo.name, invoice.billTo.company, invoice.billTo.address, invoice.billTo.city, invoice.billTo.state, invoice.billTo.zip, invoice.billTo.country, invoice.billTo.email, invoice.billTo.phone)}
  </div>
</div>

<div class="dates">
  <div><div class="dl">Issue Date</div><div class="dv">${formatDate(invoice.issueDate)}</div></div>
  <div><div class="dl">Due Date</div><div class="dv">${formatDate(invoice.dueDate)}</div></div>
  ${invoice.poNumber ? `<div><div class="dl">PO Number</div><div class="dv">${esc(invoice.poNumber)}</div></div>` : ''}
</div>

<table>
  <thead><tr><th>Description</th><th class="c">Qty</th><th class="r">Unit Price</th><th class="c">Tax</th><th class="r">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="totals">
  <div class="tr"><span class="tl">Subtotal</span><span class="tv">${formatCurrency(invoice.subtotal, sym)}</span></div>
  ${invoice.discountAmount > 0 ? `<div class="tr"><span class="tl">Discount${invoice.discount.type === 'percent' ? ` (${invoice.discount.value}%)` : ''}</span><span class="tv">−${formatCurrency(invoice.discountAmount, sym)}</span></div>` : ''}
  ${invoice.taxTotal > 0 ? `<div class="tr"><span class="tl">Tax</span><span class="tv">${formatCurrency(invoice.taxTotal, sym)}</span></div>` : ''}
  ${invoice.shipping > 0 ? `<div class="tr"><span class="tl">Shipping</span><span class="tv">${formatCurrency(invoice.shipping, sym)}</span></div>` : ''}
  <div class="tr tg"><span>Total</span><span class="tv">${formatCurrency(invoice.grandTotal, sym)}</span></div>
</div>

${invoice.notes ? `<div class="notes"><div class="lbl">Notes</div><p>${esc(invoice.notes)}</p></div>` : ''}
${invoice.terms ? `<div class="notes"><div class="lbl">Terms &amp; Conditions</div><p>${esc(invoice.terms)}</p></div>` : ''}

<div class="footer">Generated by Finch Invoice</div>
</body></html>`;
}
