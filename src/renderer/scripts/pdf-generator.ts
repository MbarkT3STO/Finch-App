import { Invoice, AppSettings } from '../../shared/types';
import { formatCurrency, formatDate } from '../../shared/utils';

function esc(s: string | undefined | null) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function generatePreviewHtml(invoice: Partial<Invoice>, settings: AppSettings): string {
  const sym = invoice.currencySymbol ?? settings.currencySymbol ?? '$';
  const items = invoice.lineItems ?? [];
  const discount = invoice.discount ?? { type: 'percent' as const, value: 0 };
  const statusColor: Record<string, string> = {
    draft: '#6B7280', unpaid: '#D97706', paid: '#059669', overdue: '#DC2626', cancelled: '#9CA3AF',
  };
  const sc = statusColor[invoice.status ?? 'draft'] ?? '#6B7280';

  const rows = items.map(item => `
    <tr>
      <td>${esc(item.description)}</td>
      <td class="c">${item.quantity ?? 0}</td>
      <td class="r">${formatCurrency(item.unitPrice ?? 0, sym)}</td>
      <td class="c">${item.taxRate ?? 0}%</td>
      <td class="r">${formatCurrency((item.quantity ?? 0) * (item.unitPrice ?? 0), sym)}</td>
    </tr>`).join('') || `<tr><td colspan="5" style="text-align:center;color:#9CA3AF;padding:20px">No line items</td></tr>`;

  const bf = invoice.billFrom ?? { name: '', address: '', city: '', state: '', zip: '', country: '', email: '', phone: '' };
  const bt = invoice.billTo ?? {};

  function addrBlock(name: string | undefined, company: string | undefined, address: string | undefined, city: string | undefined, state: string | undefined, zip: string | undefined, country: string | undefined, email: string | undefined, phone: string | undefined): string {
    const p: string[] = [];
    if (name) p.push(`<strong>${esc(name)}</strong>`);
    if (company) p.push(esc(company));
    if (address) p.push(esc(address));
    const csz = [city, state, zip].filter(Boolean).join(', ');
    if (csz) p.push(esc(csz));
    if (country) p.push(esc(country));
    if (email) p.push(esc(email));
    if (phone) p.push(esc(phone));
    return p.length ? p.join('<br>') : '<span style="color:#9CA3AF">—</span>';
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12.5px;line-height:1.5;color:#1A1A2E;padding:32px;background:#fff}
.hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
.brand{font-size:18px;font-weight:700;letter-spacing:-0.5px}
.inv-num{font-size:16px;font-weight:700;text-align:right}
.badge{display:inline-block;padding:2px 8px;border-radius:100px;font-size:9px;font-weight:700;text-transform:uppercase;color:#fff;background:${sc};margin-top:3px}
.addrs{display:flex;gap:32px;margin-bottom:24px}
.addr-block{flex:1}
.lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280;margin-bottom:4px}
.dates{display:flex;gap:20px;background:#F5F4F0;border-radius:6px;padding:10px 14px;margin-bottom:24px}
.dl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280}
.dv{font-size:12px;font-weight:600;margin-top:1px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280;padding:6px 8px;border-bottom:2px solid #E2E0D8;text-align:left}
tbody td{padding:8px;border-bottom:1px solid #F0EFE9;color:#1A1A2E}
tbody tr:last-child td{border-bottom:none}
.c{text-align:center}.r{text-align:right;font-family:'SF Mono',Consolas,monospace}
.totals{margin-left:auto;width:220px}
.tr{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
.tg{border-top:2px solid #1A1A2E;margin-top:6px;padding-top:8px;font-size:14px;font-weight:700}
.tl{color:#6B7280}.tv{font-family:'SF Mono',Consolas,monospace}
.notes{margin-top:24px;padding-top:16px;border-top:1px solid #E2E0D8}
.notes p{color:#4B5563;white-space:pre-wrap;font-size:12px}
.footer{margin-top:32px;text-align:center;font-size:10px;color:#9CA3AF}
</style></head><body>
<div class="hd">
  <div>
    ${bf.logo ? `<img src="${bf.logo}" alt="" style="max-height:48px;max-width:140px;margin-bottom:6px;display:block">` : ''}
    <div class="brand">${esc(bf.name) || '<span style="color:#9CA3AF">Your Business</span>'}</div>
  </div>
  <div>
    <div class="inv-num">${esc(invoice.number) || 'INV-0000'}</div>
    <div style="text-align:right"><span class="badge">${invoice.status ?? 'draft'}</span></div>
  </div>
</div>
<div class="addrs">
  <div class="addr-block"><div class="lbl">From</div>${addrBlock(bf.name, undefined, bf.address, bf.city, bf.state, bf.zip, bf.country, bf.email, bf.phone)}</div>
  <div class="addr-block"><div class="lbl">Bill To</div>${addrBlock(bt.name, bt.company, bt.address, bt.city, bt.state, bt.zip, bt.country, bt.email, bt.phone)}</div>
</div>
<div class="dates">
  <div><div class="dl">Issue Date</div><div class="dv">${invoice.issueDate ? formatDate(invoice.issueDate) : '—'}</div></div>
  <div><div class="dl">Due Date</div><div class="dv">${invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</div></div>
  ${invoice.poNumber ? `<div><div class="dl">PO #</div><div class="dv">${esc(invoice.poNumber)}</div></div>` : ''}
</div>
<table>
  <thead><tr><th>Description</th><th class="c">Qty</th><th class="r">Unit Price</th><th class="c">Tax</th><th class="r">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div class="tr"><span class="tl">Subtotal</span><span class="tv">${formatCurrency(invoice.subtotal ?? 0, sym)}</span></div>
  ${(invoice.discountAmount ?? 0) > 0 ? `<div class="tr"><span class="tl">Discount${discount.type === 'percent' ? ` (${discount.value}%)` : ''}</span><span class="tv">−${formatCurrency(invoice.discountAmount ?? 0, sym)}</span></div>` : ''}
  ${(invoice.taxTotal ?? 0) > 0 ? `<div class="tr"><span class="tl">Tax</span><span class="tv">${formatCurrency(invoice.taxTotal ?? 0, sym)}</span></div>` : ''}
  ${(invoice.shipping ?? 0) > 0 ? `<div class="tr"><span class="tl">Shipping</span><span class="tv">${formatCurrency(invoice.shipping ?? 0, sym)}</span></div>` : ''}
  <div class="tr tg"><span>Total Due</span><span class="tv">${formatCurrency(invoice.grandTotal ?? 0, sym)}</span></div>
</div>
${invoice.notes ? `<div class="notes"><div class="lbl">Notes</div><p>${esc(invoice.notes)}</p></div>` : ''}
${invoice.terms ? `<div class="notes" style="margin-top:12px"><div class="lbl">Terms</div><p>${esc(invoice.terms)}</p></div>` : ''}
<div class="footer">Finch Invoice</div>
</body></html>`;
}
