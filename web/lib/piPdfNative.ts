import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, RGB } from 'pdf-lib';
import type { PiGeneratorInput } from './piGenerator';
import { PI_SIGNATURE_IMG, PI_LOGO_IMG } from './piAssets';

/**
 * Native pdf-lib fallback for the Proforma Invoice.
 * Visually mirrors templates/pi/PI-template.xlsx (bordered boxes, shaded
 * table header, logo, signature, terms/bank footer) so it works on Vercel
 * with zero external dependencies (no LibreOffice, no Gotenberg) when
 * convertDocumentToPdf() comes back empty. Same GST/total math as
 * piGenerator.ts — layout only.
 */

const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const HEADER_BLUE = rgb(0.686, 0.753, 0.878);
const FOOTER_YELLOW = rgb(0.988, 0.933, 0.769);
const GREY = rgb(0.4, 0.4, 0.4);

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

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
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const logoImg = await doc.embedPng(dataUrlToBytes(PI_LOGO_IMG));
  const sigImg = await doc.embedPng(dataUrlToBytes(PI_SIGNATURE_IMG));

  const marginX = 30;
  const rightX = width - marginX;
  let y = height - 15;

  // ── drawing helpers ────────────────────────────────────────────────────
  const rect = (x: number, top: number, w: number, h: number, fill?: RGB) => {
    page.drawRectangle({
      x, y: top - h, width: w, height: h,
      color: fill,
      borderColor: BLACK,
      borderWidth: 0.75,
    });
  };

  const centered = (t: string, top: number, size: number, useFont: PDFFont, color: RGB = BLACK) => {
    const w = useFont.widthOfTextAtSize(t, size);
    page.drawText(t, { x: (width - w) / 2, y: top - size, size, font: useFont, color });
  };

  const text = (t: string, x: number, top: number, size: number, useFont: PDFFont = font, color: RGB = BLACK) => {
    page.drawText(t, { x, y: top - size, size, font: useFont, color });
  };

  const wrapText = (t: string, useFont: PDFFont, size: number, maxWidth: number): string[] => {
    const words = t.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (useFont.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  // ── 1. Title bars ──────────────────────────────────────────────────────
  rect(marginX, y, rightX - marginX, 22, BLACK);
  centered('Proforma Invoice', y, 13, bold, WHITE);
  y -= 22;

  rect(marginX, y, rightX - marginX, 24, BLACK);
  centered('BOHEMIAN CURATIONS PVT LTD', y, 15, bold, WHITE);
  y -= 24;

  // ── 2. Company details band ────────────────────────────────────────────
  const companyBandTop = y;
  y -= 10;
  centered('GST NO. 07AAMCB2083P1Z5', y, 8.5, font);
  y -= 10;
  centered('Plot No. 96, Pocket-2, Jasola, New Delhi-110025', y, 8.5, font);
  y -= 10;
  centered('Mobile No. 9910605187, 9958680856', y, 8.5, font);
  y -= 10;
  centered('admin@zenzebra.in | www.zenzebra.in', y, 8.5, font, rgb(0.1, 0.25, 0.6));
  y -= 6;
  page.drawRectangle({
    x: marginX, y: y, width: rightX - marginX, height: companyBandTop - y,
    borderColor: BLACK, borderWidth: 0.75,
  });

  // ── 3. Buyer block (left) + invoice meta (right) ───────────────────────
  const buyerBoxTop = y;
  const buyerBoxH = 100;
  const buyerColW = (rightX - marginX) * 0.58;
  rect(marginX, buyerBoxTop, buyerColW, buyerBoxH); // left box
  rect(marginX + buyerColW, buyerBoxTop, (rightX - marginX) - buyerColW, buyerBoxH); // right box

  // logo, top-left of the buyer box
  const logoSize = 46;
  const logoDims = logoImg.scaleToFit(logoSize, logoSize);
  page.drawImage(logoImg, {
    x: marginX + 8, y: buyerBoxTop - 10 - logoDims.height,
    width: logoDims.width, height: logoDims.height,
  });
  text('zenzebra', marginX + 8 + logoDims.width + 6, buyerBoxTop - 30, 11, bold);

  let buyerY = buyerBoxTop - 10 - logoDims.height - 16;
  text('Buyer:', marginX + 8, buyerY, 9, bold);
  buyerY -= 13;
  text(buyerName, marginX + 8, buyerY, 10.5, bold);

  // invoice meta, right box
  const metaX = marginX + buyerColW + 10;
  let metaY = buyerBoxTop - 6;
  const metaLine = (label: string, value: string) => {
    text(label, metaX, metaY, 8.5, bold);
    text(value, metaX + 105, metaY, 8.5, font);
    metaY -= 14;
  };
  metaLine('Proforma Invoice No.', piNumber);
  metaLine('Proforma Date', date);
  metaLine('Place Of Supply', placeOfSupply);
  metaLine('Transporter', transporter);
  metaLine('Destination', destination);
  metaLine('Contact Person', contactPerson);
  metaLine('Contact Number', contactNumber);

  y = buyerBoxTop - buyerBoxH;

  // ── 4. Delivery address ─────────────────────────────────────────────────
  const addrBoxH = 38;
  rect(marginX, y, rightX - marginX, addrBoxH);
  text('Delivery Address', marginX + 8, y, 9, bold);
  const addrLines = wrapText(deliveryAddress, font, 8.5, rightX - marginX - 16).slice(0, 2);
  let addrY = y - 14;
  for (const line of addrLines) {
    text(line, marginX + 8, addrY, 8.5, font);
    addrY -= 11;
  }
  y -= addrBoxH;
  y -= 8;

  // ── 5. Item table ────────────────────────────────────────────────────────
  const cols = [
    { key: 'S. No.', x: marginX, w: 30 },
    { key: 'Decription', x: marginX + 30, w: 200 },
    { key: 'Notes / Remarks', x: marginX + 230, w: 90 },
    { key: 'UOM', x: marginX + 320, w: 45 },
    { key: 'Quantity', x: marginX + 365, w: 50 },
    { key: 'Rate (Rs.)', x: marginX + 415, w: 65 },
    { key: 'GST (Rate)', x: marginX + 480, w: 55 },
    { key: 'GST Amount (Rs.)', x: marginX + 535, w: 90 },
    { key: 'Total Amount (Rs.)', x: marginX + 625, w: rightX - (marginX + 625) },
  ];

  const headerRowH = 22;
  rect(marginX, y, rightX - marginX, headerRowH, HEADER_BLUE);
  for (const c of cols) {
    const lines = wrapText(c.key, bold, 7.5, c.w - 6);
    let hy = y - 9;
    for (const line of lines) {
      const lw = bold.widthOfTextAtSize(line, 7.5);
      page.drawText(line, { x: c.x + (c.w - lw) / 2, y: hy - 7.5, size: 7.5, font: bold });
      hy -= 9;
    }
    if (c.key !== 'S. No.' && c.key !== 'Decription') {
      // column separators
    }
  }
  y -= headerRowH;

  const rowH = 24;
  let totalQty = 0;
  let totalGstAmount = 0;
  let totalAmountSum = 0;

  const rowCount = 4;
  for (let i = 0; i < rowCount; i++) {
    const item = items[i];
    rect(marginX, y, rightX - marginX, rowH);

    if (item) {
      const amount = Number(item.amount) || 0;
      const isSkuMode = item.billingMode === 'sku';
      const sku = isSkuMode && Number(item.sku) > 0 ? Number(item.sku) : 1;
      const commission = Number(item.commission) || 0;
      const qty = Number(item.quantity) || 0;
      const gstPct = Number(item.gstPct) || 0;

      const effectiveRate = isSkuMode ? amount * sku : amount;
      const rowGst = effectiveRate * (gstPct / 100);
      const rowTaxable = effectiveRate * qty;
      const rowTotal = (effectiveRate + rowGst) * qty;

      totalQty += qty;
      totalGstAmount += rowGst;
      totalAmountSum += rowTotal;

      const notesText = isSkuMode
        ? `(INR ${amount}*${sku})/Month + ${commission}% commission`
        : `INR ${amount}/Month + ${commission}% commission`;

      const cellText = (t: string, colIdx: number, size = 8, useFont = font, align: 'left' | 'center' = 'left') => {
        const c = cols[colIdx];
        const lines = wrapText(t, useFont, size, c.w - 8);
        let ty = y - 9;
        for (const line of lines.slice(0, 2)) {
          const lx = align === 'center' ? c.x + (c.w - useFont.widthOfTextAtSize(line, size)) / 2 : c.x + 4;
          page.drawText(line, { x: lx, y: ty - size, size, font: useFont });
          ty -= size + 2;
        }
      };

      cellText(String(i + 1), 0, 8, font, 'center');
      cellText(item.description, 1);
      cellText(notesText, 2, 7.5);
      cellText(item.uom || 'NOS', 3, 8, font, 'center');
      cellText(String(qty), 4, 8, font, 'center');
      cellText(effectiveRate.toFixed(2), 5, 8, font, 'center');
      cellText(`${gstPct}%`, 6, 8, font, 'center');
      cellText(rowGst.toFixed(2), 7, 8, font, 'center');
      cellText(rowTotal.toFixed(2), 8, 8, bold, 'center');
    } else {
      const c6 = cols[6];
      const dashLabel = '18%';
      text(dashLabel, c6.x + (c6.w - font.widthOfTextAtSize(dashLabel, 8)) / 2, y - 9, 8, font);
      const c7 = cols[7];
      text('-', c7.x + (c7.w - font.widthOfTextAtSize('-', 8)) / 2, y - 9, 8, font);
      const c8 = cols[8];
      text('-', c8.x + (c8.w - font.widthOfTextAtSize('-', 8)) / 2, y - 9, 8, font);
    }
    y -= rowH;
  }

  // Totals row
  const totalsRowH = 14;
  rect(marginX, y, rightX - marginX, totalsRowH);
  text('Total Qty.', cols[3].x - 40, y - 6, 8, bold);
  text(totalQty.toFixed(0), cols[4].x + (cols[4].w - font.widthOfTextAtSize(totalQty.toFixed(0), 8)) / 2, y - 6, 8, bold);
  text(totalGstAmount.toFixed(2), cols[7].x + (cols[7].w - font.widthOfTextAtSize(totalGstAmount.toFixed(2), 8)) / 2, y - 6, 8, bold);
  text(totalAmountSum.toFixed(2), cols[8].x + (cols[8].w - font.widthOfTextAtSize(totalAmountSum.toFixed(2), 8)) / 2, y - 6, 8, bold);
  y -= totalsRowH;
  y -= 8;

  // ── 6. Tax summary (left) + signature block (right) ───────────────────
  const taxBoxTop = y;
  const taxColW = (rightX - marginX) * 0.62;
  const taxHeaders = ['TAX RATE', 'Taxable Amount', 'CGST Amt.', 'SGST Amt.', 'IGST Amt.', 'Total Tax'];
  const taxColWidths = [0.13, 0.22, 0.16, 0.16, 0.16, 0.17].map((f) => f * taxColW);
  const grandTotal = totalAmountSum;
  const isDelhi = placeOfSupply.trim().toLowerCase() === 'delhi';
  const displayGstPct = items[0]?.gstPct ?? 18;
  const cgst = isDelhi ? totalGstAmount / 2 : 0;
  const sgst = isDelhi ? totalGstAmount / 2 : 0;
  const igst = isDelhi ? 0 : totalGstAmount;
  const totalTaxable = items.reduce((acc, it) => {
    const amount = Number(it.amount) || 0;
    const isSkuMode = it.billingMode === 'sku';
    const sku = isSkuMode && Number(it.sku) > 0 ? Number(it.sku) : 1;
    const effectiveRate = isSkuMode ? amount * sku : amount;
    return acc + effectiveRate * (Number(it.quantity) || 0);
  }, 0);

  let tx = marginX;
  const taxHeaderRowH = 13;
  for (let i = 0; i < taxHeaders.length; i++) {
    rect(tx, taxBoxTop, taxColWidths[i], taxHeaderRowH);
    const lw = bold.widthOfTextAtSize(taxHeaders[i], 7);
    text(taxHeaders[i], tx + (taxColWidths[i] - lw) / 2, taxBoxTop - 3, 7, bold);
    tx += taxColWidths[i];
  }
  const taxDataRowH = 15;
  const taxDataTop = taxBoxTop - taxHeaderRowH;
  const taxValues = [
    `${displayGstPct}%`,
    totalTaxable.toFixed(2),
    cgst.toFixed(2),
    sgst.toFixed(2),
    igst.toFixed(2),
    totalGstAmount.toFixed(2),
  ];
  tx = marginX;
  for (let i = 0; i < taxValues.length; i++) {
    rect(tx, taxDataTop, taxColWidths[i], taxDataRowH);
    const lw = font.widthOfTextAtSize(taxValues[i], 7.5);
    text(taxValues[i], tx + (taxColWidths[i] - lw) / 2, taxDataTop - 4, 7.5, font);
    tx += taxColWidths[i];
  }
  const taxTotalRowH = 13;
  const taxTotalTop = taxDataTop - taxDataRowH;
  rect(marginX, taxTotalTop, taxColW - taxColWidths[taxColWidths.length - 1], taxTotalRowH);
  text('Total (Rs.)', marginX + 4, taxTotalTop - 3, 7.5, bold);
  const grandLabel = grandTotal.toFixed(2);
  text(grandLabel, marginX + taxColW - taxColWidths[taxColWidths.length - 1] - 4 - font.widthOfTextAtSize(grandLabel, 7.5), taxTotalTop - 3, 7.5, bold);
  rect(marginX + taxColW - taxColWidths[taxColWidths.length - 1], taxTotalTop, taxColWidths[taxColWidths.length - 1], taxTotalRowH);

  // Grand Total box + signature block, side by side (right side), both
  // matching the left tax-block's total height so the footer below lines up.
  const gtBoxH = taxHeaderRowH + taxDataRowH + taxTotalRowH;
  const gtAreaX = marginX + taxColW + 6;
  const gtAreaW = rightX - gtAreaX;
  const gtBoxW = gtAreaW * 0.4;
  rect(gtAreaX, taxBoxTop, gtBoxW, gtBoxH);
  text('Grand Total', gtAreaX + (gtBoxW - bold.widthOfTextAtSize('Grand Total', 8)) / 2, taxBoxTop - 6, 8, bold);
  text('(Rs.)', gtAreaX + (gtBoxW - font.widthOfTextAtSize('(Rs.)', 7)) / 2, taxBoxTop - 16, 7, font);
  const gtLabel = grandTotal.toFixed(2);
  text(gtLabel, gtAreaX + (gtBoxW - bold.widthOfTextAtSize(gtLabel, 9)) / 2, taxBoxTop - 30, 9, bold);

  const sigX = gtAreaX + gtBoxW + 6;
  let sigY = taxBoxTop - 8;
  text('For BOHEMIAN CURATIONS', sigX, sigY, 7, bold);
  sigY -= 8;
  text('PVT. LTD.', sigX, sigY, 7, bold);
  sigY -= 10;
  const sigDims = sigImg.scaleToFit(rightX - sigX - 4, 16);
  page.drawImage(sigImg, { x: sigX, y: sigY - sigDims.height, width: sigDims.width, height: sigDims.height });
  sigY -= sigDims.height + 2;
  text('(Authorised Signatory)', sigX, sigY, 6.5, font);

  y = taxTotalTop - taxTotalRowH - 8;

  // ── 7. Terms & Conditions / Bank Details footer ─────────────────────────
  const footerTop = y;
  const col2x = marginX + (rightX - marginX) / 2;
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
  const footerBoxH = 16 + Math.max(terms.length, bank.length) * 11 + 6;
  rect(marginX, footerTop, rightX - marginX, footerBoxH);
  page.drawLine({ start: { x: col2x, y: footerTop - footerBoxH }, end: { x: col2x, y: footerTop }, thickness: 0.75, color: BLACK });
  text('TERMS & CONDITIONS', marginX + 6, footerTop - 4, 8.5, bold);
  text('OUR BANK DETAILS', col2x + 6, footerTop - 4, 8.5, bold);
  let termsY = footerTop - 16;
  for (const t of terms) {
    text(t, marginX + 6, termsY, 7.5, font);
    termsY -= 11;
  }
  let bankY = footerTop - 16;
  for (const b of bank) {
    text(b, col2x + 6, bankY, 7.5, font);
    bankY -= 11;
  }
  y = footerTop - footerBoxH;

  // ── 8. Message band + contact footer ─────────────────────────────────────
  const msgLines = [
    'Hope our above offer will be best for your requirement.',
    'In case of any query /clarification is required please let us know.',
    'Thanking you for your collaboration with us.',
  ];
  const msgBoxH = msgLines.length * 11 + 6;
  rect(marginX, y, rightX - marginX, msgBoxH, rgb(0.9, 0.95, 0.98));
  let msgY = y - 10;
  for (const m of msgLines) {
    text(m, marginX + 6, msgY, 8, oblique);
    msgY -= 11;
  }
  y -= msgBoxH;

  const contactRowH = 24;
  rect(marginX, y, rightX - marginX, contactRowH, FOOTER_YELLOW);
  page.drawLine({ start: { x: col2x, y: y - contactRowH }, end: { x: col2x, y }, thickness: 0.75, color: BLACK });
  text('Contact Person & Contact Mobile No. (For Inventory Inquiry)', marginX + 6, y - 4, 7.5, bold);
  text('Mr. Surjeet: 9911624001', marginX + 6, y - 14, 7.5, font);
  text('Contact Person & Contact Mobile No. (For Proforma Inquiry)', col2x + 6, y - 4, 7.5, bold);
  text('Mr. Deepanshu: 8448402489', col2x + 6, y - 14, 7.5, font);

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
