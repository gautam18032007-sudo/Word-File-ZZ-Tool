import { NextRequest, NextResponse } from 'next/server';
import { fetchRawRows, SheetsError } from '@/lib/sheets';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const urlOrId = searchParams.get('sheet') ?? '';

  try {
    const rawRows = await fetchRawRows(urlOrId, 'employee');
    if (rawRows.length === 0) {
      logger.sheet(`[API/employee] Loaded empty raw rows`);
      return NextResponse.json({ headers: [], rows: [] });
    }
    const headers = rawRows[0];
    const rows = rawRows.slice(1);
    logger.sheet(`[API/employee] Returning ${headers.length} headers and ${rows.length} rows`);
    return NextResponse.json({ headers, rows });
  } catch (e) {
    const msg = e instanceof SheetsError ? e.message : String(e);
    logger.error(`[API/employee] Error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
