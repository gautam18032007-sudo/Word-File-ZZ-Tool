import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getAnalytics } from "@/lib/analytics";

export async function GET() {
  const ollamaUrl = (process.env.OLLAMA_URL || "http://localhost:11434").trim().replace(/\/$/, "");
  
  const models = {
    employee: (process.env.OLLAMA_MODEL_EMPLOYEE || "qwen3:14b").trim(),
    brand: (process.env.OLLAMA_MODEL_BRAND || "qwen3:14b").trim(),
    lor: (process.env.OLLAMA_MODEL_LOR || "qwen3:32b").trim(),
    certificate: (process.env.OLLAMA_MODEL_CERTIFICATE || "qwen3:14b").trim(),
  };

  logger.gen(`[Health Check] Checking Ollama connectivity at URL: ${ollamaUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds fast timeout

  const startTime = Date.now();
  const analytics = getAnalytics();

  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Ollama replied with status ${res.status}`);
    }

    const data = await res.json();
    const installedModels = data.models || [];
    const installedNames = installedModels.map((m: any) => m.name);

    // Map each module to whether its configured model is present
    const modelFound = {
      employee: installedNames.some((name: string) => name === models.employee || name.startsWith(`${models.employee}:`)),
      brand: installedNames.some((name: string) => name === models.brand || name.startsWith(`${models.brand}:`)),
      lor: installedNames.some((name: string) => name === models.lor || name.startsWith(`${models.lor}:`)),
      certificate: installedNames.some((name: string) => name === models.certificate || name.startsWith(`${models.certificate}:`)),
    };

    // Calculate cache hit rate safely
    const cacheHitRate = analytics.totalRequests > 0 
      ? `${Math.round((analytics.cacheHits / analytics.totalRequests) * 100)}%`
      : "0%";

    return NextResponse.json({
      connected: true,
      responseTime: `${responseTimeMs}ms`,
      configuredModels: models,
      installedModels: installedNames,
      modelFoundStatus: modelFound,
      analytics: {
        ...analytics,
        cacheHitRate
      }
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    logger.error(`[Health Check] Ollama is offline or model check failed: ${err.message || String(err)}`);
    return NextResponse.json({
      connected: false,
      error: err.message || String(err),
      urlUsed: ollamaUrl,
      analytics
    });
  }
}
