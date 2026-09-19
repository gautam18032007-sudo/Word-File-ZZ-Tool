import { list, put } from '@vercel/blob';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';
import { writableDir } from './paths';
import { STORE_MASTER, Store, normalizeDateToIso } from './storeMaster';

export const BLOB_STORE_PATH = 'store-master.json';

export interface StoreMasterData {
  version: number;
  updatedAt: string;
  stores: Store[];
}

export const CANONICAL_INITIAL_STORES: Store[] = [
  {
    storeCode: 'SWN',
    storeName: 'Smartworks Noida',
    openingDate: '2024-01-01',
    active: true,
  },
  {
    storeCode: 'KLJ',
    storeName: 'KLJ Noida One',
    openingDate: '2024-01-01',
    active: true,
  },
  {
    storeCode: 'HQ27',
    storeName: 'HQ27',
    openingDate: '2024-01-01',
    active: true,
  },
  {
    storeCode: 'CLUB125',
    storeName: 'Club 125',
    openingDate: '2024-01-01',
    active: true,
  },
];

export function isVercelProduction(): boolean {
  return Boolean(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV === 'production');
}

function getLocalStoreFilePath(): string {
  return path.join(writableDir('output'), 'stores.json');
}

export interface BlobCredentials {
  token?: string;
  storeId?: string;
}

/**
 * Resolves available Vercel Blob credentials from environment variables.
 * Supports:
 * 1. Standard read-write token: BLOB_READ_WRITE_TOKEN
 * 2. Custom prefix read-write token: *_READ_WRITE_TOKEN (e.g. WORD_FILE_ZZ_TOOL_BLOB_READ_WRITE_TOKEN)
 * 3. Vercel OIDC connection: BLOB_STORE_ID or *_STORE_ID
 */
export function getBlobCredentials(): BlobCredentials | null {
  // 1. Direct standard token
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return { token: process.env.BLOB_READ_WRITE_TOKEN.trim() };
  }

  // 2. Custom prefix read-write token
  for (const [key, value] of Object.entries(process.env)) {
    if (key.endsWith('_READ_WRITE_TOKEN') && value?.trim()) {
      return { token: value.trim() };
    }
  }

  // 3. Vercel OIDC store ID connection (standard or custom prefix)
  if (process.env.BLOB_STORE_ID?.trim()) {
    return { storeId: process.env.BLOB_STORE_ID.trim() };
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (key.endsWith('_STORE_ID') && value?.trim()) {
      return { storeId: value.trim() };
    }
  }

  return null;
}

function applyBlobAuth<T extends Record<string, any>>(creds: BlobCredentials, options: T): T & { token?: string; storeId?: string } {
  const result: any = { ...options };
  if (creds.token) {
    result.token = creds.token;
  } else if (creds.storeId) {
    result.storeId = creds.storeId;
  }
  return result;
}

/**
 * Reads the canonical Store Master data.
 * - In Vercel production: ONLY reads from Vercel Blob. Throws 503 error if Blob is missing/unreachable.
 * - In local dev: Uses Vercel Blob if credentials are provided; otherwise falls back to output/stores.json.
 */
