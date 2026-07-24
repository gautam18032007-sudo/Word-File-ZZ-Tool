import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PiGeneratorInput } from './piGenerator';

/**
 * Native pdf-lib fallback for the Proforma Invoice.
 * Renders the same fields as templates/pi/PI-template.xlsx so it works on
 * Vercel with zero external dependencies (no LibreOffice, no Gotenberg)
 * when convertDocumentToPdf() comes back empty.
 */
export async function generatePiPdfNative(input: PiGeneratorInput): Promise<Buffer> {
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

  const doc = await PDFDocument.create();
  const page = doc.addPage([841.89, 595.28]); // A4 landscape — invoice table is wide
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const marginX = 40;
  let y = height - 40;

  const text = (t: string, x: number, size: number, useFont = font, color = rgb(0.05, 0.05, 0.05)) => {
    page.drawText(t, { x, y, size, font: useFont, color });
  };

  // Header: company details (left) + invoice title (right)
  text('BOHEMIAN CURATIONS PVT LTD', marginX, 13, bold);
  y -= 16;
  text('GST NO. 07AAMCB2083P1Z5', marginX, 9, font);
  y -= 12;
  text('Plot No. 96, Pocket-2, Jasola, New Delhi-110025', marginX, 9, font);
  y -= 12;
  text('Mobile No. 9910605187, 9958680856', marginX, 9, font);
  y -= 12;
  text('admin@zenzebra.in | www.zenzebra.in', marginX, 9, font);

  const titleSize = 18;
  const title = 'PROFORMA INVOICE';
  const titleWidth = bold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, { x: width - marginX - titleWidth, y: height - 40, size: titleSize, font: bold });

  y -= 24;
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
  y -= 20;

  // Buyer block (left) + invoice meta (right)
  const buyerTop = y;
  text('Buyer:', marginX, 9.5, bold);
  y -= 13;
  text(buyerName, marginX, 11, bold);
  y -= 14;
  text(`Delivery Address: ${deliveryAddress}`, marginX, 9, font);
  y -= 12;
  text(`Contact: ${contactPerson}${contactNumber ? ' (' + contactNumber + ')' : ''}`, marginX, 9, font);

  const metaX = width - marginX - 260;
  let metaY = buyerTop;
  const metaLine = (label: string, value: string) => {
    page.drawText(label, { x: metaX, y: metaY, size: 9.5, font: bold });
    page.drawText(value, { x: metaX + 100, y: metaY, size: 9.5, font });
    metaY -= 13;
  };
  metaLine('Invoice No:', piNumber);
  metaLine('Date:', date);
  metaLine('Place of Supply:', placeOfSupply);
  if (transporter) metaLine('Transporter:', transporter);
  if (destination) metaLine('Destination:', destination);
  y = Math.min(y, metaY);

  y -= 20;

  // Item table
  const cols = [
    { key: '#', x: marginX, w: 20 },
    { key: 'Description', x: marginX + 20, w: 230 },
    { key: 'UOM', x: marginX + 250, w: 45 },
    { key: 'Qty', x: marginX + 295, w: 40 },
    { key: 'Rate (INR)', x: marginX + 335, w: 80 },
    { key: 'GST %', x: marginX + 415, w: 50 },
    { key: 'GST Amount', x: marginX + 465, w: 90 },
    { key: 'Total Amount', x: marginX + 555, w: 100 },
  ];

  const tableTop = y;
  for (const c of cols) {
    page.drawText(c.key, { x: c.x, y, size: 9, font: bold });
  }
  y -= 6;
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 0.75, color: rgb(0.5, 0.5, 0.5) });
  y -= 14;

  let totalTaxable = 0;
  let totalGst = 0;

  items.forEach((item, idx) => {
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

    const rowY = y;
    page.drawText(String(idx + 1), { x: cols[0].x, y: rowY, size: 8.5, font });
    page.drawText(item.description.slice(0, 60), { x: cols[1].x, y: rowY, size: 8.5, font });
    page.drawText(item.uom || 'NOS', { x: cols[2].x, y: rowY, size: 8.5, font });
    page.drawText(String(qty), { x: cols[3].x, y: rowY, size: 8.5, font });
    page.drawText(effectiveRate.toFixed(2), { x: cols[4].x, y: rowY, size: 8.5, font });
    page.drawText(`${gstPct}%`, { x: cols[5].x, y: rowY, size: 8.5, font });
    page.drawText(rowGst.toFixed(2), { x: cols[6].x, y: rowY, size: 8.5, font });
    page.drawText(rowTotal.toFixed(2), { x: cols[7].x, y: rowY, size: 8.5, font: bold });
    y -= 16;
  });

  y -= 4;
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 0.75, color: rgb(0.5, 0.5, 0.5) });
  y -= 14;

  const grandTotal = totalTaxable + totalGst;
  page.drawText('TOTAL', { x: cols[4].x - 40, y, size: 9.5, font: bold });
  page.drawText(totalGst.toFixed(2), { x: cols[6].x, y, size: 9.5, font: bold });
  page.drawText(grandTotal.toFixed(2), { x: cols[7].x, y, size: 9.5, font: bold });
  y -= 24;

  // Tax summary
  const isDelhi = placeOfSupply.trim().toLowerCase() === 'delhi';
  page.drawText('Tax Summary:', { x: marginX, y, size: 9.5, font: bold });
  y -= 14;
  page.drawText(`Taxable Amount: Rs. ${totalTaxable.toFixed(2)}`, { x: marginX, y, size: 9, font });
  y -= 12;
  if (isDelhi) {
    page.drawText(`CGST: Rs. ${(totalGst / 2).toFixed(2)}   SGST: Rs. ${(totalGst / 2).toFixed(2)}`, { x: marginX, y, size: 9, font });
  } else {
    page.drawText(`IGST: Rs. ${totalGst.toFixed(2)}`, { x: marginX, y, size: 9, font });
  }
  y -= 12;
  page.drawText(`Total Tax Amount: Rs. ${totalGst.toFixed(2)}`, { x: marginX, y, size: 9, font });
  y -= 16;
  page.drawText(`Grand Total: Rs. ${grandTotal.toFixed(2)}`, { x: marginX, y, size: 11, font: bold });
  y -= 26;

  // Terms & bank details
  const col2x = marginX + (width - marginX * 2) / 2;
  const termsTop = y;
  page.drawText('TERMS & CONDITIONS', { x: marginX, y, size: 9.5, font: bold });
  page.drawText('OUR BANK DETAILS', { x: col2x, y, size: 9.5, font: bold });
  y -= 14;
  const terms = [
    '1. The Rates are for Display.',
    '2. Freight : Your scope',
    '3. Payment terms : Against this PI, 100% Advance',
    '4. GST : Extra applicable as shown above',
  ];
  const bank = [
    'ACCOUNT NAME : BOHEMIAN CURATIONS PRIVATE LIMITED',
    'Bank Name - ICICI Bank',
    'Account No. - 113405500373',
    'IFSC CODE : ICIC0001134',
  ];
  let termsY = y;
  for (const t of terms) {
    page.drawText(t, { x: marginX, y: termsY, size: 8.5, font });
    termsY -= 12;
  }
  let bankY = termsTop - 14;
  for (const b of bank) {
    page.drawText(b, { x: col2x, y: bankY, size: 8.5, font });
    bankY -= 12;
  }
  y = Math.min(termsY, bankY) - 20;

  page.drawText('For BOHEMIAN CURATIONS PVT. LTD.', { x: width - marginX - 200, y, size: 9.5, font: bold });
  y -= 30;
  page.drawText('(Authorised Signatory)', { x: width - marginX - 200, y, size: 9, font });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
