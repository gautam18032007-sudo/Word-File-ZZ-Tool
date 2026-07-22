import fs from 'fs';

export function isVercel(): boolean {
  return !!process.env.VERCEL;
}

export function isLocal(): boolean {
  return !process.env.VERCEL;
}

export function supportsLibreOffice(): boolean {
  if (isVercel()) return false;
  const defaultPath = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
  if (process.env.LIBREOFFICE_PATH) {
    return fs.existsSync(process.env.LIBREOFFICE_PATH);
  }
  return fs.existsSync(defaultPath);
}

export function hasGotenberg(): boolean {
  return !!(process.env.GOTENBERG_URL && process.env.GOTENBERG_URL.trim().length > 0);
}

export function getPdfConversionMethod(): 'local' | 'gotenberg' | 'none' {
  if (supportsLibreOffice()) return 'local';
  if (hasGotenberg()) return 'gotenberg';
  return 'none';
}
