import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { writableDir } from "@/lib/paths";

const CERT_DIR = writableDir("templates/certificates");
const REGISTRY_FILE = path.join(CERT_DIR, "registry.json");

// Default templates list

function readRegistry() {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) {
      return [];
    }
    const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeRegistry(data: any[]) {
  try {
    fs.mkdirSync(CERT_DIR, { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {}
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Signatory defaults request
  if (searchParams.get("defaults") === "true") {
    return NextResponse.json({
      defaultName: process.env.CERTIFICATE_SIGNATORY_NAME ?? "Tanmay Jain",
      defaultRole: process.env.CERTIFICATE_SIGNATORY_ROLE ?? "Co-Founder",
    });
  }

  const custom = readRegistry();
  return NextResponse.json({ templates: custom });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("templateFile") as File;
    const name = formData.get("name") as string;

    if (!file || !name) {
      return NextResponse.json({ error: "Missing file or template name" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    let type: "PNG" | "JPG" | "JPEG" | "PDF";
    if (ext === ".png") type = "PNG";
    else if (ext === ".jpg") type = "JPG";
    else if (ext === ".jpeg") type = "JPEG";
    else if (ext === ".pdf") type = "PDF";
    else {
      return NextResponse.json({ error: "Only PNG, JPG, JPEG, and PDF formats are supported." }, { status: 400 });
    }

    const filename = `custom_${Date.now()}${ext}`;
    const filePath = path.join(CERT_DIR, filename);

    // Save template file to the writable certificates directory
    fs.mkdirSync(CERT_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Also copy to public directory for rendering previews if not on serverless
    if (!process.env.VERCEL) {
      const publicCertDir = path.resolve(process.cwd(), "public/templates/certificates");
      fs.mkdirSync(publicCertDir, { recursive: true });
      fs.writeFileSync(path.join(publicCertDir, filename), buffer);
    }

    const custom = readRegistry();
    const newTemplate = {
      id: `CERT_TEMPLATE_CUSTOM_${Date.now()}`,
      name: name.trim(),
      filename,
      type,
      active: true,
    };
    custom.push(newTemplate);
    writeRegistry(custom);

    return NextResponse.json({ template: newTemplate });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
