import { logger } from './logger';
import { recordAnalytics } from './analytics';

export type OllamaModule = 'employee' | 'brand' | 'certificate' | 'lor';

export interface OllamaRequestOptions {
  module: OllamaModule;
  prompt: string;
}

export async function generateWithOllamaRouter(options: OllamaRequestOptions): Promise<string> {
  const { module, prompt } = options;

  const ollamaUrl = (process.env.OLLAMA_URL || 'http://localhost:11434').trim().replace(/\/$/, '');
  
  // Resolve model name dynamically based on module config
  let modelName = 'qwen3:14b';
  if (module === 'employee') {
    modelName = (process.env.OLLAMA_MODEL_EMPLOYEE || 'qwen3:14b').trim();
  } else if (module === 'brand') {
    modelName = (process.env.OLLAMA_MODEL_BRAND || 'qwen3:14b').trim();
  } else if (module === 'certificate') {
    modelName = (process.env.OLLAMA_MODEL_CERTIFICATE || 'qwen3:14b').trim();
  } else if (module === 'lor') {
    modelName = (process.env.OLLAMA_MODEL_LOR || 'qwen3:32b').trim();
  }

  // 1. Verify model is installed in local Ollama instance
  logger.gen(`[Ollama Router] Routing module "${module}" to model "${modelName}" at URL: ${ollamaUrl}`);
  try {
    const tagsController = new AbortController();
    const tagsTimeout = setTimeout(() => tagsController.abort(), 4000); // 4 seconds timeout for check
    const tagsRes = await fetch(`${ollamaUrl}/api/tags`, { signal: tagsController.signal });
    clearTimeout(tagsTimeout);

    if (tagsRes.ok) {
      const tagsData = await tagsRes.json();
      const models = tagsData.models || [];
      const modelExists = models.some((m: any) => m.name === modelName || m.name.startsWith(`${modelName}:`));
      if (!modelExists) {
        throw new Error(`Configured model "${modelName}" is not installed in local Ollama instance.`);
      }
    } else {
      throw new Error(`Ollama tags endpoint returned status ${tagsRes.status}`);
    }
  } catch (err: any) {
    const errMsg = err.message || String(err);
    logger.error(`[Ollama Router] Model check failed for "${modelName}": ${errMsg}`);
    throw new Error(`Ollama model check failed for "${modelName}": ${errMsg}`);
  }

  // 2. Dispatch prompt to Ollama generate API with Smart Retry Layer (up to 2 retries)
  const endpoint = `${ollamaUrl}/api/generate`;
  const maxRetries = 2;
  let attempts = 0;
  let success = false;
  let responseText = '';

  while (attempts <= maxRetries && !success) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds execution limit

    try {
      if (attempts > 0) {
        logger.gen(`[Ollama Router] Retry attempt ${attempts}/${maxRetries} for model "${modelName}"`);
        recordAnalytics("retriesAttempted");
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          prompt: prompt,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Ollama responded with status ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      responseText = data.response ?? '';

      if (!responseText.trim()) {
        throw new Error('Ollama returned empty response content');
      }

      success = true;
    } catch (err: any) {
      clearTimeout(timeoutId);
      attempts++;
      if (attempts > maxRetries) {
        logger.error(`[Ollama Router] Prompt execution failed after ${attempts} attempts for "${modelName}": ${err.message || String(err)}`);
        throw err;
      }
    }
  }

  return responseText.trim();
}
