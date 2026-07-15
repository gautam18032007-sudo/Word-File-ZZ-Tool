import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET() {
  const ollamaUrl = (process.env.OLLAMA_URL || "http://localhost:11434").trim().replace(/\/$/, "");
  const modelName = (process.env.OLLAMA_MODEL || "qwen3:8b").trim();

  logger.gen(`[Health Check] Checking Ollama connectivity at URL: ${ollamaUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 seconds fast timeout

  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Ollama replied with status ${res.status}`);
    }

    const data = await res.json();
    const models = data.models || [];
    const modelExists = models.some((m: any) => m.name === modelName || m.name.startsWith(`${modelName}:`));

    return NextResponse.json({
      connected: true,
      model: modelName,
      modelFound: modelExists,
      availableModels: models.map((m: any) => m.name),
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    logger.error(`[Health Check] Ollama is offline or model is not loaded: ${err.message || String(err)}`);
    return NextResponse.json({
      connected: false,
      error: err.message || String(err),
      urlUsed: ollamaUrl,
    });
  }
}
