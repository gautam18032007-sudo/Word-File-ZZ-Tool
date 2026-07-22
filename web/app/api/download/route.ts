import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { writableDir } from '@/lib/paths';
import { docxToPdf } from '@/lib/pdf';
import { supportsLibreOffice } from '@/lib/environment';

const OUTPUT_DIR = writableDir('output');

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get('folder') ?? '';
  const filename = searchParams.get('file') ?? '';

  // Basic path traversal protection
  if (!folder || !filename || filename.includes('..') || folder.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const filePath = path.join(OUTPUT_DIR, folder, filename);
  const ext = path.extname(filename).toLowerCase();

  // If PDF requested but file doesn't exist yet on disk, attempt on-the-fly conversion from DOCX if present
  if (!fs.existsSync(filePath) && ext === '.pdf' && supportsLibreOffice()) {

    const docxName = filename.replace(/\.pdf$/i, '.docx');
    const docxPath = path.join(OUTPUT_DIR, folder, docxName);
    if (fs.existsSync(docxPath)) {
      try {
        const docxBytes = fs.readFileSync(docxPath);
        const pdfBytes = docxToPdf(docxBytes);
        fs.writeFileSync(filePath, pdfBytes);
      } catch (e) {
        console.warn(`[api/download] On-the-fly PDF conversion failed for ${filename}:`, e);
      }
    }
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);
  const contentType =
    ext === '.pdf' ? 'application/pdf' :
    ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
    ext === '.xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
    'application/octet-stream';


  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(fileBuffer.length),
    },
  });
}
