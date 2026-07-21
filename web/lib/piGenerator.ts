import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { xlsxToPdf } from './pdf';

export interface PiGeneratorItem {
  description: string;
  billingMode?: 'month' | 'sku';
  amount: number;
  sku?: number; // Number of SKUs (used in SKU mode)
  commission: number;
  uom?: string;
  quantity: number; // Number of Months
  gstPct: number;
}

export interface PiGeneratorInput {
  piNumber: string; // e.g. "BCPL/NO/110"
  date: string; // "2026-07-21"
  buyerName: string;
  deliveryAddress?: string;
  placeOfSupply?: string;
  transporter?: string;
  destination?: string;
  contactPerson?: string;
  contactNumber?: string;
  items: PiGeneratorItem[];
}

function formatDate(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const clean = dateStr.trim();
  const matchYMD = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchYMD) {
    return `${matchYMD[3]}.${matchYMD[2]}.${matchYMD[1]}`;
  }
  const matchDMY = clean.match(/^(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{4})$/);
  if (matchDMY) {
    const dd = matchDMY[1].padStart(2, '0');
    const mm = matchDMY[2].padStart(2, '0');
    return `${dd}.${mm}.${matchDMY[3]}`;
  }
  const d = new Date(clean);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getFullYear()}`;
  }
  return clean;
}

export async function generatePiPdf(input: PiGeneratorInput): Promise<Buffer> {
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

  const templatePath = path.resolve(process.cwd(), 'templates', 'pi', 'PI-template.xlsx');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`PI template XLSX not found at ${templatePath}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const sheet = workbook.getWorksheet(1);
  if (!sheet) {
    throw new Error("Sheet 1 not found in template XLSX");
  }

  // 1. Fill Buyer & Invoice Header details
  sheet.getCell('A10').value = buyerName;
  sheet.getCell('A17').value = deliveryAddress || null;

  sheet.getCell('H9').value = piNumber;
  sheet.getCell('H10').value = formatDate(date);
  sheet.getCell('H11').value = placeOfSupply;
  sheet.getCell('H12').value = transporter || null;
  sheet.getCell('H13').value = destination || null;
  sheet.getCell('H14').value = contactPerson || null;
  sheet.getCell('H15').value = contactNumber || null;

  let totalQuantity = 0;
  let totalTaxableAmount = 0;
  let totalGstAmount = 0;

  // 2. Fill Line Items (Option A: Up to 4 rows using template slots 25 to 28)
  for (let i = 0; i < 4; i++) {
    const rowNum = 25 + i;
    const item = items[i];
    if (item) {
      const amount = Number(item.amount) || 0;
      const isSkuMode = item.billingMode === 'sku';
      const sku = isSkuMode && Number(item.sku) > 0 ? Number(item.sku) : 1;
      const commission = Number(item.commission) || 0;
      const qty = Number(item.quantity) || 0; // Months
      const gstPct = Number(item.gstPct) || 0;

      // Rate (Rs.) = Amount * SKU if SKU mode, else Amount
      const effectiveRate = isSkuMode ? amount * sku : amount;
      // GST Amount = Rate * GST% (per-month figure)
      const perMonthGst = effectiveRate * (gstPct / 100);
      // Total Amount = (GST Amount + Rate) * Months
      const rowTotal = (perMonthGst + effectiveRate) * qty;
      const rowTaxable = effectiveRate * qty;
      const rowGstTotal = perMonthGst * qty;

      totalQuantity += qty;
      totalTaxableAmount += rowTaxable;
      totalGstAmount += rowGstTotal;

      // Notes formatting
      const notesText = isSkuMode
        ? `(INR ${amount}*${sku})/Month +\n${commission}% commission`
        : `INR ${amount}/Month +\n${commission}% commission`;

      sheet.getCell(`B${rowNum}`).value = item.description;
      sheet.getCell(`C${rowNum}`).value = notesText;
      sheet.getCell(`D${rowNum}`).value = item.uom || 'NOS';
      sheet.getCell(`E${rowNum}`).value = qty;
      sheet.getCell(`F${rowNum}`).value = effectiveRate;
      sheet.getCell(`G${rowNum}`).value = gstPct / 100;
      sheet.getCell(`H${rowNum}`).value = { formula: `=F${rowNum}*G${rowNum}`, result: perMonthGst };
      sheet.getCell(`I${rowNum}`).value = { formula: `=(H${rowNum}+F${rowNum})*E${rowNum}`, result: rowTotal };
    } else {
      // Clear unused slots in rows 25-28
      sheet.getCell(`B${rowNum}`).value = null;
      sheet.getCell(`C${rowNum}`).value = null;
      sheet.getCell(`E${rowNum}`).value = null;
      sheet.getCell(`F${rowNum}`).value = null;
      sheet.getCell(`H${rowNum}`).value = { formula: `=F${rowNum}*G${rowNum}`, result: 0 };
      sheet.getCell(`I${rowNum}`).value = { formula: `=(H${rowNum}+F${rowNum})*E${rowNum}`, result: 0 };
    }
  }

  // Set vertical alignment to 'middle' (center) for all data cells in rows 25-28
  for (let r = 25; r <= 28; r++) {
    const row = sheet.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { ...cell.alignment, vertical: 'middle' };
    });
  }

  const grandTotal = totalTaxableAmount + totalGstAmount;

  // 3. Summary Rows and Tax Section Calculations (explicit formula result objects)
  sheet.getCell('E30').value = { formula: '=SUM(E25:E29)', result: totalQuantity };
  // H30 = =SUMPRODUCT(E25:E28,H25:H28)
  sheet.getCell('H30').value = { formula: '=SUMPRODUCT(E25:E28,H25:H28)', result: totalGstAmount };
  sheet.getCell('I30').value = { formula: '=SUM(I25:I28)', result: grandTotal };

  const displayGstPct = items[0]?.gstPct ?? 18;
  sheet.getCell('B32').value = Number(displayGstPct) / 100;
  sheet.getCell('C32').value = totalTaxableAmount;
  sheet.getCell('F32').value = { formula: '=C32*B32', result: totalGstAmount };
  sheet.getCell('G32').value = { formula: '=SUM(D32:F32)', result: totalGstAmount };
  sheet.getCell('I31').value = { formula: '=C32+G32', result: grandTotal };
  sheet.getCell('C34').value = { formula: '=C32+G32', result: grandTotal };

  // Write sheet changes to buffer
  const buffer = await workbook.xlsx.writeBuffer();

  // Convert XLSX buffer to PDF bytes via LibreOffice
  const pdfBytes = xlsxToPdf(Buffer.from(buffer));
  return pdfBytes;
}
