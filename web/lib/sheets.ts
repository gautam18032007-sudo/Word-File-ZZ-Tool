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

const CREDENTIALS_PATH = path.resolve(process.cwd(), '..', 'credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

export class SheetsError extends Error {}

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
    throw new SheetsError(
      'Sheet is not publicly accessible.\n' +
      'Open the sheet → Share → General access → "Anyone with the link" (Viewer).\n' +
      `(Sheet ID: ${sheetId})`
    );
  }

  return parseCsv(await res.text());
}

// ─── Mode 2: Service account (credentials.json) ───────────────────────────────

async function getRowsServiceAccount(sheetId: string): Promise<string[][]> {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new SheetsError(
      'Sheet is not public and no credentials.json was found.\n' +
      'Either set the sheet\'s sharing to "Anyone with the link" (Viewer),\n' +
      `or place a service account key at:\n  ${CREDENTIALS_PATH}`
    );
  }

  // Dynamic import — only pulled in when credentials.json exists
  const { google } = await import('googleapis');

  let keyFile: Record<string, unknown>;
  try {
    keyFile = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  } catch (e) {
    throw new SheetsError(`Could not read credentials.json: ${e}`);
  }

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

async function getRows(sheetIdOrUrl: string): Promise<string[][]> {
  try {
    return await getRowsPublicCsv(sheetIdOrUrl);
  } catch (publicErr) {
    // Only fall back to service account if the CSV fetch failed (not a network error)
    if (!(publicErr instanceof SheetsError)) throw publicErr;
    try {
      const cleanId = extractSheetId(sheetIdOrUrl);
      return await getRowsServiceAccount(cleanId);
    } catch {
      // Re-throw the original public error — it has the better user-facing message
      throw publicErr;
    }
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

function findCol(headers: string[], envKey: string, fallback: string): number {
  const target = (process.env[envKey] ?? fallback).trim().toLowerCase();
  return headers.findIndex(h => h.trim().toLowerCase() === target);
}

function cell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return '';
  return row[idx] ?? '';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchBrandRows(sheetIdOrUrl: string | null): Promise<BrandRow[]> {
  const sid = (sheetIdOrUrl || '').trim() || process.env.GOOGLE_BRAND_SHEET_ID || '';
  if (!sid) throw new SheetsError('No Brand Sheet ID provided.');

  const rows = await getRows(sid);
  if (rows.length === 0) return [];

  const headers = rows[0].map(String);
  const c = {
    legalName:     findCol(headers, 'BRAND_HEADER_LEGAL_NAME',     'Legal Name'),
    brandCategory: findCol(headers, 'BRAND_HEADER_BRAND_CATEGORY', 'Brand Category'),
    address:       findCol(headers, 'BRAND_HEADER_ADDRESS',        'Address'),
    email:         findCol(headers, 'BRAND_HEADER_EMAIL',          'Email Address'),
    phone:         findCol(headers, 'BRAND_HEADER_PHONE',          'Phone Number'),
    contactPerson: findCol(headers, 'BRAND_HEADER_CONTACT_PERSON', 'Contact Person'),
  };

  return rows.slice(1)
    .map((r, i) => ({
      index: i + 2,
      legalName:     cell(r, c.legalName).trim(),
      brandCategory: cell(r, c.brandCategory),
      address:       cell(r, c.address),
      email:         cell(r, c.email),
      phone:         cell(r, c.phone),
      contactPerson: cell(r, c.contactPerson),
    }))
    .filter(b => b.legalName);
}

export async function fetchEmployeeRows(sheetIdOrUrl: string | null): Promise<EmployeeRow[]> {
  const sid = (sheetIdOrUrl || '').trim() || process.env.GOOGLE_EMPLOYEE_SHEET_ID || '';
  if (!sid) throw new SheetsError('No Employee Sheet ID provided.');

  const rows = await getRows(sid);
  if (rows.length === 0) return [];

  const headers = rows[0].map(String);
  const c = {
    name:        findCol(headers, 'EMPLOYEE_HEADER_NAME',        'Full Name'),
    fatherName:  findCol(headers, 'EMPLOYEE_HEADER_FATHER_NAME', "Father's Name"),
    address:     findCol(headers, 'EMPLOYEE_HEADER_ADDRESS',     'Address'),
    phone:       findCol(headers, 'EMPLOYEE_HEADER_PHONE',       'Phone Number'),
    email:       findCol(headers, 'EMPLOYEE_HEADER_EMAIL',       'Email Address'),
    pan:         findCol(headers, 'EMPLOYEE_HEADER_PAN',         'PAN Number'),
    aadhar:      findCol(headers, 'EMPLOYEE_HEADER_AADHAR',      'Aadhar Number'),
    designation: findCol(headers, 'EMPLOYEE_HEADER_DESIGNATION', 'Designation'),
    department:  findCol(headers, 'EMPLOYEE_HEADER_DEPARTMENT',  'Department'),
    gender:      findCol(headers, 'EMPLOYEE_HEADER_GENDER',      'Gender'),
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
