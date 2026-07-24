import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { GenerateLorOptions } from './lorGenerator';

/**
 * Native pdf-lib fallback PDF generator for Letter of Recommendation (LOR).
 * Enables 100% native PDF rendering on Vercel serverless functions
 * without requiring any external LibreOffice or Gotenberg server!
 */
export async function generateLorPdfNative(options: GenerateLorOptions): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions in points
  const { width, height } = page.getSize();

  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const margin = 54; // 0.75 inch
  let y = height - margin;

  // 1. Header Title: "LETTER OF RECOMMENDATION"
  page.drawText('LETTER OF RECOMMENDATION', {
    x: margin,
    y,
    size: 18,
    font: timesBold,
    color: rgb(0.12, 0.16, 0.23), // Dark Navy
  });

  y -= 25;

  // Horizontal Rule
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1.5,
    color: rgb(0.2, 0.25, 0.35),
  });

  y -= 30;

  // 2. Date and Reference Number
  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  page.drawText(`Date: ${todayStr}`, {
    x: margin,
    y,
    size: 10,
    font: timesRoman,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText(`Ref: ${options.lorNumber}`, {
    x: width - margin - 120,
    y,
    size: 10,
    font: timesRoman,
    color: rgb(0.3, 0.3, 0.3),
  });

  y -= 35;

  // 3. Salutation
  page.drawText('TO WHOM IT MAY CONCERN', {
    x: margin,
    y,
    size: 12,
    font: timesBold,
    color: rgb(0.12, 0.16, 0.23),
  });

  y -= 30;

  // 4. Recommendation Body Text
  const bodyText = options.finalDraft || `This is to certify that ${options.fullName} was associated with ZenZebra as a ${options.designation} in the ${options.department} department.`;
  const paragraphs = bodyText.split(/\r?\n/).map(p => p.trim()).filter(Boolean);

  const maxWidth = width - (margin * 2);
  const fontSize = 10.5;
  const lineHeight = 16;

  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = timesRoman.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth) {
        page.drawText(currentLine, {
          x: margin,
          y,
          size: fontSize,
          font: timesRoman,
          color: rgb(0.15, 0.15, 0.15),
        });
        y -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      page.drawText(currentLine, {
        x: margin,
        y,
        size: fontSize,
        font: timesRoman,
        color: rgb(0.15, 0.15, 0.15),
      });
      y -= lineHeight;
    }

    y -= 10; // Space between paragraphs
  }

  y = Math.min(y - 20, 180); // Ensure authority block fits at bottom

  // 5. Authority Block / Signatory
  page.drawText('Sincerely,', {
    x: margin,
    y,
    size: 11,
    font: timesRoman,
    color: rgb(0.2, 0.2, 0.2),
  });

  y -= 45;

  page.drawText(options.signatoryName || 'Tanmay Jain', {
    x: margin,
    y,
    size: 11,
    font: timesBold,
    color: rgb(0.12, 0.16, 0.23),
  });

  y -= 15;

  page.drawText(options.signatoryRole || 'Co-Founder', {
    x: margin,
    y,
    size: 10,
    font: timesRoman,
    color: rgb(0.4, 0.4, 0.4),
  });

  y -= 14;

  page.drawText('ZenZebra Contract Tool', {
    x: margin,
    y,
    size: 10,
    font: timesRoman,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Footer Accent Bar
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: 8,
    color: rgb(0.12, 0.16, 0.23),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
