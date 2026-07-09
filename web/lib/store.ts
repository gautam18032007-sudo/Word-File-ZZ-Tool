/**
 * Contract Store — faithful TypeScript port of engines/store.py
 *
 * Reads/writes output/contracts.json (one directory up from web/).
 * Newest records first. Max 500 entries.
 * Tolerates camelCase keys from the legacy Next.js version.
 */
import fs from 'fs';
import path from 'path';
import type { ContractRecord } from './types';
import { writableDir } from './paths';

const OUTPUT_DIR = writableDir('output');
const STORE_FILE = path.join(OUTPUT_DIR, 'contracts.json');

const LEGACY_KEY_MAP: Record<string, string> = {
  contractNo: 'contract_no',
  partyName: 'party_name',
  generatedAt: 'generated_at',
  totalAmount: 'total_amount',
  annualCTC: 'annual_ctc',
};

function normalize(rec: Record<string, unknown>): ContractRecord {
  if ('contract_no' in rec) return rec as unknown as ContractRecord;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[LEGACY_KEY_MAP[k] ?? k] = v;
  }
  return out as unknown as ContractRecord;
}

function readStore(): ContractRecord[] {
  try {
    if (!fs.existsSync(STORE_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
    return (Array.isArray(raw) ? raw : []).map(normalize);
  } catch {
    return [];
  }
}

export function readContracts(): ContractRecord[] {
  return readStore();
}

export function appendContract(record: ContractRecord): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const store = readStore();
  store.unshift(record);
  const trimmed = store.slice(0, 500);
  fs.writeFileSync(STORE_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
}
