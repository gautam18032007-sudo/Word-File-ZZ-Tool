import { put } from '@vercel/blob';
import { logger } from './logger';
import { getBlobCredentials } from './storeMasterStore';

export async function uploadToBlob(filename: string, buffer: Buffer, folder: string): Promise<string | null> {
  const creds = getBlobCredentials();
  if (!creds) {
    logger.gen(`[blobStore] Blob credentials not set. Skipping Vercel Blob upload for ${filename}.`);
    return null;
  }

  try {
    const blobPath = `${folder}/${filename}`;
    logger.gen(`[blobStore] Uploading ${blobPath} to Vercel Blob...`);
    const options: any = {
      access: 'public',
      addRandomSuffix: false,
    };
    if (creds.token) options.token = creds.token;
    else if (creds.storeId) options.storeId = creds.storeId;

    const blob = await put(blobPath, buffer, options);
    logger.gen(`[blobStore] Uploaded to Vercel Blob successfully: ${blob.url}`);
    return blob.url;
  } catch (err: any) {
    logger.error(`[blobStore] Vercel Blob upload failed for ${filename}: ${err?.message || String(err)}`);
    return null;
  }
}
