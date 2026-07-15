import { writableDir } from "./paths";
import path from "path";
import fs from "fs";

export interface AIAnalytics {
  totalRequests: number;
  cacheHits: number;
  ollamaSuccess: number;
  fallbackUsage: number;
  retriesAttempted: number;
  lastRequestAt: string;
}

/**
 * Record an AI Workspace event in output/ai-analytics.json
 */
export function recordAnalytics(event: keyof Omit<AIAnalytics, 'lastRequestAt'>) {
  try {
    const logDir = writableDir("output");
    const filePath = path.join(logDir, "ai-analytics.json");
    
    // Ensure output dir exists
    fs.mkdirSync(logDir, { recursive: true });

    let data: AIAnalytics = {
      totalRequests: 0,
      cacheHits: 0,
      ollamaSuccess: 0,
      fallbackUsage: 0,
      retriesAttempted: 0,
      lastRequestAt: ""
    };

    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, "utf8");
        data = JSON.parse(fileContent);
      } catch (e) {
        // Fallback to empty structure on corrupt json
      }
    }

    data[event]++;
    data.lastRequestAt = new Date().toISOString();

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    // Fail silently to avoid breaking execution
  }
}

/**
 * Get current analytics report
 */
export function getAnalytics(): AIAnalytics {
  try {
    const logDir = writableDir("output");
    const filePath = path.join(logDir, "ai-analytics.json");
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf8");
      return JSON.parse(fileContent);
    }
  } catch (e) {
    // Fail silently
  }
  return {
    totalRequests: 0,
    cacheHits: 0,
    ollamaSuccess: 0,
    fallbackUsage: 0,
    retriesAttempted: 0,
    lastRequestAt: ""
  };
}
