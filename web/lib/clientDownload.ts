/**
 * Client-side download from a base64 payload embedded in an API response.
 *
 * On Vercel each API route is its own serverless function with its own /tmp,
 * so a file written during generation is never visible to a later /api/download
 * request against a different function instance. Downloading straight from the
 * base64 the generate call already returned sidesteps that entirely.
 */
export function downloadBase64(filename: string, base64: string, mime: string) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;
