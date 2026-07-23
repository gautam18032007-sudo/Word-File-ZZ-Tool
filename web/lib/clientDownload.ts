/**
 * Binary-safe client-side download utility.
 * Decodes base64 payload into a raw Uint8Array byte buffer and triggers
 * a browser file download with explicit OpenXML / PDF MIME headers.
 */

export const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

export function getMimeTypeForFilename(filename: string, fallbackMime?: string): string {
  if (fallbackMime && fallbackMime.trim()) return fallbackMime;
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx') return MIME.xlsx;
  if (ext === 'docx') return MIME.docx;
  if (ext === 'pdf') return MIME.pdf;
  return 'application/octet-stream';
}

export function downloadBase64(filename: string, base64: string, mime?: string) {
  if (!base64 || typeof base64 !== 'string') {
    console.error('[clientDownload] Cannot download: base64 payload is missing or invalid');
    return;
  }

  try {
    // Strip data URL scheme prefix if present and remove whitespace/newlines
    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
    const byteChars = atob(cleanBase64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }

    const resolvedMime = getMimeTypeForFilename(filename, mime);
    const blob = new Blob([byteArray], { type: resolvedMime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch (err) {
    console.error('[clientDownload] Base64 decoding failed for file:', filename, err);
  }
}

/**
 * Downloads a history file safely.
 * If a persistent blobUrl is present, downloads directly from Vercel Blob storage.
 * Otherwise performs a HEAD request check against /api/download to ensure the file
 * actually exists on serverless disk, displaying an alert if expired instead of saving a 404 body.
 */
export async function downloadHistoryFile(folder: string, filename: string, blobUrl?: string) {
  if (blobUrl && blobUrl.trim()) {
    try {
      const res = await fetch(blobUrl);
      if (res.ok) {
        const blobData = await res.blob();
        const mimeType = getMimeTypeForFilename(filename);
        const typedBlob = new Blob([blobData], { type: mimeType });
        const url = URL.createObjectURL(typedBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        return;
      }
    } catch (err) {
      console.warn('[downloadHistoryFile] Blob fetch failed, falling back to direct link:', err);
    }
    // Fallback if fetch is blocked or fails
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  const url = `/api/download?folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(filename)}`;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) {
      alert(`File unavailable: "${filename}" was generated before persistent storage was added (or serverless temp storage expired). Please regenerate this document or delete this old record.`);
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    alert(`Could not download ${filename}. Please try regenerating.`);
  }
}

