/**
 * PDF Engine — faithful TypeScript port of engines/pdf.py
 *
 * Converts a DOCX buffer to PDF via LibreOffice headless.
 * Reads LIBREOFFICE_PATH from environment.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export class PdfError extends Error {}

export function docxToPdf(docxBytes: Buffer, timeoutMs = 60_000): Buffer {
  const soffice = process.env.LIBREOFFICE_PATH ?? 'soffice';
  const tmpDir = os.tmpdir();
  const stamp = Date.now();
  const docxPath = path.join(tmpDir, `zz-${stamp}.docx`);
  const pdfPath = path.join(tmpDir, `zz-${stamp}.pdf`);

  try {
    fs.writeFileSync(docxPath, docxBytes);
    execFileSync(
      soffice,
      ['--headless', '--convert-to', 'pdf', '--outdir', tmpDir, docxPath],
      { timeout: timeoutMs, stdio: 'pipe' }
    );
    if (!fs.existsSync(pdfPath)) {
      throw new PdfError(
        'PDF not created. Is LibreOffice installed and LIBREOFFICE_PATH correct?'
      );
    }
    return fs.readFileSync(pdfPath);
  } catch (e) {
    if (e instanceof PdfError) throw e;
    throw new PdfError(`PDF conversion failed: ${e}`);
  } finally {
    if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
  }
}
