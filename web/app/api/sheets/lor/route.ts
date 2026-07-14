/**
 * GET /api/sheets/lor
 *
 * Standalone CSV fetcher for the LOR Google Response Sheet.
 * DOES NOT import from lib/sheets.ts — fully isolated, per AI_AGENT_RULES_V2.md §5.
 *
 * Priority order for sheet ID:
 *  1. `sheet` query param (URL or raw ID)
 *  2. GOOGLE_LOR_SHEET_ID environment variable
 *
 * Returns:
 *  200  { success: true, count: number, rows: string[][] }
 *  400  { error: string }  — no sheet ID provided, or sheet not accessible
 *  500  { error: string }  — network error
 */
import { NextRequest, NextResponse } from 'next/server';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Extract a spreadsheet ID from a full Google Sheets URL, or return the string
 *  as-is if it already looks like a bare ID. Returns '' for empty/invalid input. */
function extractSheetId(urlOrId: string): string {
  const text = (urlOrId ?? '').trim();
  if (!text) return '';
  // Pull ID from URL: /d/<ID>/
  const m = text.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  // Treat as bare ID if it looks like one (long alphanumeric, no slashes)
  if (text.length > 20 && !text.includes('/')) return text;
  return '';
}

/** Parse RFC 4180 CSV text into a 2-D string array.
 *  Handles quoted fields, embedded commas, and CRLF/LF line endings. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (line.trim() === '') continue;
    const cells: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++; // skip escaped quote
        } else if (ch === '"') {
          inQuote = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuote = true;
        } else if (ch === ',') {
          cells.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

// ─── Normalise a header string for alias matching ──────────────────────────────
// Trim, lowercase, collapse whitespace and punctuation to single spaces.
function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Return the column index whose normalised header matches any of the given aliases.
 *  Returns -1 if not found. */
