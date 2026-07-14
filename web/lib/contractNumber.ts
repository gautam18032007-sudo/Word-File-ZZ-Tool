/**
 * Contract Number Engine — faithful TypeScript port of engines/contract_number.py
 *
 * Reads/writes output/sequence.json (one directory up from web/).
 * Never resets, never re-uses numbers.
 */
import fs from 'fs';
import path from 'path';
import { writableDir } from './paths';

const OUTPUT_DIR = writableDir('output');
const SEQUENCE_FILE = path.join(OUTPUT_DIR, 'sequence.json');

function readSequence(): Record<string, Record<string, number>> {
  try {
    if (!fs.existsSync(SEQUENCE_FILE)) return {};
    return JSON.parse(fs.readFileSync(SEQUENCE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeSequence(data: Record<string, Record<string, number>>): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(SEQUENCE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/** Returns e.g. "ZZ-BRAND-2026-0001" or "ZZ-LOR-2026-0001" */
export function nextContractNumber(type: 'BRAND' | 'EMP' | 'CERT' | 'LOR'): string {
  const year = String(new Date().getFullYear());
  const prefix = process.env.CONTRACT_PREFIX ?? 'ZZ';

  const store = readSequence();
  if (!store[type]) store[type] = {};
  if (!store[type][year]) store[type][year] = 0;
  store[type][year] += 1;

  const seq = String(store[type][year]).padStart(4, '0');
  writeSequence(store);
  return `${prefix}-${type}-${year}-${seq}`;
}

/** e.g. ("ZZ-BRAND-2026-0001", "Nike India", "docx") → "ZZ-BRAND-2026-0001_NIKE_INDIA.docx" */
export function buildFilename(contractNo: string, partyName: string, ext: string): string {
  const slug = partyName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${contractNo}_${slug}.${ext}`;
}
