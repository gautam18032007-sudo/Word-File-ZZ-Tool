import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { generateCertificatePdf } from "@/lib/pdfLibGenerator";
import { nextContractNumber, buildFilename } from "@/lib/contractNumber";
import { readCertificates, appendCertificate, CertificateRecord } from "@/lib/certStore";
import { logger } from "@/lib/logger";
import { writableDir } from "@/lib/paths";
import { formatDate } from "@/lib/formatting";

const OUTPUT_DIR = path.join(writableDir("output"), "certificates");

// Map template ID to certificateType string
const TYPE_MAP: Record<string, string> = {
  CERT_TEMPLATE_001: "APPRECIATION",
  CERT_TEMPLATE_002: "INTERNSHIP",
  CERT_TEMPLATE_003: "EXPERIENCE",
  CERT_TEMPLATE_004: "TRAINING",
  CERT_TEMPLATE_005: "COMPLETION",
};

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const {
      name,
      designation,
      joiningDate,
      lastWorkingDate,
      templateId,
      templateName,
      signatoryName,
      signatoryRole,
      sigImage,
      force,
    } = payload;

    logger.gen(`[API/generate/certificate] Received request for: "${name || "Unknown"}"`);

    // 1. Validations
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Full Name is required." }, { status: 400 });
    }
    if (name.trim().length < 2) {
      return NextResponse.json({ error: "Full Name must be at least 2 characters." }, { status: 400 });
    }
    if (/^\d+$/.test(name.trim())) {
      return NextResponse.json({ error: "Full Name cannot contain numbers only." }, { status: 400 });
    }
    if (!designation || !designation.trim()) {
      return NextResponse.json({ error: "Designation is required." }, { status: 400 });
    }
    if (!joiningDate || !lastWorkingDate) {
      return NextResponse.json({ error: "Joining Date and Last Working Date are required." }, { status: 400 });
    }

    const jDate = new Date(joiningDate);
    const lDate = new Date(lastWorkingDate);
    if (jDate > lDate) {
      return NextResponse.json({ error: "Joining Date cannot be after Last Working Date" }, { status: 400 });
    }
    if (!templateId) {
      return NextResponse.json({ error: "Certificate Template is required." }, { status: 400 });
    }

    // Determine Certificate Type
    let certType = "CUSTOM";
    if (templateId.startsWith("CERT_TEMPLATE_CUSTOM_")) {
      certType = "CUSTOM";
    } else {
      certType = TYPE_MAP[templateId] ?? "INTERNSHIP";
    }

    // 2. Duplicate Detection
    const history = readCertificates();
    const existing = history.find(
      (c) =>
        c.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        c.joiningDate === joiningDate &&
        c.lastWorkingDate === lastWorkingDate &&
        c.certificateType === certType
    );

    let contractNo = "";
    if (existing) {
      if (!force) {
        // Return 409 Conflict with the existing record to trigger modal choice in UI
        logger.gen(`[API/generate/certificate] Duplicate certificate found for ${name}: ${existing.id}`);
        return NextResponse.json(
          {
            error: "Certificate already exists",
            contractNo: existing.id,
            pdfName: existing.pdf,
            existing: true,
          },
          { status: 409 }
        );
      } else {
        // Overwrite / regenerate existing certificate, reuse number
        contractNo = existing.id;
        logger.gen(`[API/generate/certificate] Force regeneration approved. Reusing sequence: ${contractNo}`);
      }
    } else {
      // New certificate number sequence
      contractNo = nextContractNumber("CERT");
      logger.gen(`[API/generate/certificate] Generated new certificate sequence: ${contractNo}`);
    }

    // 3. Generate PDF
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    const pdfBytes = await generateCertificatePdf({
      name,
      designation,
      joiningDate,
      lastWorkingDate,
      templateId,
      signatoryName,
      signatoryRole,
      sigImage,
    });

    const pdfName = buildFilename(contractNo, name, "pdf");
    const pdfPath = path.join(OUTPUT_DIR, pdfName);

    // Save File
    fs.writeFileSync(pdfPath, pdfBytes);
    logger.gen(`[API/generate/certificate] Saved PDF file: ${pdfName}`);

    // Verify PDF Generated Successfully
    if (!fs.existsSync(pdfPath) || fs.statSync(pdfPath).size < 100) {
      throw new Error("Failed to verify generated PDF file.");
    }

    // 4. Save/Update History
    const record: CertificateRecord = {
      id: contractNo,
      module: "certificate",
      certificateType: certType,
      template: templateName || "Certificate",
      name: name.trim(),
      designation: designation.trim(),
      joiningDate,
      lastWorkingDate,
      generatedAt: new Date().toISOString(),
      pdf: pdfName,
    };

    if (existing) {
      // Overwrite history record instead of appending new duplicate
      const storeFile = path.join(writableDir("output"), "certificates.json");
      const updatedHistory = history.map((h) => (h.id === contractNo ? record : h));
      fs.writeFileSync(storeFile, JSON.stringify(updatedHistory, null, 2), "utf-8");
      logger.gen(`[API/generate/certificate] Updated history record for ${contractNo}`);
    } else {
      // Append new history record
      appendCertificate(record);
      logger.gen(`[API/generate/certificate] Appended new history record for ${contractNo}`);
    }

    return NextResponse.json({ contractNo, pdfName, pdfBase64: pdfBytes.toString('base64') });
  } catch (e: any) {
    const errMsg = e.message || String(e);
    logger.error(`[API/generate/certificate] Generation failed: ${errMsg}`);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
