import { NextRequest, NextResponse } from "next/server";
import { generateWithOllamaRouter } from "@/lib/ollamaRouter";
import { generateFallbackEmployeeDraft, EmployeeDraftPayload, EmployeeDraftResult } from "@/lib/employeeFallback";
import { buildPrompt } from "@/lib/promptManager";
import { recordAnalytics } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { writableDir } from "@/lib/paths";
import path from "path";
import fs from "fs";

interface CacheEntry {
  suggestions: EmployeeDraftResult;
  source: string;
  model: string;
  timestamp: number;
}

const employeeCache = new Map<string, CacheEntry>();

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
    const payload = await req.json() as EmployeeDraftPayload;
    const { name, designation, department, annualCTC } = payload;

    if (!name || !designation) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    recordAnalytics("totalRequests");
    const modelName = (process.env.OLLAMA_MODEL_EMPLOYEE || "qwen3:14b").trim();

    // Create unique cache key
    const cacheKey = JSON.stringify({
      name: (name || "").trim(),
      designation: (designation || "").trim(),
      department: (department || "").trim(),
      annualCTC: annualCTC || 0,
    });

    // Check Cache
    const cached = employeeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes caching window
      logger.gen(`[api/generate/employee/draft] Returning cached suggestions for: ${name}`);
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
      logger.gen(`[api/generate/employee/draft] Building template prompt for ${name}`);
      const prompt = buildPrompt("employee", {
        name,
        designation,
        department: department || "N/A",
        annualCTC: annualCTC ? `₹${annualCTC.toLocaleString('en-IN')}` : "N/A"
      });

      logger.gen(`[api/generate/employee/draft] Generating suggestions via Ollama`);
      const rawText = await generateWithOllamaRouter({ module: "employee", prompt });
      
      // Clean JSON text block from raw output
      let jsonText = rawText.trim();
      const startIdx = jsonText.indexOf('{');
      const endIdx = jsonText.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonText = jsonText.substring(startIdx, endIdx + 1);
      }

      const parsed = JSON.parse(jsonText);
      const suggestions: EmployeeDraftResult = {
        responsibilities: parsed.responsibilities || "",
        probationTerms: parsed.probationTerms || "",
        workDescription: parsed.workDescription || "",
        professionalSummary: parsed.professionalSummary || ""
      };

      const now = Date.now();
      employeeCache.set(cacheKey, {
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
      logger.error(`[api/generate/employee/draft] Ollama failed, using fallback. Error: ${errMsg}`);
      logOllamaError(`[Employee] ${errMsg}`);

      const fallback = generateFallbackEmployeeDraft(payload);
      const now = Date.now();
      
      employeeCache.set(cacheKey, {
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