export async function getStoreMasterData(): Promise<StoreMasterData> {
  const creds = getBlobCredentials();
  const inProd = isVercelProduction();

  if (inProd) {
    if (!creds) {
      const err = new Error('Store Master unavailable: BLOB_READ_WRITE_TOKEN is not configured in Vercel production.');
      logger.error(`[storeMasterStore] ${err.message}`);
      throw err;
    }

    try {
      const { blobs } = await list(applyBlobAuth(creds, { prefix: BLOB_STORE_PATH }));
      const matchingBlobs = blobs.filter((b) => b.pathname === BLOB_STORE_PATH);
      matchingBlobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      const blob = matchingBlobs[0];

      if (!blob) {
        logger.gen('[storeMasterStore] store-master.json not found in Vercel Blob. Seeding initial canonical stores...');
        const initialData: StoreMasterData = {
          version: 1,
          updatedAt: new Date().toISOString(),
          stores: CANONICAL_INITIAL_STORES,
        };
        await put(
          BLOB_STORE_PATH,
          JSON.stringify(initialData, null, 2),
          applyBlobAuth(creds, {
            access: 'public',
            addRandomSuffix: false,
            contentType: 'application/json',
          })
        );
        return initialData;
      }

      const fetchUrl = `${blob.url}${blob.url.includes('?') ? '&' : '?'}t=${new Date(blob.uploadedAt).getTime()}`;
      const res = await fetch(fetchUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch store-master.json from Blob (HTTP ${res.status})`);
      }
      const data: StoreMasterData = await res.json();
      if (!data || !Array.isArray(data.stores)) {
        throw new Error('Corrupted store-master.json payload in Vercel Blob.');
      }
      return data;
    } catch (err: any) {
      logger.error(`[storeMasterStore] Vercel Blob error: ${err?.message || String(err)}`);
      throw new Error(`Store Master unavailable: Unable to access Vercel Blob (${err?.message || 'network error'})`);
    }
  }

  // Local development / testing mode
  if (creds) {
    try {
      const { blobs } = await list(applyBlobAuth(creds, { prefix: BLOB_STORE_PATH }));
      const matchingBlobs = blobs.filter((b) => b.pathname === BLOB_STORE_PATH);
      matchingBlobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      const blob = matchingBlobs[0];
      if (blob) {
        const fetchUrl = `${blob.url}${blob.url.includes('?') ? '&' : '?'}t=${new Date(blob.uploadedAt).getTime()}`;
        const res = await fetch(fetchUrl, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        if (res.ok) {
          const data: StoreMasterData = await res.json();
          if (data && Array.isArray(data.stores)) return data;
        }
      }
    } catch (err: any) {
      logger.gen(`[storeMasterStore] Local Blob check failed, falling back to local file: ${err?.message}`);
    }
  }

  // Local filesystem fallback (strictly prohibited on Vercel production)
  const localFile = getLocalStoreFilePath();
  if (fs.existsSync(localFile)) {
    try {
      const content = fs.readFileSync(localFile, 'utf8');
      const data: StoreMasterData = JSON.parse(content);
      if (data && Array.isArray(data.stores)) {
        return data;
      }
    } catch (e) {
      logger.error(`[storeMasterStore] Error reading ${localFile}, re-initializing...`);
    }
  }

  const initialData: StoreMasterData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    stores: CANONICAL_INITIAL_STORES,
  };
  try {
    fs.mkdirSync(path.dirname(localFile), { recursive: true });
    fs.writeFileSync(localFile, JSON.stringify(initialData, null, 2), 'utf8');
  } catch (err: any) {
    logger.error(`[storeMasterStore] Could not write local fallback file: ${err?.message}`);
  }
  return initialData;
}

/**
 * Validates store attributes before insertion.
 */
export function validateStoreInput(input: Partial<Store>): { valid: boolean; error?: string; store?: Store } {
  const name = (input.storeName || '').trim();
  const rawCode = (input.storeCode || '').trim();
  const openDate = (input.openingDate || '').trim();
  const closeDate = (input.closingDate || '').trim();
  const active = input.active !== false;

  if (!name || name.length < 2 || name.length > 100) {
    return { valid: false, error: 'Store Name is required and must be between 2 and 100 characters.' };
  }

  if (!rawCode || rawCode.length < 2 || rawCode.length > 20) {
    return { valid: false, error: 'Store Code is required and must be between 2 and 20 characters.' };
  }

  const code = rawCode.toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9_-]{2,20}$/.test(code)) {
    return { valid: false, error: 'Store Code must contain only alphanumeric characters, underscores, or hyphens.' };
  }

  if (!openDate || !/^\d{4}-\d{2}-\d{2}$/.test(openDate)) {
    return { valid: false, error: 'Opening Date is required in valid YYYY-MM-DD format.' };
  }

  const openIso = normalizeDateToIso(openDate);
  if (openIso !== openDate) {
    return { valid: false, error: 'Opening Date is not a valid calendar date.' };
  }

  let finalCloseDate: string | undefined = undefined;
  if (closeDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(closeDate)) {
      return { valid: false, error: 'Closing Date must be in valid YYYY-MM-DD format if provided.' };
    }
    const closeIso = normalizeDateToIso(closeDate);
    if (closeIso !== closeDate) {
      return { valid: false, error: 'Closing Date is not a valid calendar date.' };
    }
    if (closeIso < openIso) {
      return { valid: false, error: 'Closing Date cannot be before Opening Date.' };
    }
    finalCloseDate = closeIso;
  }

  return {
    valid: true,
    store: {
      storeCode: code,
      storeName: name,
      openingDate: openIso,
      active,
      ...(finalCloseDate ? { closingDate: finalCloseDate } : {}),
    },
  };
}

/**
 * Appends a new store to the canonical Store Master.
 * Ensures uniqueness and atomic persistence.
 */
export async function addStoreToMaster(newStoreInput: Partial<Store>): Promise<{ success: boolean; store?: Store; stores?: Store[]; error?: string }> {
  const validation = validateStoreInput(newStoreInput);
  if (!validation.valid || !validation.store) {
    return { success: false, error: validation.error || 'Invalid store data' };
  }

  const newStore = validation.store;

  // Retrieve current canonical data
  const masterData = await getStoreMasterData();

  // Check for duplicate storeCode (case-insensitive)
  const isDuplicate = masterData.stores.some(
    (s) => s.storeCode.trim().toUpperCase() === newStore.storeCode.toUpperCase()
  );
  if (isDuplicate) {
    return { success: false, error: `Store with code '${newStore.storeCode}' already exists.` };
  }

  // Append new store
  const updatedStores = [...masterData.stores, newStore];
  const updatedData: StoreMasterData = {
    version: (masterData.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    stores: updatedStores,
  };

  const creds = getBlobCredentials();
  const inProd = isVercelProduction();

  if (inProd) {
    if (!creds) {
      throw new Error('Store Master unavailable: BLOB_READ_WRITE_TOKEN is not configured in Vercel production.');
    }
    await put(
      BLOB_STORE_PATH,
      JSON.stringify(updatedData, null, 2),
      applyBlobAuth(creds, {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      })
    );
    logger.gen(`[storeMasterStore] Successfully saved new store "${newStore.storeCode}" to Vercel Blob.`);
    return { success: true, store: newStore, stores: updatedStores };
  }

  // Local development mode: if creds available, update Blob as well
  if (creds) {
    try {
      await put(
        BLOB_STORE_PATH,
        JSON.stringify(updatedData, null, 2),
        applyBlobAuth(creds, {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/json',
        })
      );
    } catch (e: any) {
      logger.gen(`[storeMasterStore] Local Blob write skipped/failed: ${e?.message}`);
    }
  }

  // Write local fallback file in dev
  const localFile = getLocalStoreFilePath();
  fs.mkdirSync(path.dirname(localFile), { recursive: true });
  fs.writeFileSync(localFile, JSON.stringify(updatedData, null, 2), 'utf8');
  logger.gen(`[storeMasterStore] Successfully saved new store "${newStore.storeCode}" to local fallback.`);

  return { success: true, store: newStore, stores: updatedStores };
}

/**
 * Updates active status of an existing store in the canonical Store Master.
 */
export async function updateStoreStatus(
  storeCode: string,
  active: boolean
): Promise<{ success: boolean; store?: Store; stores?: Store[]; error?: string }> {
  if (!storeCode) {
    return { success: false, error: 'Store code is required.' };
  }

  const masterData = await getStoreMasterData();
  const upper = storeCode.trim().toUpperCase();
  const storeIndex = masterData.stores.findIndex(
    (s) => s.storeCode.trim().toUpperCase() === upper
  );

  if (storeIndex < 0) {
    return { success: false, error: `Store with code '${storeCode}' not found.` };
  }

  const updatedStore: Store = {
    ...masterData.stores[storeIndex],
    active,
  };

  const updatedStores = [...masterData.stores];
  updatedStores[storeIndex] = updatedStore;

  const updatedData: StoreMasterData = {
    version: (masterData.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    stores: updatedStores,
  };

  const creds = getBlobCredentials();
  const inProd = isVercelProduction();

  if (inProd) {
    if (!creds) {
      throw new Error('Store Master unavailable: BLOB_READ_WRITE_TOKEN is not configured in Vercel production.');
    }
    await put(
      BLOB_STORE_PATH,
      JSON.stringify(updatedData, null, 2),
      applyBlobAuth(creds, {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      })
    );
    logger.gen(`[storeMasterStore] Successfully updated status of store "${updatedStore.storeCode}" to active=${active} in Vercel Blob.`);
    return { success: true, store: updatedStore, stores: updatedStores };
  }

  if (creds) {
    try {
      await put(
        BLOB_STORE_PATH,
        JSON.stringify(updatedData, null, 2),
        applyBlobAuth(creds, {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/json',
        })
      );
    } catch (e: any) {
      logger.gen(`[storeMasterStore] Local Blob write skipped/failed: ${e?.message}`);
    }
  }

  const localFile = getLocalStoreFilePath();
  fs.mkdirSync(path.dirname(localFile), { recursive: true });
  fs.writeFileSync(localFile, JSON.stringify(updatedData, null, 2), 'utf8');
  logger.gen(`[storeMasterStore] Successfully updated status of store "${updatedStore.storeCode}" to active=${active} in local fallback.`);

  return { success: true, store: updatedStore, stores: updatedStores };
}

/**
 * Removes a store completely from the canonical Store Master.
 */
export async function removeStoreFromMaster(
  storeCode: string
): Promise<{ success: boolean; removedStore?: Store; stores?: Store[]; error?: string }> {
  if (!storeCode) {
    return { success: false, error: 'Store code is required.' };
  }

  const masterData = await getStoreMasterData();
  const upper = storeCode.trim().toUpperCase();
  const storeIndex = masterData.stores.findIndex(
    (s) => s.storeCode.trim().toUpperCase() === upper
  );

  if (storeIndex < 0) {
    return { success: false, error: `Store with code '${storeCode}' not found.` };
  }

  const removedStore = masterData.stores[storeIndex];
  const updatedStores = masterData.stores.filter((_, idx) => idx !== storeIndex);

  const updatedData: StoreMasterData = {
    version: (masterData.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    stores: updatedStores,
  };

  const creds = getBlobCredentials();
  const inProd = isVercelProduction();

  if (inProd) {
    if (!creds) {
      throw new Error('Store Master unavailable: BLOB_READ_WRITE_TOKEN is not configured in Vercel production.');
    }
    await put(
      BLOB_STORE_PATH,
      JSON.stringify(updatedData, null, 2),
      applyBlobAuth(creds, {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      })
    );
    logger.gen(`[storeMasterStore] Successfully removed store "${upper}" from Vercel Blob.`);
    return { success: true, removedStore, stores: updatedStores };
  }

  if (creds) {
    try {
      await put(
        BLOB_STORE_PATH,
        JSON.stringify(updatedData, null, 2),
        applyBlobAuth(creds, {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/json',
        })
      );
    } catch (e: any) {
      logger.gen(`[storeMasterStore] Local Blob write skipped/failed: ${e?.message}`);
    }
  }

  const localFile = getLocalStoreFilePath();
  fs.mkdirSync(path.dirname(localFile), { recursive: true });
  fs.writeFileSync(localFile, JSON.stringify(updatedData, null, 2), 'utf8');
  logger.gen(`[storeMasterStore] Successfully removed store "${upper}" from local fallback.`);

  return { success: true, removedStore, stores: updatedStores };
}

