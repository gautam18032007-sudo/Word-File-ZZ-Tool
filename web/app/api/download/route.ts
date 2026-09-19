import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { writableDir } from '@/lib/paths';
import { docxToPdf } from '@/lib/pdf';
import { supportsLibreOffice } from '@/lib/environment';

const OUTPUT_DIR = writableDir('output');

const ALLOWED_FOLDERS = new Set([
  'brands',
  'employees',
  'pi',
  'lors',
  'certificates',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.xlsx',
  '.png',
]);

export async function HEAD(req: NextRequest) {
  return GET(req);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawFolder = searchParams.get('folder') ?? '';
  const rawFilename = searchParams.get('file') ?? '';

  const folder = rawFolder.trim();
  const filename = rawFilename.trim();

  // Strict folder allowlist: only known document directories are permitted
  if (!folder || !ALLOWED_FOLDERS.has(folder)) {
    return new NextResponse('Invalid folder', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

  // Filename sanitation and traversal defense
  const baseName = path.basename(filename);
  if (!filename || filename !== baseName || filename.includes('..')) {
    return new NextResponse('Invalid filename', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return new NextResponse('Invalid file type', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

  // Resolve directory and ensure strict containment within OUTPUT_DIR and folder
  const folderPath = path.resolve(OUTPUT_DIR, folder);
  const filePath = path.resolve(folderPath, filename);

  const folderRelative = path.relative(OUTPUT_DIR, folderPath);
  if (folderRelative.startsWith('..') || path.isAbsolute(folderRelative)) {
    return new NextResponse('Invalid path', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

  const fileRelative = path.relative(folderPath, filePath);
  if (fileRelative.startsWith('..') || path.isAbsolute(fileRelative) || fileRelative !== filename) {
    return new NextResponse('Invalid path', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

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
    return new NextResponse(`File not found: ${filename}`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const fileBuffer = fs.readFileSync(filePath);
  const contentType =
    ext === '.pdf' ? 'application/pdf' :
    ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
    ext === '.xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
    'application/octet-stream';

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(fileBuffer.length),
    },
  });
}
