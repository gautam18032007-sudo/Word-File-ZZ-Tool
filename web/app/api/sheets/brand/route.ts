import { NextRequest, NextResponse } from 'next/server';
import { fetchBrandRows, extractSheetId, SheetsError } from '@/lib/sheets';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const urlOrId = searchParams.get('sheet') ?? '';

  try {
    const rows = await fetchBrandRows(urlOrId);
    return NextResponse.json({ rows });
  } catch (e) {
    const msg = e instanceof SheetsError ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
