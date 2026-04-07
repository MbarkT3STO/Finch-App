import { Invoice, AppSettings } from '../shared/types';
import { renderInvoiceHtml } from '../shared/invoice-html';

export function generateInvoiceHtml(invoice: Invoice, settings: AppSettings): string {
  return renderInvoiceHtml(invoice, settings);
}
