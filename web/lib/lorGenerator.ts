import fs from 'fs';
import path from 'path';
import { renderDocx } from './template';
import { convertDocumentToPdf } from './pdfProvider';


import { writableDir } from './paths';


const TEMPLATES_DIR = path.resolve(process.cwd(), 'templates');
const OUTPUT_DIR = path.join(writableDir('output'), 'lors');

export interface GenerateLorOptions {
  fullName: string;
  designation: string;
  department: string;
  joiningDate: string;
  lastWorkingDate: string;
  finalDraft: string;
  signatoryName: string;
  signatoryRole: string;
  lorNumber: string;
}

export interface GenerateLorResult {
  docxFile: string;
  pdfFile: string | null;
  docxBase64: string;
  pdfBase64: string | null;
}

export async function generateLor(options: GenerateLorOptions): Promise<GenerateLorResult> {

  const {
    fullName,
    designation,
    department,
    joiningDate,
    lastWorkingDate,
    finalDraft,
    signatoryName,
    signatoryRole,
    lorNumber,
  } = options;

  // 1. Find active LOR template from templates/lor/templates.json
  const registryPath = path.join(TEMPLATES_DIR, 'lor', 'templates.json');
  if (!fs.existsSync(registryPath)) {
    throw new Error('LOR template registry templates.json not found');
  }

  const templates = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  const activeTemplate = templates.find((t: any) => t.active);
  if (!activeTemplate) {
    throw new Error('No active LOR template found');
  }

  const templateFile = `lor/${activeTemplate.file}`;

  // 2. Prepare data map matching uppercase placeholders in the docx
  const formatDateFmt = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    const day = d.getDate();
    const month = d.toLocaleString('en-GB', { month: 'long' });
    const year = d.getFullYear();
    // Add ordinal: e.g. "19th" or "3rd"
    const ordinal = (n: number) => {
      const s = ['th','st','nd','rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    return `${ordinal(day)} ${month}, ${year}`;
  };

  const todayStr = formatDateFmt(new Date().toISOString().split('T')[0]);

  const data: Record<string, string> = {
    FULL_NAME: fullName,
    DESIGNATION: designation,
    DEPARTMENT: department,
    JOINING_DATE: formatDateFmt(joiningDate),
    LAST_WORKING_DATE: formatDateFmt(lastWorkingDate),
    FINAL_DRAFT: finalDraft,
    SIGNATORY_NAME: signatoryName,
    SIGNATORY_ROLE: signatoryRole,
    DATE: todayStr
  };

  // 3. Render DOCX using template engine
  const docxBytes = renderDocx(templateFile, data);

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Naming pattern: ZZ-LOR-YYYY-XXXX_PARTY_NAME_SLUG.docx / .pdf
  const nameSlug = fullName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const docxFilename = `${lorNumber}_${nameSlug}.docx`;
  const pdfFilename = `${lorNumber}_${nameSlug}.pdf`;

  const docxPath = path.join(OUTPUT_DIR, docxFilename);
  const pdfPath = path.join(OUTPUT_DIR, pdfFilename);

  // Write DOCX
  fs.writeFileSync(docxPath, docxBytes);

  // 4. Convert to PDF using headless LibreOffice or Gotenberg
  let pdfBase64: string | null = null;
  const pdfResult = await convertDocumentToPdf(docxBytes, docxFilename);

  if (pdfResult.pdfBuffer) {
    fs.writeFileSync(pdfPath, pdfResult.pdfBuffer);
    pdfBase64 = pdfResult.pdfBuffer.toString('base64');
  }




  return {
    docxFile: docxFilename,
    pdfFile: pdfBase64 ? pdfFilename : null,
    docxBase64: docxBytes.toString('base64'),
    pdfBase64,
  };

}
