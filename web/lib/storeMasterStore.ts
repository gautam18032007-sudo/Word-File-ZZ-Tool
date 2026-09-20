import { list, put, get } from '@vercel/blob';
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
 * Reads canonical store-master.json from Vercel Blob using authenticated get() with access='private' and useCache=false.
 * Returns null if the blob does not exist (404 / BlobNotFoundError).
 */
export async function readStoreMasterFromBlob(creds: BlobCredentials): Promise<StoreMasterData | null> {
  const getOptions = applyBlobAuth(creds, {
    access: 'private' as const,
    useCache: false,
  });

  try {
    logger.gen(`[storeMasterStore] Fetching canonical ${BLOB_STORE_PATH} via @vercel/blob get(access='private', useCache=false)...`);
    let result = await get(BLOB_STORE_PATH, getOptions);

    // If get by pathname returned null, check list() and try get(blob.url) as fallback
    if (!result) {
      const { blobs } = await list(applyBlobAuth(creds, { prefix: BLOB_STORE_PATH }));
      const matchingBlobs = blobs.filter((b) => b.pathname === BLOB_STORE_PATH);
      if (matchingBlobs.length > 0) {
        matchingBlobs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        const blob = matchingBlobs[0];
        result = await get(blob.url, getOptions);
      }
    }

    if (!result) {
      return null;
    }

    if (result.statusCode === 200 && result.stream) {
      const data: StoreMasterData = await new Response(result.stream).json();
      if (!data || !Array.isArray(data.stores)) {
        throw new Error('Corrupted store-master.json payload in Vercel Blob (stores array missing).');
      }
      return data;
    }

    throw new Error(`Unexpected statusCode ${result.statusCode} from Blob get()`);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('404') || msg.includes('not found') || msg.includes('BlobNotFoundError')) {
      return null;
    }

    // Safe error diagnostics (distinguishes error category without logging sensitive tokens)
    let diagCategory = 'Blob SDK/API failure';
    if (msg.includes('credentials') || msg.includes('token') || msg.includes('unauthorized') || msg.includes('401') || msg.includes('403')) {
      diagCategory = 'Blob authentication failure';
    } else if (msg.includes('access must be') || msg.includes('access mismatch')) {
      diagCategory = 'private/public access mismatch';
    } else if (msg.includes('JSON') || msg.includes('SyntaxError')) {
      diagCategory = 'JSON parse failure';
    } else if (msg.includes('Invalid URL')) {
      diagCategory = 'malformed Blob URL';
    }
    logger.error(`[storeMasterStore] [${diagCategory}] error reading ${BLOB_STORE_PATH} (access='private'): ${msg}`);
    throw err;
  }
}

/**
 * Writes canonical store-master.json to Vercel Blob using put() with access='private', addRandomSuffix=false, allowOverwrite=true.
 */
export async function writeStoreMasterToBlob(data: StoreMasterData, creds: BlobCredentials): Promise<void> {
  logger.gen(`[storeMasterStore] Writing canonical ${BLOB_STORE_PATH} (version=${data.version}, stores=${data.stores.length}) with access='private', allowOverwrite=true...`);
  await put(
    BLOB_STORE_PATH,
    JSON.stringify(data, null, 2),
    applyBlobAuth(creds, {
      access: 'private' as const,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })
  );
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
      const data = await readStoreMasterFromBlob(creds);
      if (!data) {
        logger.gen('[storeMasterStore] store-master.json not found in Vercel Blob. Seeding initial canonical stores...');
        const initialData: StoreMasterData = {
          version: 1,
          updatedAt: new Date().toISOString(),
          stores: CANONICAL_INITIAL_STORES,
        };
        await writeStoreMasterToBlob(initialData, creds);
        return initialData;
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
      const data = await readStoreMasterFromBlob(creds);
      if (data) return data;
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
    await writeStoreMasterToBlob(updatedData, creds);
    logger.gen(`[storeMasterStore] Successfully saved new store "${newStore.storeCode}" to Vercel Blob.`);
    return { success: true, store: newStore, stores: updatedStores };
  }

  // Local development mode: if creds available, update Blob as well
  if (creds) {
    try {
      await writeStoreMasterToBlob(updatedData, creds);
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
    await writeStoreMasterToBlob(updatedData, creds);
    logger.gen(`[storeMasterStore] Successfully updated status of store "${updatedStore.storeCode}" to active=${active} in Vercel Blob.`);
    return { success: true, store: updatedStore, stores: updatedStores };
  }

  if (creds) {
    try {
      await writeStoreMasterToBlob(updatedData, creds);
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
    await writeStoreMasterToBlob(updatedData, creds);
    logger.gen(`[storeMasterStore] Successfully removed store "${upper}" from Vercel Blob.`);
    return { success: true, removedStore, stores: updatedStores };
  }

  if (creds) {
    try {
      await writeStoreMasterToBlob(updatedData, creds);
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

