/**
 * LOR Store — read/write lor-history.json
 *
 * Mirror of certStore.ts. Completely isolated:
 *   - Reads/writes output/lor-history.json ONLY
 *   - Never touches contracts.json or certificates.json
 *   - Newest records first. Max 500 entries.
 *
 * History schema includes AI draft audit trail fields (Correction #3):
 *   draftGeneratedByAI, aiDraft, finalDraft, edited
 */
import fs from 'fs';
import path from 'path';
import { writableDir } from './paths';

const OUTPUT_DIR = writableDir('output');
const STORE_FILE = path.join(OUTPUT_DIR, 'lor-history.json');

// ─── LOR History Record Schema ─────────────────────────────────────────────────

export interface LorHistoryRecord {
  /** Sequential LOR number — e.g. "ZZ-LOR-2026-0001" */
  id: string;
  /** Alias for id — kept for UI display convenience */
  lorNumber: string;
  /** Full name of the employee / candidate */
  fullName: string;
  /** Role / title at time of employment */
  designation: string;
  /** Department or team */
  department: string;
  /** ISO date string — YYYY-MM-DD */
  joiningDate: string;
  /** ISO date string — YYYY-MM-DD */
  lastWorkingDate: string;
  /** "Intern", "Full-Time", etc. — optional */
  employmentType: string;
  /** Personal email — stored for records, never sent to AI */
  email: string;
  /** Name of the signing authority */
  signatoryName: string;
  /** Role of the signing authority */
  signatoryRole: string;
  /** ISO timestamp — when the LOR was generated */
  generatedAt: string;
  /** Gemini model version used (or "manual" if AI was skipped) */
  aiModelVersion: string;
  /** true = Gemini generated the draft; false = HR wrote manually or AI failed */
  draftGeneratedByAI: boolean;
  /** Raw text returned by Gemini. null if AI was not used or failed. */
  aiDraft: string | null;
  /** Final text that was compiled into the DOCX (may differ from aiDraft if HR edited) */
  finalDraft: string;
  /** true if HR edited the AI draft before generating the document */
  edited: boolean;
  /** Filename only — e.g. "ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.docx" */
  docxFile: string;
  /** Filename only — e.g. "ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.pdf". null if LibreOffice unavailable. */
  pdfFile: string | null;
  docxBlobUrl?: string;
  pdfBlobUrl?: string;
  /** Audit log showing source model / fallback used: "ollama" | "template" | "manual" */
  generatedBy?: string;
}


// ─── Read ──────────────────────────────────────────────────────────────────────

/**
 * Read all LOR history records from lor-history.json.
 * Returns [] if the file does not exist or is unreadable (safe for first run).
 */
export function readLorHistory(): LorHistoryRecord[] {
  try {
    if (!fs.existsSync(STORE_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
    return Array.isArray(raw) ? (raw as LorHistoryRecord[]) : [];
  } catch {
    return [];
  }
}

// ─── Write ─────────────────────────────────────────────────────────────────────

/**
 * Append a new LOR record to lor-history.json.
 * - Creates the file (and output/ dir) if it does not exist.
 * - Newest records first (unshift).
 * - Caps at 500 records — oldest are silently discarded.
 * - NEVER writes to contracts.json or certificates.json.
 */
export function appendLorHistory(record: LorHistoryRecord): void {
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const store = readLorHistory();
    store.unshift(record);
    const trimmed = store.slice(0, 500);
    fs.writeFileSync(STORE_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch {
    // Non-fatal — generation still succeeds even if history write fails
  }
}
