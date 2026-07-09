import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { writableDir } from '@/lib/paths';

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
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType =
    ext === '.pdf' ? 'application/pdf' :
    ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
    'application/octet-stream';

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(fileBuffer.length),
    },
  });
}
