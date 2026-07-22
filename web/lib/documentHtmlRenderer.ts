import PizZip from 'pizzip';
import type { PiGeneratorInput } from './piGenerator';

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Convert rendered DOCX file (word/document.xml) directly into HTML
 * to guarantee 100% fidelity to the actual contract document text and layout.
 */
export function renderDocxToHtml(docxBuffer: Buffer): string {
  try {
    const zip = new PizZip(docxBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) return '<div></div>';
    const xml = docXmlFile.asText();

    const bodyMatch = xml.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/);
    if (!bodyMatch) return '<div></div>';
    const bodyXml = bodyMatch[1];

    let bodyHtml = '';
    const elementRegex = /<w:(p|tbl)\b[^>]*>[\s\S]*?<\/w:\1>/g;
    let match;

    while ((match = elementRegex.exec(bodyXml)) !== null) {
      const elXml = match[0];
      if (elXml.startsWith('<w:p')) {
        bodyHtml += parseParagraph(elXml);
      } else if (elXml.startsWith('<w:tbl')) {
        bodyHtml += parseTable(elXml);
      }
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm 15mm 15mm;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.45;
      color: #111827;
      margin: 0;
      padding: 0;
    }
    p {
      margin-top: 0;
      margin-bottom: 8px;
      text-align: justify;
    }
    .center {
      text-align: center;
    }
    .right {
      text-align: right;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }
    td, th {
      border: 1px solid #9ca3af;
      padding: 6px 10px;
      font-size: 9.5pt;
      vertical-align: top;
    }
    strong {
      font-weight: bold;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>
    `;
  } catch (err) {
    console.error('[renderDocxToHtml] Failed to parse DOCX XML:', err);
    return '<div></div>';
  }
}

function parseParagraph(pXml: string): string {
  let alignClass = '';
  if (pXml.includes('w:jc w:val="center"')) alignClass = ' center';
  else if (pXml.includes('w:jc w:val="right"')) alignClass = ' right';

  let pContent = '';
  const rRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let rMatch;

  while ((rMatch = rRegex.exec(pXml)) !== null) {
    const rXml = rMatch[1];
    const isBold = rXml.includes('<w:b/>') || rXml.includes('<w:b ') || rXml.includes('w:bCs');

    const tRegex = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
    let tMatch;
    let text = '';
    while ((tMatch = tRegex.exec(rXml)) !== null) {
      text += tMatch[2];
    }

    if (text) {
      const escaped = escapeHtml(text);
      if (isBold) {
        pContent += `<strong>${escaped}</strong>`;
      } else {
        pContent += escaped;
      }
    }
  }

  if (!pContent.trim()) return '<p style="margin-bottom: 4px;">&nbsp;</p>';
  return `<p class="${alignClass.trim()}">${pContent}</p>`;
}

function parseTable(tblXml: string): string {
  let tableHtml = '<table>';
  const trRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
  let trMatch;

  while ((trMatch = trRegex.exec(tblXml)) !== null) {
    tableHtml += '<tr>';
    const trXml = trMatch[1];
    const tcRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
    let tcMatch;

    while ((tcMatch = tcRegex.exec(trXml)) !== null) {
      const tcXml = tcMatch[1];
      const pMatches = tcXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || [];
      const cellText = pMatches.map(parseParagraph).join('');
      tableHtml += `<td>${cellText}</td>`;
    }
    tableHtml += '</tr>';
  }

  tableHtml += '</table>';
  return tableHtml;
}

export function renderEmployeeContractHtml(data: Record<string, string>, docxBuffer?: Buffer): string {
  if (docxBuffer) {
    return renderDocxToHtml(docxBuffer);
  }
  return renderDocxToHtml(Buffer.from(''));
}

export function renderBrandContractHtml(data: Record<string, string>, docxBuffer?: Buffer): string {
  if (docxBuffer) {
    return renderDocxToHtml(docxBuffer);
  }
  return renderDocxToHtml(Buffer.from(''));
}

export function renderLorHtml(data: Record<string, string>, docxBuffer?: Buffer): string {
  if (docxBuffer) {
    return renderDocxToHtml(docxBuffer);
  }

  const fullName = escapeHtml(data.FULL_NAME || '');
  const dateStr = escapeHtml(data.DATE || '');
  const finalDraft = escapeHtml(data.FINAL_DRAFT || '').replace(/\n/g, '<br>');
  const signatoryName = escapeHtml(data.SIGNATORY_NAME || 'Tanmay Jain');
  const signatoryRole = escapeHtml(data.SIGNATORY_ROLE || 'Co-Founder');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Letter of Recommendation — ${fullName}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1a1a1a; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #c3a77d; padding-bottom: 10px; margin-bottom: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h2 style="margin:0; color:#2e2e2e;">ZenZebra</h2>
      <p style="margin:2px 0 0 0; color:#6b7280; font-size:10pt;">Letter of Recommendation</p>
    </div>
    <div style="text-align:right; font-size:10pt; color:#4b5563;">
      <p style="margin:0;">Date: <strong>${dateStr}</strong></p>
      <p style="margin:2px 0 0 0;">Candidate: <strong>${fullName}</strong></p>
    </div>
  </div>

  <p style="margin-top:20px;"><strong>To Whom It May Concern:</strong></p>
  <div style="margin-top:16px; text-align:justify;">${finalDraft}</div>

  <div style="margin-top:48px;">
    <p style="margin:0;">Best Regards</p>
    <br><br><br>
    <p style="margin:0; font-weight:bold;">${signatoryName}</p>
    <p style="margin:2px 0 0 0; color:#4b5563;">${signatoryRole}</p>
  </div>
</body>
</html>
  `;
}

export function renderProformaInvoiceHtml(input: PiGeneratorInput): string {
  const {
    piNumber,
    date,
    buyerName,
    deliveryAddress = '',
    placeOfSupply = 'Delhi',
    transporter = '',
    destination = '',
    contactPerson = '',
    contactNumber = '',
    items,
  } = input;

  let totalTaxable = 0;
  let totalGst = 0;

  const itemRowsHtml = items.map((item, idx) => {
    const amount = Number(item.amount) || 0;
    const isSkuMode = item.billingMode === 'sku';
    const sku = isSkuMode && Number(item.sku) > 0 ? Number(item.sku) : 1;
    const effectiveRate = isSkuMode ? amount * sku : amount;
    const qty = Number(item.quantity) || 0;
    const gstPct = Number(item.gstPct) || 0;
    const rowGst = effectiveRate * (gstPct / 100);
    const rowTaxable = effectiveRate * qty;
    const rowTotal = rowTaxable + rowGst;

    totalTaxable += rowTaxable;
    totalGst += rowGst;

    const notesText = isSkuMode
      ? `(INR ${amount}*${sku})/Month +<br>${item.commission || 0}% commission`
      : `INR ${amount}/Month +<br>${item.commission || 0}% commission`;

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${escapeHtml(item.description)}</td>
        <td style="font-size: 8.5pt; color: #4b5563;">${notesText}</td>
        <td style="text-align: center;">${escapeHtml(item.uom || 'NOS')}</td>
        <td style="text-align: center;">${qty}</td>
        <td style="text-align: right;">${effectiveRate.toFixed(2)}</td>
        <td style="text-align: right;">${gstPct}%</td>
        <td style="text-align: right;">${rowGst.toFixed(2)}</td>
        <td style="text-align: right; font-weight: bold;">${rowTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const grandTotal = totalTaxable + totalGst;
  const isDelhi = placeOfSupply.trim().toLowerCase() === 'delhi';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Proforma Invoice — ${escapeHtml(piNumber)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body {
      font-family: Arial, sans-serif;
      font-size: 9.5pt;
      color: #1f2937;
      margin: 0;
      padding: 0;
    }
    .header-box {
      border: 1.5px solid #2563eb;
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 16px;
      background-color: #f8fafc;
    }
    .company-title {
      font-size: 16pt;
      font-weight: bold;
      color: #1e3a8a;
      text-align: center;
      margin-bottom: 2px;
    }
    .company-sub {
      text-align: center;
      font-size: 8.5pt;
      color: #64748b;
      margin-bottom: 12px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
    }
    .info-table td {
      vertical-align: top;
      padding: 4px 8px;
      font-size: 9pt;
      border: none;
    }
    .main-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .main-table th {
      background-color: #1e40af;
      color: #ffffff;
      padding: 8px 6px;
      font-size: 9pt;
      border: 1px solid #1e40af;
    }
    .main-table td {
      border: 1px solid #cbd5e1;
      padding: 6px;
      font-size: 9pt;
    }
    .tax-table {
      width: 65%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    .tax-table th {
      background-color: #f1f5f9;
      border: 1px solid #94a3b8;
      padding: 5px;
      font-size: 8.5pt;
    }
    .tax-table td {
      border: 1px solid #cbd5e1;
      padding: 5px;
      text-align: center;
      font-size: 8.5pt;
    }
    .grand-total {
      font-size: 12pt;
      font-weight: bold;
      color: #0f172a;
      text-align: right;
      margin-top: 12px;
      padding: 8px;
      background-color: #f1f5f9;
      border: 1px solid #cbd5e1;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="company-title">PROFORMA INVOICE</div>
    <div class="company-sub">Bohemian Curations Private Limited (ZenZebra) | CIN: U46411DL2023PTC424632</div>
    <table class="info-table">
      <tr>
        <td style="width: 50%;">
          <strong>Billed To:</strong><br>
          <span style="font-size: 11pt; font-weight: bold; color: #0f172a;">${escapeHtml(buyerName)}</span><br>
          ${escapeHtml(deliveryAddress)}<br>
          ${contactPerson ? 'Attn: ' + escapeHtml(contactPerson) : ''} ${contactNumber ? '(' + escapeHtml(contactNumber) + ')' : ''}
        </td>
        <td style="width: 50%; text-align: right;">
          <strong>Invoice No:</strong> <span style="font-weight: bold; color: #1e40af;">${escapeHtml(piNumber)}</span><br>
          <strong>Date:</strong> ${escapeHtml(date)}<br>
          <strong>Place of Supply:</strong> ${escapeHtml(placeOfSupply)}<br>
          ${transporter ? '<strong>Transporter:</strong> ' + escapeHtml(transporter) + '<br>' : ''}
          ${destination ? '<strong>Destination:</strong> ' + escapeHtml(destination) : ''}
        </td>
      </tr>
    </table>
  </div>

  <table class="main-table">
    <thead>
      <tr>
        <th style="width: 4%;">#</th>
        <th style="width: 32%;">Description</th>
        <th style="width: 18%;">Notes</th>
        <th style="width: 6%;">UOM</th>
        <th style="width: 6%;">Qty</th>
        <th style="width: 10%; text-align: right;">Rate (INR)</th>
        <th style="width: 6%; text-align: right;">GST%</th>
        <th style="width: 9%; text-align: right;">GST Amt</th>
        <th style="width: 9%; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHtml}
      <tr style="font-weight: bold; background-color: #f8fafc;">
        <td colspan="4" style="text-align: right;">TOTAL</td>
        <td></td>
        <td colspan="2"></td>
        <td style="text-align: right;">${totalGst.toFixed(2)}</td>
        <td style="text-align: right;">${grandTotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
    <table class="tax-table">
      <thead>
        <tr>
          <th>Taxable Amt</th>
          <th>CGST</th>
          <th>SGST</th>
          <th>IGST</th>
          <th>Total Tax</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>₹${totalTaxable.toFixed(2)}</td>
          <td>${isDelhi ? '₹' + (totalGst / 2).toFixed(2) : '-'}</td>
          <td>${isDelhi ? '₹' + (totalGst / 2).toFixed(2) : '-'}</td>
          <td>${!isDelhi ? '₹' + totalGst.toFixed(2) : '-'}</td>
          <td style="font-weight: bold;">₹${totalGst.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="grand-total" style="width: 30%;">
      Grand Total: ₹${grandTotal.toFixed(2)}
    </div>
  </div>

  <div style="margin-top: 30px; font-size: 8.5pt; color: #475569; display: flex; justify-content: space-between;">
    <div>
      <strong>Bank Details:</strong><br>
      Bank: HDFC Bank<br>
      Account Name: Bohemian Curations Private Limited<br>
      IFSC Code: HDFC0000003
    </div>
    <div style="text-align: right;">
      For <strong>Bohemian Curations Private Limited</strong><br><br><br>
      Authorized Signatory
    </div>
  </div>
</body>
</html>
  `;
}
