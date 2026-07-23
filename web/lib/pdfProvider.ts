import { supportsLibreOffice, hasGotenberg } from './environment';
import { docxToPdf, xlsxToPdf } from './pdf';
import { convertViaGotenberg } from './gotenbergConvert';
import { logger } from './logger';

export interface PdfConversionResult {
  pdfBuffer: Buffer | null;
  method: 'local' | 'gotenberg' | 'none';
  durationMs: number;
  providerVersion: string;
  error?: string;
}


/**
 * Centralized Provider-Based PDF Conversion Layer
 * Unified PDF rendering service for Employee, Brand, LOR, Certificate, and Proforma Invoice documents.
 * Automatically chooses Local LibreOffice or Gotenberg Docker REST API with retry logic and detailed performance logging.
 */
export async function convertDocumentToPdf(
  fileBuffer: Buffer,
  filename: string
): Promise<PdfConversionResult> {
  const startTime = Date.now();
  const maxRetries = parseInt(process.env.PDF_RETRY_COUNT || '3', 10);
  const isXlsx = filename.endsWith('.xlsx');

  const providerVersion = process.env.PDF_PROVIDER_VERSION || '1.0';

  // 1. Local LibreOffice Environment (Local Windows/Mac Development)
  if (supportsLibreOffice()) {
    logger.gen(`[PdfProvider v${providerVersion}] Using Local LibreOffice for "${filename}"`);
    try {
      const pdfBuffer = isXlsx ? xlsxToPdf(fileBuffer) : docxToPdf(fileBuffer);
      const durationMs = Date.now() - startTime;
      logger.gen(`[PdfProvider v${providerVersion}] Local conversion succeeded for "${filename}" in ${durationMs}ms (${pdfBuffer.length} bytes).`);
      return { pdfBuffer, method: 'local', durationMs, providerVersion };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorMsg = `Local LibreOffice failed for "${filename}": ${err?.message || String(err)}`;
      logger.error(`[PdfProvider v${providerVersion}] ${errorMsg}`);
      return { pdfBuffer: null, method: 'local', durationMs, providerVersion, error: errorMsg };
    }
  }

  // 2. Gotenberg Remote Service (Vercel Serverless / Docker Production)
  if (hasGotenberg()) {
    logger.gen(`[PdfProvider v${providerVersion}] Using Gotenberg Docker Service for "${filename}" (Max Retries: ${maxRetries})`);
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        logger.gen(`[PdfProvider v${providerVersion}] Gotenberg conversion attempt ${attempt}/${maxRetries} for "${filename}"...`);
        const pdfBuffer = await convertViaGotenberg(fileBuffer, filename);
        const durationMs = Date.now() - startTime;
        logger.gen(`[PdfProvider v${providerVersion}] Gotenberg conversion succeeded for "${filename}" in ${durationMs}ms (${pdfBuffer.length} bytes).`);
        return { pdfBuffer, method: 'gotenberg', durationMs, providerVersion };
      } catch (err: any) {
        lastError = err;
        logger.error(`[PdfProvider v${providerVersion}] Gotenberg attempt ${attempt}/${maxRetries} failed for "${filename}": ${err?.message || String(err)}`);
        if (attempt < maxRetries) {
          const backoffMs = attempt * 1000;
          logger.gen(`[PdfProvider v${providerVersion}] Waiting ${backoffMs}ms before retry ${attempt + 1}...`);
          await new Promise((res) => setTimeout(res, backoffMs));
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const errorMsg = `Gotenberg PDF conversion failed for "${filename}" after ${maxRetries} attempts: ${lastError?.message || String(lastError)}`;
    logger.error(`[PdfProvider v${providerVersion}] ${errorMsg}`);
    return { pdfBuffer: null, method: 'gotenberg', durationMs, providerVersion, error: errorMsg };
  }

  // 3. No PDF Engine Available
  const durationMs = Date.now() - startTime;
  logger.gen(`[PdfProvider v${providerVersion}] Neither LibreOffice nor Gotenberg configured. Skipping PDF conversion for "${filename}".`);
  return { pdfBuffer: null, method: 'none', durationMs, providerVersion, error: 'No PDF conversion provider available.' };

}
