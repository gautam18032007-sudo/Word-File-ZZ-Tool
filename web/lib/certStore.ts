import fs from "fs";
import path from "path";
import { writableDir } from "./paths";

const OUTPUT_DIR = writableDir("output");
const STORE_FILE = path.join(OUTPUT_DIR, "certificates.json");

export interface CertificateRecord {
  id: string;
  module: "certificate";
  certificateType: string;
  template: string;
  name: string;
  designation: string;
  joiningDate: string;
  lastWorkingDate: string;
  generatedAt: string;
  pdf: string; // PDF filename
  pdfBlobUrl?: string;
}


export function readCertificates(): CertificateRecord[] {
  try {
    if (!fs.existsSync(STORE_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function appendCertificate(record: CertificateRecord): void {
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const store = readCertificates();
    
    // Unshift to place newest records first
    store.unshift(record);
    const trimmed = store.slice(0, 500);
    fs.writeFileSync(STORE_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
  } catch {}
}
