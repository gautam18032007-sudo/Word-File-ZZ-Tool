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

    const pdfUint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm',
      },
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
