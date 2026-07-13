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

  // 4. White-mask pre-printed regions for default "Certificate of Appreciation" template
  if (templateId === "CERT_TEMPLATE_001") {
    const maskColor = rgb(1, 1, 1); // Pure white
    
    // Mask Name: y ranges from 611 to 778 in PDF-coordinates
    page.drawRectangle({
      x: 350,
      y: 611,
      width: 1300,
      height: 170,
      color: maskColor,
    });

    // Mask Role: y ranges from 532 to 555
    page.drawRectangle({
      x: 350,
      y: 520,
      width: 1300,
      height: 50,
      color: maskColor,
    });

    // Mask Date Range: y ranges from 397 to 461
    page.drawRectangle({
      x: 350,
      y: 380,
      width: 1300,
      height: 90,
      color: maskColor,
    });

    // Mask Signatory name/role/sig: y ranges from 70 to 320, bottom-right side
    page.drawRectangle({
      x: 1300,
      y: 70,
      width: 500,
      height: 250,
      color: maskColor,
    });
  }

  // 5. Load fonts
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 6. Draw dynamic text overlays
  // Format Date Range: e.g. "15 June 2026 – 16 September 2026"
  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    const day = d.getDate();
    const month = d.toLocaleString("en-GB", { month: "long" });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const startFmt = formatDate(joiningDate);
  const endFmt = formatDate(lastWorkingDate);
  const dateRangeText = startFmt && endFmt ? `${startFmt} – ${endFmt}` : "";

  const nameText = name.trim();
  const designationText = `Worked as ${designation.trim()}`;

  // Center Name
  const nameSize = 48;
  const nameWidth = fontHelveticaBold.widthOfTextAtSize(nameText, nameSize);
  page.drawText(nameText, {
    x: (width - nameWidth) / 2,
    y: 694,
    size: nameSize,
    font: fontHelveticaBold,
    color: rgb(0.12, 0.12, 0.12),
  });

  // Center Designation
  const desSize = 24;
  const desWidth = fontHelvetica.widthOfTextAtSize(designationText, desSize);
  page.drawText(designationText, {
    x: (width - desWidth) / 2,
    y: 535,
    size: desSize,
    font: fontHelvetica,
    color: rgb(0.24, 0.24, 0.24),
  });

  // Center Date Range
  const dateSize = 20;
  const dateWidth = fontHelvetica.widthOfTextAtSize(dateRangeText, dateSize);
  page.drawText(dateRangeText, {
    x: (width - dateWidth) / 2,
    y: 415,
    size: dateSize,
    font: fontHelvetica,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Position Signatory Name & Role on the bottom right (centered around X=1550)
  const sigNameSize = 22;
  const sigRoleSize = 16;
  const sigCenterX = 1550;

  const sigNameWidth = fontHelveticaBold.widthOfTextAtSize(signatoryName, sigNameSize);
  const sigRoleWidth = fontHelvetica.widthOfTextAtSize(signatoryRole, sigRoleSize);

  // Draw signatory line
  page.drawLine({
    start: { x: sigCenterX - 100, y: 200 },
    end: { x: sigCenterX + 100, y: 200 },
    thickness: 1.5,
    color: rgb(0.74, 0.6, 0.4), // Gold-ish color matching the template branding
  });

  page.drawText(signatoryName, {
    x: sigCenterX - sigNameWidth / 2,
    y: 170,
    size: sigNameSize,
    font: fontHelveticaBold,
    color: rgb(0.12, 0.12, 0.12),
  });

  page.drawText(signatoryRole, {
    x: sigCenterX - sigRoleWidth / 2,
    y: 135,
    size: sigRoleSize,
    font: fontHelvetica,
    color: rgb(0.4, 0.4, 0.4),
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
