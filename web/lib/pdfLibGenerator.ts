import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import { writableDir } from "./paths";

const TEMPLATES_DIR = path.resolve(process.cwd(), "templates");
const PUBLIC_DIR = path.resolve(process.cwd(), "public");

export interface GeneratePdfOptions {
  name: string;
  designation: string;
  joiningDate: string;
  lastWorkingDate: string;
  templateId: string;
  signatoryName: string;
  signatoryRole: string;
  sigImage?: string; // base64 data url
}

export async function generateCertificatePdf(options: GeneratePdfOptions): Promise<Buffer> {
  const {
    name,
    designation,
    joiningDate,
    lastWorkingDate,
    templateId,
    signatoryName,
    signatoryRole,
    sigImage,
  } = options;

  // 1. Resolve template path
  // Custom templates are in output/templates/certificates (via writableDir)
  // System templates are in templates/certificates
  let templateBytes: Buffer;
  let filename = "certificate-appreciation.png";

  if (templateId.startsWith("CERT_TEMPLATE_CUSTOM_")) {
    // Load custom registry to find filename
    const certDir = writableDir("templates/certificates");
    const registryPath = path.join(certDir, "registry.json");
    if (fs.existsSync(registryPath)) {
      const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
      const template = registry.find((t: any) => t.id === templateId);
      if (template) {
        filename = template.filename;
      }
    }
    const customPath = path.join(certDir, filename);
    if (!fs.existsSync(customPath)) {
      throw new Error(`Custom template file not found: ${filename}`);
    }
    templateBytes = fs.readFileSync(customPath);
  } else {
    // System default templates
    const sysPath = path.join(TEMPLATES_DIR, "certificates", filename);
    const fallbackPath = path.join(PUBLIC_DIR, "templates", "certificates", filename);
    
    if (fs.existsSync(sysPath)) {
      templateBytes = fs.readFileSync(sysPath);
    } else if (fs.existsSync(fallbackPath)) {
      templateBytes = fs.readFileSync(fallbackPath);
    } else {
      throw new Error("System certificate template not found.");
    }
  }

  // 2. Setup PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Custom page size matching standard aspect ratio: 2000 x 1414
  const width = 2000;
  const height = 1414;
  const page = pdfDoc.addPage([width, height]);

  // 3. Embed template image or copy pages if template is PDF
  const isPdfTemplate = filename.toLowerCase().endsWith(".pdf");
  
  if (isPdfTemplate) {
    const srcDoc = await PDFDocument.load(templateBytes);
    const [copiedPage] = await pdfDoc.copyPages(srcDoc, [0]);
    const embeddedPage = await pdfDoc.embedPage(copiedPage);
    page.drawPage(embeddedPage, { x: 0, y: 0, width, height });
  } else {
    // It's a PNG/JPG image
    const embeddedImg = filename.toLowerCase().endsWith(".png") 
      ? await pdfDoc.embedPng(templateBytes)
      : await pdfDoc.embedJpg(templateBytes);
    page.drawImage(embeddedImg, { x: 0, y: 0, width, height });
  }

  // 4. No masking needed for CERT_TEMPLATE_001 because the template image is blank in these areas.

  // 5. Load fonts
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 6. Draw dynamic text overlays
  // Format Date with ordinal suffix: "15th June, 2026"
  const ordinal = (n: number) => {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    const day = ordinal(d.getDate());
    const month = d.toLocaleString('en-GB', { month: 'long' });
    const year = d.getFullYear();
    return `${day} ${month}, ${year}`;
  };

  const startFmt = formatDate(joiningDate);
  const endFmt = formatDate(lastWorkingDate);
  const dateRangeText = startFmt && endFmt ? `${startFmt} - ${endFmt}` : '';

  const nameText = name.trim();
  const des = designation.trim();
  // Build "Worked as Maverick Intern at zenzebra" style text
  const designationText = des ? `Worked as ${des} at zenzebra` : 'Worked at zenzebra';

  // ── Name: scale up to 110pt, shrink to fit 1300px wide safe zone ──────────
  const nameCenterX = 1216;
  let nameSize = 110;
  let nameWidth = fontHelveticaBold.widthOfTextAtSize(nameText, nameSize);
  while (nameWidth > 1280 && nameSize > 28) {
    nameSize -= 2;
    nameWidth = fontHelveticaBold.widthOfTextAtSize(nameText, nameSize);
  }

  page.drawText(nameText, {
    x: nameCenterX - nameWidth / 2,
    y: 660,
    size: nameSize,
    font: fontHelveticaBold,
    color: rgb(0.69, 0.55, 0.25), // Rich dark gold matching image 2
  });

  // ── Designation line ─────────────────────────────────────────────────────
  const desSize = 27;
  // Draw "Worked as <role> at " in regular weight, then "zenzebra" in bold
  const desPrefix = des ? `Worked as ${des} at ` : 'Worked at ';
  const desZen    = 'zenzebra';
  const desPrefixWidth = fontHelvetica.widthOfTextAtSize(desPrefix, desSize);
  const desZenWidth    = fontHelveticaBold.widthOfTextAtSize(desZen, desSize);
  const desTotalWidth  = desPrefixWidth + desZenWidth;
  const desStartX      = nameCenterX - desTotalWidth / 2;

  page.drawText(desPrefix, {
    x: desStartX,
    y: 515,
    size: desSize,
    font: fontHelvetica,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText(desZen, {
    x: desStartX + desPrefixWidth,
    y: 515,
    size: desSize,
    font: fontHelveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  // ── Date range: bold, larger ─────────────────────────────────────────────
  const dateSize  = 28;
  const dateWidth = fontHelveticaBold.widthOfTextAtSize(dateRangeText, dateSize);
  page.drawText(dateRangeText, {
    x: nameCenterX - dateWidth / 2,
    y: 400,
    size: dateSize,
    font: fontHelveticaBold,
    color: rgb(0.12, 0.12, 0.12),
  });

  // ── Signatory block ───────────────────────────────────────────────────────
  const sigCenterX  = 1550;
  const sigNameSize = 26;
  const sigRoleSize = 20;

  const sigNameWidth = fontHelveticaBold.widthOfTextAtSize(signatoryName, sigNameSize);
  const sigRoleWidth = fontHelvetica.widthOfTextAtSize(signatoryRole, sigRoleSize);

  // Signatory line — gold, centered
  page.drawLine({
    start: { x: sigCenterX - 120, y: 215 },
    end:   { x: sigCenterX + 120, y: 215 },
    thickness: 2,
    color: rgb(0.69, 0.55, 0.25),
  });

  page.drawText(signatoryName, {
    x: sigCenterX - sigNameWidth / 2,
    y: 180,
    size: sigNameSize,
    font: fontHelveticaBold,
    color: rgb(0.08, 0.08, 0.08),
  });

  page.drawText(signatoryRole, {
    x: sigCenterX - sigRoleWidth / 2,
    y: 145,
    size: sigRoleSize,
    font: fontHelvetica,
    color: rgb(0.35, 0.35, 0.35),
  });

  // Embed Signature Image (if uploaded)
  if (sigImage) {
    try {
      const base64Data = sigImage.split(",")[1] || sigImage;
      const sigBuffer = Buffer.from(base64Data, "base64");
      
      let sigEmbeddedImg;
      if (sigImage.includes("image/png")) {
        sigEmbeddedImg = await pdfDoc.embedPng(sigBuffer);
      } else {
        sigEmbeddedImg = await pdfDoc.embedJpg(sigBuffer);
      }
      
      const sigImgWidth = 200;
      const sigImgHeight = 80;
      
      page.drawImage(sigEmbeddedImg, {
        x: sigCenterX - sigImgWidth / 2,
        y: 200,
        width: sigImgWidth,
        height: sigImgHeight,
      });
    } catch {}
  }

  // 7. Save and return PDF bytes
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
