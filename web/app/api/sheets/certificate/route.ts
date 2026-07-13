import { NextRequest, NextResponse } from 'next/server';
import { fetchRawRows, SheetsError } from '@/lib/sheets';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    const sheet = searchParams.get("sheet") ?? "";
    // Sourced automatically from GOOGLE_CERTIFICATE_SHEET_ID configured in .env or override
    const rawRows = await fetchRawRows(sheet || null, 'certificate', forceRefresh);
    if (rawRows.length === 0) {
      logger.sheet(`[API/certificate] Loaded empty raw rows`);
      return NextResponse.json({ headers: [], rows: [] });
    }
    const headers = rawRows[0];
    const rows = rawRows.slice(1);
    logger.sheet(`[API/certificate] Returning ${headers.length} headers and ${rows.length} rows`);
    return NextResponse.json({ headers, rows });
  } catch (e) {
    const msg = e instanceof SheetsError ? e.message : String(e);
    logger.error(`[API/certificate] Error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
