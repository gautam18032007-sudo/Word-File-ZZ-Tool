import { put } from '@vercel/blob';
import { logger } from './logger';

export async function uploadToBlob(filename: string, buffer: Buffer, folder: string): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    logger.gen(`[blobStore] BLOB_READ_WRITE_TOKEN not set. Skipping Vercel Blob upload for ${filename}.`);
    return null;
  }

  try {
    const blobPath = `${folder}/${filename}`;
    logger.gen(`[blobStore] Uploading ${blobPath} to Vercel Blob...`);
    const blob = await put(blobPath, buffer, {
      access: 'public',
      addRandomSuffix: false,
      token,
    });
    logger.gen(`[blobStore] Uploaded to Vercel Blob successfully: ${blob.url}`);
    return blob.url;
  } catch (err: any) {
    logger.error(`[blobStore] Vercel Blob upload failed for ${filename}: ${err?.message || String(err)}`);
    return null;
  }
}
