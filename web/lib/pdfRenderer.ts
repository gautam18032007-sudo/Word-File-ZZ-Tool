import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { logger } from './logger';

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  let browser = null;
  try {
    logger.gen('[pdfRenderer] Launching Puppeteer Chromium...');

    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });

    // No page margin here — each template's own CSS handles its content padding.
    // This lets letterhead-style templates (e.g. LOR) bleed decorative graphics
    // to the page edge, which a fixed Puppeteer margin would otherwise clip.
    const pdfUint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });

    logger.gen('[pdfRenderer] Puppeteer PDF generated successfully.');
    return Buffer.from(pdfUint8Array);
  } catch (err: any) {
    logger.error(`[pdfRenderer] Puppeteer PDF rendering failed: ${err?.message || String(err)}`);
    throw err;
  } finally {
    if (browser) {
      await (browser as any).close().catch(() => {});
    }
  }
}
