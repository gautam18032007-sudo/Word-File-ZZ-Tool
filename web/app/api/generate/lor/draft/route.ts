import { NextRequest, NextResponse } from "next/server";
import { generateLorDraftWithOllama, LorDraftPayload } from "@/lib/ollama";
import { generateFallbackLorDraft } from "@/lib/lorFallback";
import { logger } from "@/lib/logger";
import { writableDir } from "@/lib/paths";
import path from "path";
import fs from "fs";

interface CacheEntry {
  draft: string;
  source: string;
  timestamp: number;
}

// In-memory cache for generated recommendation drafts
const draftCache = new Map<string, CacheEntry>();

function logOllamaError(errorMsg: string) {
  try {
    const logDir = writableDir("output");
    const logFile = path.join(logDir, "ollama-errors.log");
    fs.mkdirSync(logDir, { recursive: true });
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    fs.appendFileSync(logFile, `[${timestamp}] ${errorMsg}\n`, "utf-8");
  } catch (e) {
    // Silently ignore error log failures to avoid disrupting LOR compile flow
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json() as LorDraftPayload;
    const {
      fullName,
      designation,
      joiningDate,
      lastWorkingDate,
    } = payload;

    if (!fullName || !designation || !joiningDate || !lastWorkingDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Required fields missing."
        },
        { status: 400 }
      );
    }

    // Generate a unique serialized key based on the employee details
    const cacheKey = JSON.stringify({
      fullName: (fullName || "").trim(),
      designation: (designation || "").trim(),
      department: (payload.department || "").trim(),
      joiningDate: joiningDate || "",
      lastWorkingDate: lastWorkingDate || "",
      employmentType: (payload.employmentType || "Intern").trim(),
      responsibilities: (payload.responsibilities || "").trim(),
      projects: (payload.projects || "").trim(),
      strengths: (payload.strengths || "").trim(),
      additionalInfo: (payload.additionalInfo || "").trim(),
    });

    // Check memory cache
    const cached = draftCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes caching window
      logger.gen(`[api/generate/lor/draft] Returning cached draft for: ${fullName}`);
      return NextResponse.json({
        success: true,
        source: cached.source,
        draft: cached.draft
      });
    }

    try {
      logger.gen(`[api/generate/lor/draft] Attempting Ollama draft generation for: ${fullName}`);
      const draft = await generateLorDraftWithOllama(payload);
      
      // Cache the Ollama response
      draftCache.set(cacheKey, {
        draft,
        source: "ollama",
        timestamp: Date.now()
      });

      return NextResponse.json({
        success: true,
        source: "ollama",
        draft
      });
    } catch (err: any) {
      const errMsg = err.message || String(err);
      logger.error(`[api/generate/lor/draft] Ollama generation failed, falling back to deterministic template. Error: ${errMsg}`);
      
      // Log local error info to gitignored errors log
      logOllamaError(errMsg);

      const draft = generateFallbackLorDraft(payload);

      // Cache fallback response to prevent rapid repeated server attempts
      draftCache.set(cacheKey, {
        draft,
        source: "template",
        timestamp: Date.now()
      });

      return NextResponse.json({
        success: true,
        source: "template",
        draft
      });
    }
  } catch (err: any) {
    logger.error(`[api/generate/lor/draft] Request parsing error: ${err.message || String(err)}`);
    return NextResponse.json(
      {
        success: false,
        message: "Invalid payload or server parsing error."
      },
      { status: 500 }
    );
  }
}
