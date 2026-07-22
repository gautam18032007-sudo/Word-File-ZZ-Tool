import { logger } from './logger';

export async function convertViaGotenberg(fileBuffer: Buffer, filename: string): Promise<Buffer> {
  const gotenbergUrl = process.env.GOTENBERG_URL?.trim().replace(/\/+$/, '');
  if (!gotenbergUrl) {
    throw new Error('GOTENBERG_URL environment variable is not configured.');
  }

  const endpoint = `${gotenbergUrl}/forms/libreoffice/convert`;
  logger.gen(`[gotenbergConvert] Sending "${filename}" to Gotenberg at: ${endpoint}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

  try {
    const formData = new FormData();
    const fileBlob = new Blob([new Uint8Array(fileBuffer)]);
    formData.append('files', fileBlob, filename);

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => 'No response body');
      const msg = `Gotenberg conversion failed with HTTP ${response.status}: ${errText}`;
      logger.error(`[gotenbergConvert] ${msg}`);
      throw new Error(msg);
    }

    const arrayBuffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    logger.gen(`[gotenbergConvert] Successfully converted "${filename}" to PDF (${pdfBuffer.length} bytes).`);
    return pdfBuffer;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const msg = `Gotenberg conversion timed out after 45s for file "${filename}".`;
      logger.error(`[gotenbergConvert] ${msg}`);
      throw new Error(msg);
    }
    logger.error(`[gotenbergConvert] Error converting "${filename}": ${err?.message || String(err)}`);
    throw err;
  }
}
