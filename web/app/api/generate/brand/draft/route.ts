import { NextRequest, NextResponse } from "next/server";
import { generateWithOllamaRouter } from "@/lib/ollamaRouter";
import { generateFallbackBrandDraft, BrandDraftPayload, BrandDraftResult } from "@/lib/brandFallback";
import { buildPrompt } from "@/lib/promptManager";
import { recordAnalytics } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { writableDir } from "@/lib/paths";
import path from "path";
import fs from "fs";

interface CacheEntry {
  suggestions: BrandDraftResult;
  source: string;
  model: string;
  timestamp: number;
}

const brandCache = new Map<string, CacheEntry>();

function logOllamaError(errorMsg: string) {
  try {
    const logDir = writableDir("output");
    const logFile = path.join(logDir, "ollama-errors.log");
    fs.mkdirSync(logDir, { recursive: true });
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    fs.appendFileSync(logFile, `[${timestamp}] ${errorMsg}\n`, "utf-8");
  } catch (e) {
    // Silently ignore log write errors
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json() as BrandDraftPayload;
    const { legalName, brandCategory } = payload;

    if (!legalName || !brandCategory) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    recordAnalytics("totalRequests");
    const modelName = (process.env.OLLAMA_MODEL_BRAND || "qwen3:14b").trim();

    // Create unique cache key
    const cacheKey = JSON.stringify({
      legalName: (legalName || "").trim(),
      brandCategory: (brandCategory || "").trim(),
      setupLocation: (payload.setupLocation || "").trim(),
      totalAmount: payload.totalAmount || 0,
    });

    // Check Cache
    const cached = brandCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes caching window
      logger.gen(`[api/generate/brand/draft] Returning cached suggestions for: ${legalName}`);
      recordAnalytics("cacheHits");
      return NextResponse.json({
        success: true,
        source: cached.source,
        suggestions: cached.suggestions,
        metadata: {
          generatedBy: cached.source,
          model: cached.model,
          generatedAt: new Date(cached.timestamp).toISOString()
        }
      });
    }

    try {
      logger.gen(`[api/generate/brand/draft] Building template prompt for ${legalName}`);
      const prompt = buildPrompt("brand", {
        legalName,
        brandCategory,
        setupLocation: payload.setupLocation || "N/A",
        totalAmount: payload.totalAmount ? `₹${payload.totalAmount.toLocaleString('en-IN')}` : "N/A"
      });

      logger.gen(`[api/generate/brand/draft] Generating suggestions via Ollama`);
      const rawText = await generateWithOllamaRouter({ module: "brand", prompt });
      
      // Clean JSON text block from raw output
      let jsonText = rawText.trim();
      const startIdx = jsonText.indexOf('{');
      const endIdx = jsonText.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonText = jsonText.substring(startIdx, endIdx + 1);
      }

      const parsed = JSON.parse(jsonText);
      const suggestions: BrandDraftResult = {
        scopeOfWork: parsed.scopeOfWork || "",
        deliverables: parsed.deliverables || "",
        partnershipSummary: parsed.partnershipSummary || "",
        brandDescription: parsed.brandDescription || ""
      };

      const now = Date.now();
      brandCache.set(cacheKey, {
        suggestions,
        source: "ollama",
        model: modelName,
        timestamp: now
      });

      recordAnalytics("ollamaSuccess");

      return NextResponse.json({
        success: true,
        source: "ollama",
        suggestions,
        metadata: {
          generatedBy: "ollama",
          model: modelName,
          generatedAt: new Date(now).toISOString()
        }
      });

    } catch (err: any) {
      const errMsg = err.message || String(err);
      logger.error(`[api/generate/brand/draft] Ollama failed, using fallback. Error: ${errMsg}`);
      logOllamaError(`[Brand] ${errMsg}`);

      const fallback = generateFallbackBrandDraft(payload);
      const now = Date.now();

      brandCache.set(cacheKey, {
        suggestions: fallback,
        source: "template",
        model: "deterministic-fallback",
        timestamp: now
      });

      recordAnalytics("fallbackUsage");

      return NextResponse.json({
        success: true,
        source: "template",
        suggestions: fallback,
        metadata: {
          generatedBy: "template",
          model: "deterministic-fallback",
          generatedAt: new Date(now).toISOString()
        }
      });
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
