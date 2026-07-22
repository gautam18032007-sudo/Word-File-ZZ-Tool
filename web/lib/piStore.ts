import fs from 'fs';
import path from 'path';
import { writableDir } from './paths';
import { logger } from './logger';

const OUTPUT_DIR = writableDir('output');
const PI_OUTPUT_DIR = path.join(OUTPUT_DIR, 'pi');
const STORE_FILE = path.join(OUTPUT_DIR, 'pi-history.json');

export interface PiHistoryRecord {
  id: string; // e.g. "BCPL/NO/105" or unique ID
  piNumber: string; // e.g. "BCPL/NO/112" or "BCPL/NO/112 (Old/Wrong)"
  originalPiNumber?: string; // e.g. "BCPL/NO/112"
  status?: 'active' | 'archived'; // Defaults to 'active'
  buyerName: string;
  date: string;
  grandTotal: number;
  pdfFile: string;
  blobUrl?: string;
  generatedAt: string;
  deliveryAddress?: string;
  placeOfSupply?: string;
}


export function readPiHistory(): PiHistoryRecord[] {
  try {
    if (!fs.existsSync(STORE_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
    if (!Array.isArray(raw)) return [];

    // Ensure backwards compatibility by defaulting status & originalPiNumber
    const records: PiHistoryRecord[] = raw.map((item: any) => {
      const status = item.status || 'active';
      const originalPiNumber = item.originalPiNumber || item.piNumber?.replace(/\s*\([^)]*\)/, '').trim() || item.piNumber;
      return {
        ...item,
        status,
        originalPiNumber,
      };
    });

    // Grouping & Sorting logic:
    // Group records by originalPiNumber. Sort active first, then archived by generatedAt desc.
    return sortAndGroupHistory(records);
  } catch {
    return [];
  }
}

function sortAndGroupHistory(records: PiHistoryRecord[]): PiHistoryRecord[] {
  // Map base numbers to records
  const groups = new Map<string, PiHistoryRecord[]>();

  records.forEach((rec) => {
    const key = rec.originalPiNumber || rec.piNumber;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(rec);
  });

  // Sort within group: active first, then by generatedAt desc
  const sortedGroups: { key: string; maxTime: number; items: PiHistoryRecord[] }[] = [];

  groups.forEach((items, key) => {
    items.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
    });

    const maxTime = Math.max(...items.map((i) => new Date(i.generatedAt).getTime() || 0));
    sortedGroups.push({ key, maxTime, items });
  });

  // Sort overall groups by max timestamp descending
  sortedGroups.sort((a, b) => b.maxTime - a.maxTime);

  const result: PiHistoryRecord[] = [];
  sortedGroups.forEach((g) => {
    result.push(...g.items);
  });

  return result;
}

export function appendPiHistory(record: PiHistoryRecord): void {
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const store = readPiHistory();
    const updatedRecord = {
      ...record,
      status: record.status || 'active',
      originalPiNumber: record.originalPiNumber || record.piNumber,
    };
    store.unshift(updatedRecord);
    const trimmed = store.slice(0, 500);
    fs.writeFileSync(STORE_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (e: any) {
    logger.error(`[piStore] Failed to append history record: ${e.message}`);
  }
}

export function archivePiRecord(targetPiNumber: string): PiHistoryRecord | null {
  try {
    const store = readPiHistory();
    const cleanTarget = targetPiNumber.trim();

    // Find current active record matching target PI Number
    const existingIdx = store.findIndex(
      (r) => (r.status === 'active' || !r.status) && (r.piNumber === cleanTarget || r.originalPiNumber === cleanTarget)
    );

    if (existingIdx === -1) return null;

    const oldRecord = { ...store[existingIdx] };

    // Rename PDF on disk if it exists
    if (oldRecord.pdfFile) {
      const oldPdfPath = path.join(PI_OUTPUT_DIR, oldRecord.pdfFile);
      if (fs.existsSync(oldPdfPath)) {
        const ext = path.extname(oldRecord.pdfFile);
        const nameWithoutExt = path.basename(oldRecord.pdfFile, ext);
        const newPdfName = `${nameWithoutExt}_ARCHIVED${ext}`;
        const newPdfPath = path.join(PI_OUTPUT_DIR, newPdfName);

        try {
          fs.renameSync(oldPdfPath, newPdfPath);
          oldRecord.pdfFile = newPdfName;
          logger.gen(`[piStore] Renamed archived PDF on disk: ${oldRecord.pdfFile} -> ${newPdfName}`);
        } catch (err: any) {
          logger.error(`[piStore] Failed to rename archived PDF file: ${err.message}`);
        }
      }
    }

    // Update old record status and label
    oldRecord.status = 'archived';
    oldRecord.originalPiNumber = cleanTarget;
    oldRecord.piNumber = `${cleanTarget} (Old/Wrong)`;

    store[existingIdx] = oldRecord;
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
    logger.gen(`[piStore] Successfully archived history record for ${cleanTarget}`);

    return oldRecord;
  } catch (e: any) {
    logger.error(`[piStore] Failed to archive PI record: ${e.message}`);
    return null;
  }
}

export function deletePiRecord(id: string): boolean {
  try {
    let store = readPiHistory();
    const idx = store.findIndex((r) => r.id === id || r.piNumber === id);
    if (idx === -1) return false;

    const recordToDelete = store[idx];

    // Optionally remove PDF file from disk
    if (recordToDelete.pdfFile) {
      const pdfPath = path.join(PI_OUTPUT_DIR, recordToDelete.pdfFile);
      if (fs.existsSync(pdfPath)) {
        try {
          fs.unlinkSync(pdfPath);
          logger.gen(`[piStore] Deleted PDF file on disk: ${recordToDelete.pdfFile}`);
        } catch (e: any) {
          logger.error(`[piStore] Failed to unlink PDF file: ${e.message}`);
        }
      }
    }

    store.splice(idx, 1);
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
    logger.gen(`[piStore] Deleted history record for ${id}`);
    return true;
  } catch (e: any) {
    logger.error(`[piStore] Failed to delete history record: ${e.message}`);
    return false;
  }
}
