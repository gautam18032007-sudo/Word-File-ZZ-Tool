import { logger } from './logger';

export interface LorDraftPayload {
  fullName: string;
  designation: string;
  department: string;
  joiningDate: string;
  lastWorkingDate: string;
  employmentType: string;
  responsibilities?: string;
  projects?: string;
  strengths?: string;
  additionalInfo?: string;
}

export async function generateLorDraftWithOllama(
  payload: LorDraftPayload
): Promise<string> {
  const ollamaUrl = (process.env.OLLAMA_URL || 'http://localhost:11434').trim().replace(/\/$/, '');
  const modelName = (process.env.OLLAMA_MODEL || 'qwen3:8b').trim();

  // 1. Verify model is installed in local Ollama before sending prompt
  logger.gen(`[Ollama] Verifying model "${modelName}" is installed at URL: ${ollamaUrl}`);
  try {
    const tagsController = new AbortController();
    const tagsTimeout = setTimeout(() => tagsController.abort(), 5000); // 5s timeout for tags fetch
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
    logger.error(`[Ollama] Model check failed: ${errMsg}`);
    throw new Error(`Ollama model check failed: ${errMsg}`);
  }

  const prompt = `You are a senior HR Director.

Write a professional Letter of Recommendation.

Rules:

- Use ONLY supplied information.
- Use responsibilities as evidence.
- Use projects as proof of contribution.
- Use strengths as recommendation points.
- Use additional information only if relevant.
- Never invent achievements.
- Never invent awards.
- Never invent revenue numbers.
- Never invent promotions.
- Never invent certifications.
- Never invent leadership roles.
- Never fabricate achievements.
- Never fabricate promotions.
- Never fabricate certifications.
- Never fabricate leadership positions.
- Use professional HR language.
- Write 4-6 paragraphs.
- No headings.
- No bullet points.
- No markdown.
- Return only recommendation text.

Employee Details

Name: ${payload.fullName}

Department: ${payload.department}

Designation: ${payload.designation}

Joining Date: ${payload.joiningDate}

Last Working Date: ${payload.lastWorkingDate}

Employment Type: ${payload.employmentType}

Responsibilities:
${payload.responsibilities || 'N/A'}

Projects:
${payload.projects || 'N/A'}

Strengths:
${payload.strengths || 'N/A'}

Additional Information:
${payload.additionalInfo || 'N/A'}

Generate the recommendation letter.`;

  logger.gen(`[Ollama] Dispatching LOR draft generation to model "${modelName}" at URL: ${ollamaUrl}`);

  const endpoint = `${ollamaUrl}/api/generate`;
  
  // Set a timeout boundary for Ollama inference request
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds limit

  try {
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
    const responseText = data.response ?? '';

    if (!responseText.trim()) {
      throw new Error('Ollama returned empty response content');
    }

    return responseText.trim();
  } catch (err: any) {
    clearTimeout(timeoutId);
    logger.error(`[Ollama] Draft generation failed: ${err.message || String(err)}`);
    throw err;
  }
}
