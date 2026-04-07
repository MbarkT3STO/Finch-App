import { Invoice, AppSettings } from '../../shared/types';
import { renderInvoiceHtml } from '../../shared/invoice-html';

export function generatePreviewHtml(invoice: Partial<Invoice>, settings: AppSettings): string {
  return renderInvoiceHtml(invoice, settings);
}
