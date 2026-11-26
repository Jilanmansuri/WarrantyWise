import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { DocumentRecord, Product, RepairRecord, ResaleSummary } from '../types';
import { formatCurrency, formatReadableDate } from '../utils/dateUtils';

function escapeHtml(value?: string | number | null): string {
  if (value === undefined || value === null) return '—';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusPillHtml(status: string): string {
  const color =
    status === 'Active' || status === 'Completed'
      ? '#15803D'
      : status === 'Expiring Soon' || status === 'Pending' || status === 'In Progress'
        ? '#B45309'
        : '#B91C1C';
  const bg =
    status === 'Active' || status === 'Completed'
      ? '#DCFCE7'
      : status === 'Expiring Soon' || status === 'Pending' || status === 'In Progress'
        ? '#FEF3C7'
        : '#FEE2E2';
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;color:${color};background:${bg};">${escapeHtml(status)}</span>`;
}

function buildProductSectionHtml(
  product: Product,
  repairs: RepairRecord[],
  documents: DocumentRecord[]
): string {
  const repairRows =
    repairs.length > 0
      ? repairs
          .map(
            (r) => `
          <tr>
            <td>${escapeHtml(formatReadableDate(r.repairDate))}</td>
            <td>${escapeHtml(r.problemDescription)}</td>
            <td>${escapeHtml(r.repairCenter)}</td>
            <td>${escapeHtml(formatCurrency(r.repairCost, product.currency))}</td>
            <td>${statusPillHtml(r.repairStatus)}</td>
          </tr>`
          )
          .join('')
      : `<tr><td colspan="5" style="color:#64748B;text-align:center;">No repair records logged.</td></tr>`;

  const docRows =
    documents.length > 0
      ? documents
          .map(
            (d) => `
          <tr>
            <td>${escapeHtml(d.title)}</td>
            <td>${escapeHtml(d.type)}</td>
            <td>${escapeHtml(d.fileName)}</td>
            <td>${escapeHtml(formatReadableDate(d.createdAt))}</td>
          </tr>`
          )
          .join('')
      : `<tr><td colspan="4" style="color:#64748B;text-align:center;">No associated documents uploaded.</td></tr>`;

  return `
    <div class="section-card">
      <div class="product-header">
        <div>
          <h2 style="margin:0;color:#0F295C;">${escapeHtml(product.productName)}</h2>
          <p style="margin:4px 0 0;color:#475569;">${escapeHtml(product.brand)} • ${escapeHtml(product.category)}</p>
        </div>
        <div>${statusPillHtml(product.warrantyMetrics.warrantyStatus)}</div>
      </div>

      <h3>Product &amp; Purchase Information</h3>
      <table class="kv-table">
        <tr><th>Brand</th><td>${escapeHtml(product.brand)}</td><th>Model Number</th><td>${escapeHtml(product.modelNumber || '—')}</td></tr>
        <tr><th>Serial Number</th><td>${escapeHtml(product.serialNumber || '—')}</td><th>Seller</th><td>${escapeHtml(product.sellerName || '—')}</td></tr>
        <tr><th>Purchase Date</th><td>${escapeHtml(formatReadableDate(product.purchaseDate))}</td><th>Purchase Price</th><td>${escapeHtml(formatCurrency(product.purchasePrice, product.currency))}</td></tr>
        <tr><th>Invoice #</th><td>${escapeHtml(product.invoiceNumber || '—')}</td><th>Claim Readiness</th><td><strong>${product.claimReadiness.score}/100</strong> (${escapeHtml(product.claimReadiness.level)})</td></tr>
      </table>

      <h3>Warranty Coverage</h3>
      <table class="kv-table">
        <tr><th>Start Date</th><td>${escapeHtml(formatReadableDate(product.warrantyStartDate))}</td><th>Expiry Date</th><td>${escapeHtml(formatReadableDate(product.warrantyEndDate))}</td></tr>
        <tr><th>Duration</th><td>${product.warrantyDurationMonths} months</td><th>Remaining</th><td>${product.warrantyMetrics.remainingDays} days</td></tr>
      </table>

      <h3>Repair History</h3>
      <table class="data-table">
        <thead>
          <tr><th>Date</th><th>Problem</th><th>Repair Center</th><th>Cost</th><th>Status</th></tr>
        </thead>
        <tbody>${repairRows}</tbody>
      </table>

      <h3>Associated Documents</h3>
      <table class="data-table">
        <thead>
          <tr><th>Title</th><th>Type</th><th>File Name</th><th>Uploaded</th></tr>
        </thead>
        <tbody>${docRows}</tbody>
      </table>
    </div>
  `;
}

function wrapReportDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0F172A; margin: 28px; background: #FFFFFF; }
        .top-bar { border-bottom: 3px solid #0F295C; padding-bottom: 12px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:flex-end; }
        .brand { font-size: 22px; font-weight: 800; color: #0F295C; }
        .meta { font-size: 12px; color: #64748B; }
        h3 { font-size: 14px; color: #0F295C; margin: 16px 0 8px; border-left: 3px solid #1E40AF; padding-left: 8px; }
        .section-card { border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin-bottom: 20px; page-break-inside: avoid; }
        .product-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 12px; }
        th, td { border: 1px solid #E2E8F0; padding: 7px 9px; text-align: left; }
        .kv-table th { background: #F8FAFC; color: #475569; width: 18%; font-weight: 600; }
        .data-table th { background: #0F295C; color: #FFFFFF; font-weight: 600; }
        .summary-grid { display: flex; gap: 12px; margin-bottom: 20px; }
        .summary-box { flex: 1; background: #F4F6FA; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; }
        .summary-val { font-size: 20px; font-weight: 700; color: #0F295C; }
        .summary-lbl { font-size: 11px; color: #475569; }
        .footer { margin-top: 24px; font-size: 11px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="top-bar">
        <div>
          <div class="brand">WarrantyWise</div>
          <div class="meta">${escapeHtml(title)}</div>
        </div>
        <div class="meta">Generated ${escapeHtml(new Date().toUTCString())}</div>
      </div>
      ${bodyHtml}
      <div class="footer">
        Generated by WarrantyWise Smart Product Warranty &amp; Repair Management. Claim readiness scores are informational and do not guarantee manufacturer approval.
      </div>
    </body>
  </html>`;
}

export async function generateSingleProductPdf(params: {
  product: Product;
  repairs: RepairRecord[];
  documents: DocumentRecord[];
}): Promise<string> {
  const html = wrapReportDocument(
    `Product Warranty Report — ${params.product.brand} ${params.product.productName}`,
    buildProductSectionHtml(params.product, params.repairs, params.documents)
  );
  return exportHtmlToPdf(html, `warrantywise-${params.product.id}.pdf`);
}

export async function generateMultiProductPdf(params: {
  products: Product[];
  repairs: RepairRecord[];
  documents: DocumentRecord[];
}): Promise<string> {
  const active = params.products.filter((p) => p.warrantyMetrics.warrantyStatus === 'Active').length;
  const expiring = params.products.filter(
    (p) => p.warrantyMetrics.warrantyStatus === 'Expiring Soon'
  ).length;
  const expired = params.products.filter(
    (p) => p.warrantyMetrics.warrantyStatus === 'Expired'
  ).length;

  const summaryHtml = `
    <div class="summary-grid">
      <div class="summary-box"><div class="summary-val">${params.products.length}</div><div class="summary-lbl">Total Products</div></div>
      <div class="summary-box"><div class="summary-val">${active}</div><div class="summary-lbl">Active</div></div>
      <div class="summary-box"><div class="summary-val">${expiring}</div><div class="summary-lbl">Expiring Soon</div></div>
      <div class="summary-box"><div class="summary-val">${expired}</div><div class="summary-lbl">Expired</div></div>
    </div>
  `;

  const sections = params.products
    .map((product) => {
      const prodRepairs = params.repairs.filter((r) => {
        const pid = typeof r.productId === 'string' ? r.productId : r.productId?._id;
        return pid === product.id;
      });
      const prodDocs = params.documents.filter((d) => {
        const pid = typeof d.productId === 'string' ? d.productId : d.productId?._id;
        return pid === product.id;
      });
      return buildProductSectionHtml(product, prodRepairs, prodDocs);
    })
    .join('');

  const html = wrapReportDocument(
    `Portfolio Warranty & Repair Report (${params.products.length} Products)`,
    `${summaryHtml}${sections}`
  );
  return exportHtmlToPdf(html, `warrantywise-portfolio-${Date.now()}.pdf`);
}

export async function generateResalePacketPdf(summary: ResaleSummary): Promise<string> {
  const { product, warrantyMetrics, repairs, maintenances, attachedInvoices, disclaimer } = summary;
  const repairRows =
    repairs.length > 0
      ? repairs
          .map(
            (r) => `
          <tr>
            <td>${escapeHtml(formatReadableDate(r.repairDate))}</td>
            <td>${escapeHtml(r.problemDescription)}</td>
            <td>${escapeHtml(r.repairCenter)}</td>
            <td>${statusPillHtml(r.repairStatus)}</td>
          </tr>`
          )
          .join('')
      : `<tr><td colspan="4" style="color:#64748B;text-align:center;">No repairs recorded.</td></tr>`;

  const maintRows =
    maintenances.length > 0
      ? maintenances
          .map(
            (m) => `
          <tr>
            <td>${escapeHtml(m.title)}</td>
            <td>${escapeHtml(m.serviceType)}</td>
            <td>${escapeHtml(m.lastServiceDate ? formatReadableDate(m.lastServiceDate) : '—')}</td>
            <td>${m.history?.length || 0} visit(s)</td>
          </tr>`
          )
          .join('')
      : `<tr><td colspan="4" style="color:#64748B;text-align:center;">No maintenance schedules logged.</td></tr>`;

  const invRows =
    attachedInvoices.length > 0
      ? attachedInvoices
          .map(
            (d) => `
          <tr>
            <td>${escapeHtml(d.title)}</td>
            <td>${escapeHtml(d.type)}</td>
            <td>${escapeHtml(d.fileName)}</td>
          </tr>`
          )
          .join('')
      : `<tr><td colspan="3" style="color:#64748B;text-align:center;">No attached invoices.</td></tr>`;

  const body = `
    <div class="section-card">
      <div class="product-header">
        <div>
          <h2 style="margin:0;color:#0F295C;">${escapeHtml(product.brand)} ${escapeHtml(product.productName)}</h2>
          <p style="margin:4px 0 0;color:#475569;">Verified Resale History Packet • ${escapeHtml(product.category)}</p>
        </div>
        <div>${statusPillHtml(warrantyMetrics.warrantyStatus)}</div>
      </div>

      <h3>Product &amp; Purchase Summary</h3>
      <table class="kv-table">
        <tr><th>Brand / Model</th><td>${escapeHtml(product.brand)} ${escapeHtml(product.modelNumber || '')}</td><th>Masked Serial</th><td>${escapeHtml(product.serialNumber || '—')}</td></tr>
        <tr><th>Purchase Date</th><td>${escapeHtml(formatReadableDate(product.purchaseDate))}</td><th>Product Age</th><td>${summary.productAgeMonths} month(s) (${summary.productAgeDays} days)</td></tr>
        <tr><th>Original Price</th><td>${escapeHtml(formatCurrency(product.purchasePrice, product.currency))}</td><th>Seller</th><td>${escapeHtml(product.sellerName || '—')}</td></tr>
        <tr><th>Remaining Warranty</th><td>${warrantyMetrics.remainingDays} day(s)</td><th>Transferable</th><td>${product.warrantyTransferable ? 'Yes (Transferable)' : 'Check manufacturer terms'}</td></tr>
      </table>

      <h3>Repair History (${repairs.length})</h3>
      <table class="data-table">
        <thead><tr><th>Date</th><th>Issue</th><th>Service Center</th><th>Status</th></tr></thead>
        <tbody>${repairRows}</tbody>
      </table>

      <h3>Maintenance History (${maintenances.length})</h3>
      <table class="data-table">
        <thead><tr><th>Schedule</th><th>Type</th><th>Last Service</th><th>Completed Visits</th></tr></thead>
        <tbody>${maintRows}</tbody>
      </table>

      <h3>Recorded Invoices &amp; Supporting Documents</h3>
      <table class="data-table">
        <thead><tr><th>Document</th><th>Category</th><th>File Name</th></tr></thead>
        <tbody>${invRows}</tbody>
      </table>

      <p style="margin-top:14px;padding:10px;background:#FEF3C7;color:#92400E;border-radius:6px;font-size:11px;">
        <strong>Disclaimer:</strong> ${escapeHtml(disclaimer)}
      </p>
    </div>
  `;

  const html = wrapReportDocument(
    `Product Resale Packet — ${product.brand} ${product.productName}`,
    body
  );
  return exportHtmlToPdf(html, `warrantywise-resale-${product.id}.pdf`);
}

async function exportHtmlToPdf(html: string, filename: string): Promise<string> {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return 'printed';
  }

  const { uri } = await Print.printToFileAsync({ html });
  const targetFile = new File(Paths.document, filename);
  const tempFile = new File(uri);
  if (targetFile.exists) {
    targetFile.delete();
  }
  tempFile.copy(targetFile);
  return targetFile.uri;
}

export async function sharePdfFile(uri: string, dialogTitle = 'Share Warranty Report') {
  if (Platform.OS === 'web' || uri === 'printed') return;
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle,
    UTI: 'com.adobe.pdf',
  });
}