function findColIndex(headers: string[], aliases: string[]): number {
  const normHeaders = headers.map(normaliseHeader);
  for (const alias of aliases) {
    const idx = normHeaders.indexOf(normaliseHeader(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Safe cell read — returns '' for missing columns. */
function cell(row: string[], idx: number): string {
  return idx < 0 || idx >= row.length ? '' : (row[idx] ?? '').trim();
}

// ─── Column alias definitions (from 04_GOOGLE_SHEET_MAPPING.md) ───────────────

const ALIASES = {
  timestamp:        ['timestamp'],
  employeeName:     ['full name', 'name', 'employee name', 'intern name'],
  email:            ['personal email id', 'email', 'email address', 'email id'],
  phone:            ['contact number', 'phone', 'mobile', 'contact', 'phone number'],
  department:       ['department / team', 'department', 'team', 'dept'],
  designation:      ['designation / role', 'designation', 'role', 'position'],
  joiningDate:      ['date of joining', 'joining date', 'start date', 'doj'],
  lastWorkingDate:  ['last working date', 'lwd', 'exit date', 'end date'],
  employmentType:   ['employment type', 'type of employment', 'intern/employee'],
  responsibilities: [
    'briefly describe your role and key responsibilities during your tenure',
    'role and key responsibilities',
    'responsibilities',
    'role description',
  ],
  projects: [
    'key projects/tasks handled during your tenure',
    'projects',
    'key projects',
    'tasks handled',
    'projects handled',
  ],
  strengths: [
    'what qualities or strengths would you like highlighted in your lor?',
    'strengths',
    'qualities',
    'strengths to highlight',
  ],
  additionalInfo: [
    'any additional information you would like us to mention in your documents?',
    'additional information',
    'additional notes',
    'any other info',
  ],
  declaration: ['employee declaration', 'declaration', 'i agree', 'accept'],
} as const;

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sheetParam  = (searchParams.get('sheet') ?? '').trim();
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Resolve sheet ID: query param first, then env var
  const rawId = sheetParam || (process.env.GOOGLE_LOR_SHEET_ID ?? '');
  const sheetId = extractSheetId(rawId);

  if (!sheetId) {
    return NextResponse.json(
      {
        error:
          'No Google Sheet ID provided for LOR.\n' +
          'Either pass ?sheet=<url> or set GOOGLE_LOR_SHEET_ID in .env.',
      },
      { status: 400 }
    );
  }

  // Optionally append GID (specific tab)
  const gidFromParam = rawId.match(/[#&?]gid=([0-9]+)/)?.[1];
  const gidFromEnv   = (process.env.GOOGLE_LOR_SHEET_GID ?? '').trim();
  const gid          = gidFromParam ?? gidFromEnv;
  const gidSuffix    = gid ? `&gid=${gid}` : '';

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidSuffix}`;

  // Prevent Next.js route cache (same behaviour as existing sheet routes)
  const fetchOptions: RequestInit = forceRefresh
    ? { cache: 'no-store' }
    : { next: { revalidate: 60 } };

  let csvText: string;
  try {
    const res = await fetch(csvUrl, fetchOptions);
    const contentType = res.headers.get('content-type') ?? '';

    if (res.status !== 200 || !contentType.includes('text/csv')) {
      return NextResponse.json(
        {
          error:
            'Google Sheet is not publicly accessible.\n\n' +
            'Open the sheet.\n' +
            'Click Share.\n' +
            'General Access.\n' +
            "Select 'Anyone with the link'.\n" +
            'Set Viewer permission.\n\n' +
            'Then try again.',
        },
        { status: 400 }
      );
    }

    csvText = await res.text();
  } catch (e) {
    return NextResponse.json(
      { error: `Could not reach Google Sheets: ${String(e)}` },
      { status: 500 }
    );
  }

  // Parse CSV
  const allRows = parseCsv(csvText);
  if (allRows.length === 0) {
    return NextResponse.json({ success: true, count: 0, rows: [] });
  }

  const rawHeaders = allRows[0];
  const dataRows   = allRows.slice(1);

  // Build column index map using alias matching
  const colIdx = {
    timestamp:        findColIndex(rawHeaders, ALIASES.timestamp as unknown as string[]),
    employeeName:     findColIndex(rawHeaders, ALIASES.employeeName as unknown as string[]),
    email:            findColIndex(rawHeaders, ALIASES.email as unknown as string[]),
    phone:            findColIndex(rawHeaders, ALIASES.phone as unknown as string[]),
    department:       findColIndex(rawHeaders, ALIASES.department as unknown as string[]),
    designation:      findColIndex(rawHeaders, ALIASES.designation as unknown as string[]),
    joiningDate:      findColIndex(rawHeaders, ALIASES.joiningDate as unknown as string[]),
    lastWorkingDate:  findColIndex(rawHeaders, ALIASES.lastWorkingDate as unknown as string[]),
    employmentType:   findColIndex(rawHeaders, ALIASES.employmentType as unknown as string[]),
    responsibilities: findColIndex(rawHeaders, ALIASES.responsibilities as unknown as string[]),
    projects:         findColIndex(rawHeaders, ALIASES.projects as unknown as string[]),
    strengths:        findColIndex(rawHeaders, ALIASES.strengths as unknown as string[]),
    additionalInfo:   findColIndex(rawHeaders, ALIASES.additionalInfo as unknown as string[]),
    declaration:      findColIndex(rawHeaders, ALIASES.declaration as unknown as string[]),
  };

  // Map each data row to a structured object; skip rows with no name
  const rows = dataRows
    .map((r) => ({
      timestamp:        cell(r, colIdx.timestamp),
      employeeName:     cell(r, colIdx.employeeName),
      email:            cell(r, colIdx.email),
      phone:            cell(r, colIdx.phone),
      department:       cell(r, colIdx.department),
      designation:      cell(r, colIdx.designation),
      joiningDate:      cell(r, colIdx.joiningDate),
      lastWorkingDate:  cell(r, colIdx.lastWorkingDate),
      employmentType:   cell(r, colIdx.employmentType),
      responsibilities: cell(r, colIdx.responsibilities),
      projects:         cell(r, colIdx.projects),
      strengths:        cell(r, colIdx.strengths),
      additionalInfo:   cell(r, colIdx.additionalInfo),
      declaration:      cell(r, colIdx.declaration),
    }))
    .filter((r) => r.employeeName !== '');

  return NextResponse.json({ success: true, count: rows.length, rows });
}
