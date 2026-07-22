/**
 * Google Sheets Engine — faithful TypeScript port of engines/sheets.py
 *
 * Two auth modes, tried in this exact order (mirrors Python version):
 *
 *  1. PUBLIC CSV export
 *     Works when the sheet sharing is "Anyone with the link" (Viewer).
 *     No credentials needed. This is the fast path.
 *
 *  2. SERVICE ACCOUNT fallback
 *     Used when the CSV fetch fails (private / Workspace sheet).
 *     Requires credentials.json in the project root
 *     (c:\Users\pc\Documents\CONTRACT TOOL\credentials.json).
 *     The service account must be granted Viewer access to the sheet.
 *
 * No OAuth. No user login. No Google Cloud Console billing required for
 * Sheets API reads at this scale.
 */
import fs from 'fs';
import path from 'path';
import type { BrandRow, EmployeeRow } from './types';
import { logger } from './logger';

const CREDENTIALS_PATH = path.resolve(process.cwd(), '..', 'credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

export class SheetsError extends Error {}
export class SheetsAuthError extends SheetsError {}

// ─── Sheet ID extraction ───────────────────────────────────────────────────────

/** Pull the spreadsheet ID out of a pasted Google Sheets URL, or pass an ID through. */
export function extractSheetId(urlOrId: string): string {
  const text = (urlOrId ?? '').trim();
  if (!text) return '';
  const m = text.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (text.length > 20 && !text.includes('/')) return text;
  return '';
}

// ─── Mode 1: Public CSV export ────────────────────────────────────────────────

async function getRowsPublicCsv(sheetIdOrUrl: string): Promise<string[][]> {
  const sheetId = extractSheetId(sheetIdOrUrl);
  if (!sheetId) {
    throw new SheetsError('Invalid Google Sheets URL or ID.');
  }

  let gidParam = '';
  const gidMatch = sheetIdOrUrl.match(/[#&?]gid=([0-9]+)/);
  if (gidMatch) {
    gidParam = `&gid=${gidMatch[1]}`;
  }

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch (e) {
    throw new SheetsError(`Could not reach Google Sheets: ${e}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (res.status !== 200 || !contentType.includes('text/csv')) {
    throw new SheetsAuthError(
      'Sheet is not publicly accessible.\n' +
      'Open the sheet → Share → General access → "Anyone with the link" (Viewer).\n' +
      `(Sheet ID: ${sheetId})`
    );
  }

  return parseCsv(await res.text());
}

// ─── Mode 2: Service account (env var, or credentials.json for local dev) ────

/**
 * Reads the service-account key from GOOGLE_SERVICE_ACCOUNT_JSON (raw JSON or
 * base64-encoded JSON) first — this is the only option that works on Vercel,
 * since a gitignored credentials.json file is never part of the deployment.
 * Falls back to the local credentials.json file for local dev convenience.
 */
function readServiceAccountKey(): Record<string, unknown> | null {
  const envVal = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (envVal) {
    const raw = envVal.trim().startsWith('{')
      ? envVal
      : Buffer.from(envVal, 'base64').toString('utf-8');
    return JSON.parse(raw);
  }
  if (fs.existsSync(CREDENTIALS_PATH)) {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  }
  return null;
}

async function getRowsServiceAccount(sheetId: string): Promise<string[][]> {
  let keyFile: Record<string, unknown> | null;
  try {
    keyFile = readServiceAccountKey();
  } catch (e) {
    throw new SheetsError(`Could not read service account key: ${e}`);
  }
  if (!keyFile) {
    throw new SheetsError(
      'Sheet is not public and no service account key was found.\n' +
      'Either set the sheet\'s sharing to "Anyone with the link" (Viewer),\n' +
      'or set GOOGLE_SERVICE_ACCOUNT_JSON (recommended for Vercel), ' +
      `or place a service account key at:\n  ${CREDENTIALS_PATH} (local dev only)`
    );
  }

  // Dynamic import — only pulled in when a service account key is available
  const { google } = await import('googleapis');

  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth });

  let result: any;
  try {
    result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A:Z',
    });
  } catch (e) {
    throw new SheetsError(`Google Sheets API error: ${e}`);
  }

  return (result.data.values ?? []) as string[][];
}

// ─── Unified fetch with fallback ──────────────────────────────────────────────

async function getRows(sheetIdOrUrl: string, allowAuthFallback: boolean): Promise<{ rows: string[][]; mode: 'PUBLIC' | 'SERVICE_ACCOUNT' }> {
  try {
    const rows = await getRowsPublicCsv(sheetIdOrUrl);
    return { rows, mode: 'PUBLIC' };
  } catch (publicErr) {
    if (!allowAuthFallback || !(publicErr instanceof SheetsAuthError)) {
      throw publicErr;
    }
    const keyFile = readServiceAccountKey();
    if (!keyFile) {
      throw new SheetsError(
        'Certificate sheet is private, and GOOGLE_SERVICE_ACCOUNT_JSON is not configured.\n' +
        'Please set GOOGLE_SERVICE_ACCOUNT_JSON env var or place credentials.json at project root.'
      );
    }
    const cleanId = extractSheetId(sheetIdOrUrl);
    const rows = await getRowsServiceAccount(cleanId);
    return { rows, mode: 'SERVICE_ACCOUNT' };
  }
}

// Best-effort memory cache for serverless environments
interface CacheEntry {
  rows: string[][];
  timestamp: number;
  mode: 'PUBLIC' | 'SERVICE_ACCOUNT';
}
const certificateCache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 60 * 1000;

export async function fetchRawRows(
  sheetIdOrUrl: string | null,
  type: 'brand' | 'employee' | 'certificate',
  forceRefresh = false
): Promise<string[][]> {
  const envVar = 
    type === 'brand' ? 'GOOGLE_BRAND_SHEET_ID' : 
    type === 'employee' ? 'GOOGLE_EMPLOYEE_SHEET_ID' : 'GOOGLE_CERTIFICATE_SHEET_ID';
  const sid = (sheetIdOrUrl || '').trim() || process.env[envVar] || '';

  logger.sheet(`[fetchRawRows] Requesting ${type} sheet. Input: "${sheetIdOrUrl || ''}", Default env: "${process.env[envVar] || ''}"`);

  if (!sid) {
    const errMsg = `No Google Sheet URL or ID provided for ${type}.`;
    logger.error(`[fetchRawRows] ${errMsg}`);
    throw new SheetsError(errMsg);
  }

  const cleanId = extractSheetId(sid);
  logger.sheet(`[fetchRawRows] Extracted sheet ID: "${cleanId}"`);

  let gid = '0';
  const gidMatch = sid.match(/[#&?]gid=([0-9]+)/);
  if (gidMatch) {
    gid = gidMatch[1];
  }
  const cacheKey = `${cleanId}:${gid}`;

  if (type === 'certificate') {
    if (forceRefresh) {
      logger.sheet(`[fetchRawRows] [CERTIFICATE] Force refreshing cache for sheet ${cleanId.slice(0, 8)}...`);
      delete certificateCache[cacheKey];
    } else {
      const cached = certificateCache[cacheKey];
      const now = Date.now();
      if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
        logger.sheet(`[fetchRawRows] Cache hit for certificate sheet (mode: ${cached.mode}). Returning ${cached.rows.length} rows.`);
        return cached.rows;
      }
    }
  }

  try {
    const { rows, mode } = await getRows(sid, type === 'certificate');
    logger.sheet(`[fetchRawRows] [CERTIFICATE] Loaded sheet. SheetID=${cleanId.slice(0, 8)}... Mode=${mode}, Rows=${rows.length}`);
    
    if (type === 'certificate') {
      certificateCache[cacheKey] = {
        rows,
        timestamp: Date.now(),
        mode,
      };
    }
    return rows;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`[fetchRawRows] Failed to fetch sheet rows: ${errMsg}`);
    throw e;
  }
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\r' && next === '\n') {
        row.push(field); rows.push(row); row = []; field = ''; i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field); rows.push(row); row = []; field = '';
      } else { field += ch; }
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}

// ─── Column helpers ───────────────────────────────────────────────────────────

function findColWithAliases(headers: string[], envKey: string, aliases: string[]): number {
  const envVal = process.env[envKey]?.trim();
  const searchList = envVal ? [envVal, ...aliases] : aliases;

  const norm = (s: string) => s.trim().toLowerCase().replace(/[\(\)\_\-\.]/g, ' ').replace(/\s+/g, ' ');

  // Level 1: Exact or cleaned match
  let idx = headers.findIndex(h => searchList.some(a => norm(h) === norm(a)));
  if (idx >= 0) return idx;

  // Level 2: Substring inclusion match
  idx = headers.findIndex(h => searchList.some(a => {
    const nh = norm(h);
    const na = norm(a);
    return nh.length > 2 && na.length > 2 && (nh.includes(na) || na.includes(nh));
  }));
  return idx;
}

function cell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return '';
  return row[idx] ?? '';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchBrandRows(sheetIdOrUrl: string | null): Promise<BrandRow[]> {
  const sid = (sheetIdOrUrl || '').trim() || process.env.GOOGLE_BRAND_SHEET_ID || '';
  if (!sid) throw new SheetsError('No Brand Sheet ID provided.');

  const { rows } = await getRows(sid, false);
  if (rows.length === 0) return [];

  const headers = rows[0].map(String);
  const c = {
    legalName: findColWithAliases(headers, 'BRAND_HEADER_LEGAL_NAME', [
      'Legal Name ( to be written in contract )',
      'Legal Name (to be written in contract)',
      'Legal Name',
      'Brand Name',
      'Brand Name / Legal Name',
      'Company Name',
      'Brand',
      'Name of Brand',
      'Name of Company',
      'Legal Company Name',
      'Name'
    ]),
    brandCategory: findColWithAliases(headers, 'BRAND_HEADER_BRAND_CATEGORY', [
      'Products Category ( to be written in contract )',
      'Products Category (to be written in contract)',
      'Products Category',
      'Product Category',
      'Brand Category',
      'Category',
      'Type of Product',
      'Product Type',
      'Products'
    ]),
    address: findColWithAliases(headers, 'BRAND_HEADER_ADDRESS', [
      'Address ( to be written in contract )',
      'Address (to be written in contract)',
      'Address',
      'Registered Address',
      'Office Address',
      'Business Address',
      'Location'
    ]),
    email: findColWithAliases(headers, 'BRAND_HEADER_EMAIL', [
      'Email Address',
      'Email ID',
      'Email',
      'Contact Email',
      'Mail'
    ]),
    phone: findColWithAliases(headers, 'BRAND_HEADER_PHONE', [
      'Phone Number',
      'Phone',
      'Contact Number',
      'Contact No',
      'Mobile Number',
      'Mobile',
      'Phone No'
    ]),
    contactPerson: findColWithAliases(headers, 'BRAND_HEADER_CONTACT_PERSON', [
      'Contact Person Name',
      'Contact Person',
      'Authorized Signatory',
      'Person Name',
      'Name of Contact Person',
      'Contact Name',
      'Contact'
    ]),
  };

  return rows.slice(1)
    .map((r, i) => {
      const legalName = cell(r, c.legalName).trim();
      const brandCategory = cell(r, c.brandCategory).trim();
      const address = cell(r, c.address).trim();
      const email = cell(r, c.email).trim();
      const phone = cell(r, c.phone).trim();
      const contactPerson = cell(r, c.contactPerson).trim();

      const fallbackName = legalName || (r[1] ? r[1].trim() : r[0] ? r[0].trim() : '');

      return {
        index: i + 2,
        legalName: fallbackName,
        brandCategory,
        address,
        email,
        phone,
        contactPerson,
      };
    })
    .filter(b => b.legalName || b.brandCategory || b.address);
}


export async function fetchEmployeeRows(sheetIdOrUrl: string | null): Promise<EmployeeRow[]> {
  const sid = (sheetIdOrUrl || '').trim() || process.env.GOOGLE_EMPLOYEE_SHEET_ID || '';
  if (!sid) throw new SheetsError('No Employee Sheet ID provided.');

  const { rows } = await getRows(sid, false);
  if (rows.length === 0) return [];

  const headers = rows[0].map(String);
  const c = {
    name:        findColWithAliases(headers, 'EMPLOYEE_HEADER_NAME',        ['Full Name', 'Name', 'Employee Name']),
    fatherName:  findColWithAliases(headers, 'EMPLOYEE_HEADER_FATHER_NAME', ["Father's Name", 'Father Name', 'Fathers Name']),
    address:     findColWithAliases(headers, 'EMPLOYEE_HEADER_ADDRESS',     ['Address', 'Registered Address', 'Location']),
    phone:       findColWithAliases(headers, 'EMPLOYEE_HEADER_PHONE',       ['Phone Number', 'Phone', 'Mobile Number', 'Contact Number']),
    email:       findColWithAliases(headers, 'EMPLOYEE_HEADER_EMAIL',       ['Email Address', 'Email ID', 'Email', 'Mail']),
    pan:         findColWithAliases(headers, 'EMPLOYEE_HEADER_PAN',         ['PAN Number', 'PAN', 'PAN No']),
    aadhar:      findColWithAliases(headers, 'EMPLOYEE_HEADER_AADHAR',      ['Aadhar Number', 'Aadhar', 'Aadhaar Number', 'Aadhaar']),
    designation: findColWithAliases(headers, 'EMPLOYEE_HEADER_DESIGNATION', ['Designation', 'Role', 'Position']),
    department:  findColWithAliases(headers, 'EMPLOYEE_HEADER_DEPARTMENT',  ['Department', 'Team', 'Dept']),
    gender:      findColWithAliases(headers, 'EMPLOYEE_HEADER_GENDER',      ['Gender', 'Sex']),
  };


  return rows.slice(1)
    .map((r, i) => ({
      index: i + 2,
      name:        cell(r, c.name).trim(),
      fatherName:  cell(r, c.fatherName),
      address:     cell(r, c.address),
      phone:       cell(r, c.phone),
      email:       cell(r, c.email),
      pan:         cell(r, c.pan),
      aadhar:      cell(r, c.aadhar),
      designation: cell(r, c.designation),
      department:  cell(r, c.department),
      gender:      cell(r, c.gender),
    }))
    .filter(e => e.name);
}
