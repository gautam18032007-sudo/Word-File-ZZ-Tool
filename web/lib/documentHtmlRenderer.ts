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

const COMMON_CSS = `
  body {
    font-family: Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.5;
    margin: 0;
    padding: 20px;
    font-size: 13px;
  }
  h1, h2, h3 {
    margin-top: 0;
    color: #111827;
  }
  .header-table, .content-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  .content-table th, .content-table td {
    border: 1px solid #d1d5db;
    padding: 8px 12px;
    text-align: left;
  }
  .content-table th {
    background-color: #f3f4f6;
    font-weight: bold;
  }
  .section-title {
    font-weight: bold;
    font-size: 15px;
    border-bottom: 2px solid #374151;
    padding-bottom: 4px;
    margin-top: 24px;
    margin-bottom: 12px;
  }
  .paragraph {
    margin-bottom: 14px;
    text-align: justify;
  }
  .signature-block {
    margin-top: 40px;
  }
`;

export function renderEmployeeContractHtml(data: Record<string, string>): string {
  const empName = escapeHtml(data.EMPLOYEE_NAME || '');
  const fatherName = escapeHtml(data.FATHER_NAME || '');
  const address = escapeHtml(data.EMPLOYEE_ADDRESS || '');
  const designation = escapeHtml(data.DESIGNATION || '');
  const department = escapeHtml(data.DEPARTMENT || '');
  const joiningDate = escapeHtml(data.JOINING_DATE || '');
  const monthlyCtc = escapeHtml(data.MONTHLY_CTC || '');
  const annualCtc = escapeHtml(data.ANNUAL_CTC || '');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Employee Employment Agreement</title>
  <style>
    ${COMMON_CSS}
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="font-size: 20px; text-transform: uppercase;">Employment Agreement</h1>
    <p style="font-size: 12px; color: #4b5563;">ZenZebra</p>
  </div>

  <p class="paragraph">
    This Employment Agreement is entered into on <strong>${joiningDate}</strong> by and between <strong>ZenZebra</strong> and <strong>${empName}</strong>, S/D of <strong>${fatherName}</strong>, residing at <strong>${address}</strong>.
  </p>

  <div class="section-title">1. Position & Role</div>
  <p class="paragraph">
    The Employee is appointed as <strong>${designation}</strong> in the <strong>${department}</strong> Department. The employment commences on <strong>${joiningDate}</strong>.
  </p>

  <div class="section-title">2. Compensation</div>
  <p class="paragraph">
    The Annual Total Cost to Company (CTC) for the Employee is <strong>Rs. ${annualCtc}</strong> (Monthly CTC: <strong>Rs. ${monthlyCtc}</strong>). The detailed salary breakup is specified in Annexure A attached herewith.
  </p>

  <div class="section-title">Annexure A — Salary Breakup</div>
  <table class="content-table">
    <thead>
      <tr>
        <th>Salary Component</th>
        <th>Monthly (INR)</th>
        <th>Annual (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Basic Salary</td><td>${escapeHtml(data.ANN_BASIC || '')}</td><td>${escapeHtml(data.ANN_BASIC_ANNUAL || '')}</td></tr>
      <tr><td>HRA</td><td>${escapeHtml(data.ANN_HRA || '')}</td><td>${escapeHtml(data.ANN_HRA_ANNUAL || '')}</td></tr>
      <tr><td>Conveyance Allowance</td><td>${escapeHtml(data.ANN_CONVEYANCE || '')}</td><td>${escapeHtml(data.ANN_CONVEYANCE_ANNUAL || '')}</td></tr>
      <tr><td>PF Employer Contribution</td><td>${escapeHtml(data.ANN_PF_EMPLOYER || '')}</td><td>${escapeHtml(data.ANN_PF_EMPLOYER_ANNUAL || '')}</td></tr>
      <tr><td>Special Allowance</td><td>${escapeHtml(data.ANN_SPECIAL_ALLOWANCE || '')}</td><td>${escapeHtml(data.ANN_SPECIAL_ALLOWANCE_ANNUAL || '')}</td></tr>
      <tr style="font-weight: bold; background-color: #f9fafb;"><td>Total CTC</td><td>${escapeHtml(data.ANN_TOTAL_CTC || '')}</td><td>${escapeHtml(data.ANN_TOTAL_CTC_ANNUAL || '')}</td></tr>
      <tr><td>PF Employee Contribution</td><td>${escapeHtml(data.ANN_PF_EMPLOYEE || '')}</td><td>${escapeHtml(data.ANN_PF_EMPLOYEE_ANNUAL || '')}</td></tr>
      <tr style="font-weight: bold; background-color: #f3f4f6;"><td>Salary In Hand</td><td>${escapeHtml(data.ANN_SALARY_IN_HAND || '')}</td><td>${escapeHtml(data.ANN_SALARY_IN_HAND_ANNUAL || '')}</td></tr>
    </tbody>
  </table>

  <div class="signature-block">
    <div style="float: left; width: 45%;">
      <p>For <strong>ZenZebra</strong></p>
      <br><br>
      <p>Authorized Signatory</p>
    </div>
    <div style="float: right; width: 45%;">
      <p>Employee Signature</p>
      <br><br>
      <p><strong>${empName}</strong></p>
    </div>
    <div style="clear: both;"></div>
  </div>
</body>
</html>
  `;
}

export function renderBrandContractHtml(data: Record<string, string>): string {
  const legalName = escapeHtml(data.LEGAL_NAME || '');
  const brandCategory = escapeHtml(data.BRAND_CATEGORY || '');
  const address = escapeHtml(data.ADDRESS || '');
  const effectiveDate = escapeHtml(data.EFFECTIVE_DATE || '');
  const locationText = escapeHtml(data.LOCATION || '');
  const feeClause = escapeHtml(data.FEE_CLAUSE || '');
  const commissionClause = escapeHtml(data.COMMISSION_CLAUSE || '');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Brand Services Agreement</title>
  <style>
    ${COMMON_CSS}
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="font-size: 20px; text-transform: uppercase;">Brand Services Agreement</h1>
    <p style="font-size: 12px; color: #4b5563;">ZenZebra</p>
  </div>

  <p class="paragraph">
    This Agreement is made on <strong>${effectiveDate}</strong> by and between <strong>ZenZebra</strong> and <strong>${legalName}</strong> (Brand Category: <strong>${brandCategory}</strong>), having address at <strong>${address}</strong>.
  </p>

  <div class="section-title">1. Location Setup</div>
  <p class="paragraph">
    Services will be provided for: <strong>${locationText}</strong>.
  </p>

  <div class="section-title">2. Commercial Terms</div>
  <p class="paragraph">
    ${feeClause}
  </p>
  <p class="paragraph">
    ${commissionClause}
  </p>

  <div class="signature-block">
    <div style="float: left; width: 45%;">
      <p>For <strong>ZenZebra</strong></p>
      <br><br>
      <p>Authorized Signatory</p>
    </div>
    <div style="float: right; width: 45%;">
      <p>For <strong>${legalName}</strong></p>
      <br><br>
      <p>Authorized Signatory</p>
    </div>
    <div style="clear: both;"></div>
  </div>
</body>
</html>
  `;
}

export function renderLorHtml(data: Record<string, string>): string {
  const fullName = escapeHtml(data.FULL_NAME || '');
  const designation = escapeHtml(data.DESIGNATION || '');
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
    ${COMMON_CSS}
    .lor-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #c3a77d;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
  </style>
</head>
<body>
  <div class="lor-header">
    <div>
      <h2 style="margin: 0; color: #2e2e2e; font-size: 18px;">ZenZebra</h2>
      <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 12px;">Letter of Recommendation</p>
    </div>
    <div style="text-align: right; font-size: 12px; color: #4b5563;">
      <p style="margin: 0;">Date: <strong>${dateStr}</strong></p>
      <p style="margin: 4px 0 0 0;">Candidate: <strong>${fullName}</strong></p>
    </div>
  </div>

  <div class="paragraph" style="margin-top: 20px;">
    <strong>To Whom It May Concern:</strong>
  </div>

  <div class="paragraph" style="margin-top: 16px; line-height: 1.6;">
    ${finalDraft}
  </div>

  <div style="margin-top: 48px;">
    <p style="margin: 0;">Best Regards</p>
    <br><br><br>
    <p style="margin: 0; font-weight: bold;">${signatoryName}</p>
    <p style="margin: 2px 0 0 0; color: #4b5563;">${signatoryRole}</p>
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

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>${escapeHtml(item.uom || 'NOS')}</td>
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
    ${COMMON_CSS}
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="font-size: 22px; margin-bottom: 4px;">PROFORMA INVOICE</h1>
    <p style="margin: 0; color: #4b5563;">Bohemian Curations Private Limited (ZenZebra)</p>
  </div>

  <table class="header-table" style="border: 1px solid #d1d5db; padding: 12px; background-color: #f9fafb;">
    <tr>
      <td style="width: 50%; vertical-align: top;">
        <strong>Billed To:</strong><br>
        <span style="font-size: 14px; font-weight: bold;">${escapeHtml(buyerName)}</span><br>
        ${escapeHtml(deliveryAddress)}<br>
        Contact: ${escapeHtml(contactPerson)} ${contactNumber ? '(' + escapeHtml(contactNumber) + ')' : ''}
      </td>
      <td style="width: 50%; vertical-align: top; text-align: right;">
        <strong>Invoice No:</strong> ${escapeHtml(piNumber)}<br>
        <strong>Date:</strong> ${escapeHtml(date)}<br>
        <strong>Place of Supply:</strong> ${escapeHtml(placeOfSupply)}<br>
        ${transporter ? '<strong>Transporter:</strong> ' + escapeHtml(transporter) + '<br>' : ''}
        ${destination ? '<strong>Destination:</strong> ' + escapeHtml(destination) : ''}
      </td>
    </tr>
  </table>

  <table class="content-table">
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 35%;">Description</th>
        <th style="width: 8%;">UOM</th>
        <th style="width: 8%;">Qty</th>
        <th style="width: 12%; text-align: right;">Rate (INR)</th>
        <th style="width: 8%; text-align: right;">GST %</th>
        <th style="width: 12%; text-align: right;">GST Amount</th>
        <th style="width: 12%; text-align: right;">Total Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHtml}
      <tr style="font-weight: bold; background-color: #f3f4f6;">
        <td colspan="3" style="text-align: right;">TOTAL</td>
        <td style="text-align: center;"></td>
        <td colspan="2"></td>
        <td style="text-align: right;">${totalGst.toFixed(2)}</td>
        <td style="text-align: right;">${grandTotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">Tax Summary Table</div>
  <table class="content-table" style="width: 60%;">
    <thead>
      <tr>
        <th>Taxable Amount</th>
        <th>CGST</th>
        <th>SGST</th>
        <th>IGST</th>
        <th>Total Tax Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Rs. ${totalTaxable.toFixed(2)}</td>
        <td>${isDelhi ? 'Rs. ' + (totalGst / 2).toFixed(2) : '-'}</td>
        <td>${isDelhi ? 'Rs. ' + (totalGst / 2).toFixed(2) : '-'}</td>
        <td>${!isDelhi ? 'Rs. ' + totalGst.toFixed(2) : '-'}</td>
        <td style="font-weight: bold;">Rs. ${totalGst.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 24px; font-size: 15px; font-weight: bold; text-align: right;">
    Grand Total: Rs. ${grandTotal.toFixed(2)}
  </div>
</body>
</html>
  `;
}
