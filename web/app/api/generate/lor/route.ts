import { NextRequest, NextResponse } from "next/server";
import { generateLor } from "@/lib/lorGenerator";
import { nextContractNumber } from "@/lib/contractNumber";
import { appendLorHistory, LorHistoryRecord } from "@/lib/lorStore";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const {
      fullName,
      designation,
      department,
      joiningDate,
      lastWorkingDate,
      employmentType,
      email,
      signatoryName,
      signatoryRole,
      draftGeneratedByAI,
      aiDraft,
      finalDraft,
      edited,
      aiModelVersion,
      generatedBy,
    } = payload;

    logger.gen(`[API/generate/lor] Received LOR generation request for candidate: "${fullName || "Unknown"}"`);

    // 1. Validations
    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ error: "Full Name is required." }, { status: 400 });
    }
    if (!designation || !designation.trim()) {
      return NextResponse.json({ error: "Designation is required." }, { status: 400 });
    }
    if (!joiningDate) {
      return NextResponse.json({ error: "Joining Date is required." }, { status: 400 });
    }
    if (!lastWorkingDate) {
      return NextResponse.json({ error: "Last Working Date is required." }, { status: 400 });
    }
    if (!finalDraft || !finalDraft.trim()) {
      return NextResponse.json({ error: "Final Draft body text is required." }, { status: 400 });
    }

    const jDate = new Date(joiningDate);
    const lDate = new Date(lastWorkingDate);
    if (jDate > lDate) {
      return NextResponse.json({ error: "Joining Date cannot be after Last Working Date." }, { status: 400 });
    }

    // 2. Generate LOR Number
    const lorNumber = nextContractNumber("LOR");
    logger.gen(`[API/generate/lor] Allocated LOR sequence number: ${lorNumber}`);

    // 3. Generate LOR documents
    const result = await generateLor({
      fullName: fullName.trim(),
      designation: designation.trim(),
      department: (department || "").trim(),
      joiningDate,
      lastWorkingDate,
      finalDraft: finalDraft.trim(),
      signatoryName: (signatoryName || "Tanmay Jain").trim(),
      signatoryRole: (signatoryRole || "Co-Founder").trim(),
      lorNumber,
    });


    // 4. Save/Append history
    const record: LorHistoryRecord = {
      id: lorNumber,
      lorNumber,
      fullName: fullName.trim(),
      designation: designation.trim(),
      department: (department || "").trim(),
      joiningDate,
      lastWorkingDate,
      employmentType: (employmentType || "Intern").trim(),
      email: (email || "").trim(),
      signatoryName: (signatoryName || "Tanmay Jain").trim(),
      signatoryRole: (signatoryRole || "Co-Founder").trim(),
      generatedAt: new Date().toISOString(),
      aiModelVersion: aiModelVersion || (generatedBy === "ollama" ? (process.env.OLLAMA_MODEL || "qwen3:8b") : (generatedBy === "template" ? "template" : "manual")),
      draftGeneratedByAI: generatedBy === "ollama",
      aiDraft: aiDraft || null,
      finalDraft: finalDraft.trim(),
      edited: !!edited,
      docxFile: result.docxFile,
      pdfFile: result.pdfFile,
      generatedBy: generatedBy || "manual",
    };

    appendLorHistory(record);
    logger.gen(`[API/generate/lor] Saved LOR history and documents for ${lorNumber}`);

    return NextResponse.json({
      success: true,
      lorNumber,
      docxFile: result.docxFile,
      pdfFile: result.pdfFile,
      message: !result.pdfFile ? 'PDF conversion available only in local environment.' : undefined,
    });


  } catch (e: any) {
    const errMsg = e.message || String(e);
    logger.error(`[API/generate/lor] Generation failed: ${errMsg}`);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
