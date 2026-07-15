import { NextRequest, NextResponse } from "next/server";
import { generateLorDraftWithOllama, LorDraftPayload } from "@/lib/ollama";
import { generateFallbackLorDraft } from "@/lib/lorFallback";
import { recordAnalytics } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { writableDir } from "@/lib/paths";
import path from "path";
import fs from "fs";

interface CacheEntry {
  draft: string;
  source: string;
  model: string;
  timestamp: number;
}

const draftCache = new Map<string, CacheEntry>();

function logOllamaError(errorMsg: string) {
  try {
    const logDir = writableDir("output");
    const logFile = path.join(logDir, "ollama-errors.log");
    fs.mkdirSync(logDir, { recursive: true });
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    fs.appendFileSync(logFile, `[${timestamp}] ${errorMsg}\n`, "utf-8");
  } catch (e) {
    // Silently ignore error log failures
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
      pronounPreference
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

    recordAnalytics("totalRequests");
    const modelName = (process.env.OLLAMA_MODEL_LOR || "qwen3:32b").trim();

    // Generate a unique serialized key including pronoun preference
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
      pronounPreference: (pronounPreference || "neutral").trim(),
    });

    // Check memory cache
    const cached = draftCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes caching window
      logger.gen(`[api/generate/lor/draft] Returning cached draft for: ${fullName}`);
      recordAnalytics("cacheHits");
      return NextResponse.json({
        success: true,
        source: cached.source,
        draft: cached.draft,
        metadata: {
          generatedBy: cached.source,
          model: cached.model,
          generatedAt: new Date(cached.timestamp).toISOString()
        }
      });
    }

    try {
      logger.gen(`[api/generate/lor/draft] Attempting Ollama draft generation for: ${fullName}`);
      const draft = await generateLorDraftWithOllama(payload);
      
      const now = Date.now();
      // Cache the Ollama response
      draftCache.set(cacheKey, {
        draft,
        source: "ollama",
        model: modelName,
        timestamp: now
      });

      recordAnalytics("ollamaSuccess");

      return NextResponse.json({
        success: true,
        source: "ollama",
        draft,
        metadata: {
          generatedBy: "ollama",
          model: modelName,
          generatedAt: new Date(now).toISOString()
        }
      });
    } catch (err: any) {
      const errMsg = err.message || String(err);
      logger.error(`[api/generate/lor/draft] Ollama generation failed, falling back to deterministic template. Error: ${errMsg}`);
      
      logOllamaError(errMsg);

      const draft = generateFallbackLorDraft(payload);
      const now = Date.now();

      // Cache fallback response to prevent rapid repeated server attempts
      draftCache.set(cacheKey, {
        draft,
        source: "template",
        model: "deterministic-fallback",
        timestamp: now
      });

      recordAnalytics("fallbackUsage");

      return NextResponse.json({
        success: true,
        source: "template",
        draft,
        metadata: {
          generatedBy: "template",
          model: "deterministic-fallback",
          generatedAt: new Date(now).toISOString()
        }
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
