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
  pronounPreference?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateLorDraftWithOllama(
  payload: LorDraftPayload
): Promise<string> {
  const ollamaUrl = (process.env.OLLAMA_URL || 'http://localhost:11434').trim().replace(/\/$/, '');
  const modelName = (process.env.OLLAMA_MODEL || 'qwen3:8b').trim();
  const timeoutMs = process.env.OLLAMA_TIMEOUT_MS ? parseInt(process.env.OLLAMA_TIMEOUT_MS, 10) : 30000;

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
        logger.error(`[Ollama] Configured model "${modelName}" not found in tags list. Attempting actual generation anyway.`);
      }
    } else {
      logger.error(`[Ollama] Tags endpoint returned status ${tagsRes.status}. Attempting actual generation anyway.`);
    }
  } catch (err: any) {
    const errMsg = err.message || String(err);
    logger.error(`[Ollama] Tags verification check warning: ${errMsg}. Proceeding to attempt actual generation once anyway.`);
  }

  const prompt = `You are a senior HR Director.

Write a professional Letter of Recommendation.

Rules:

- Do not include any meta-commentary, instructions, or notes about how to use this letter. Output ONLY the letter body text.
- If any input field contains first-person language (e.g. 'I did X'), rewrite it in third person as if describing the employee, not quoting them.
- Do not repeat the candidate's full name more than twice in the entire letter — use pronouns after the first two mentions.
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

  const endpoint = `${ollamaUrl}/api/generate`;

  let attempt = 1;
  const maxAttempts = 3;
  let responseText = "";

  while (attempt <= maxAttempts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      logger.gen(`[Ollama] Dispatching LOR draft generation (Attempt ${attempt}/${maxAttempts}) to model "${modelName}" at URL: ${ollamaUrl}`);
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
      break;
    } catch (err: any) {
      clearTimeout(timeoutId);
      logger.error(`[Ollama] Attempt ${attempt} failed: ${err.message || String(err)}`);

      if (attempt < maxAttempts) {
        attempt++;
        logger.gen(`[Ollama] Waiting 1.5s before retry...`);
        await sleep(1500);
      } else {
        throw err;
      }
    }
  }

  const trimmedResponse = responseText.trim();

  // 1. Validate response exists
  if (!trimmedResponse) {
    throw new Error("Validation failed: Ollama returned empty response content");
  }

  // 2. Reject if raw additionalInfo raw text leaked verbatim under "Note:"
  if (payload.additionalInfo && payload.additionalInfo.trim()) {
    const rawNoteText = payload.additionalInfo.trim();
    if (trimmedResponse.toLowerCase().includes("note:") && trimmedResponse.toLowerCase().includes(rawNoteText.toLowerCase())) {
      logger.error("[Ollama] Validation failed: Response contains leaked raw additionalInfo text under a Note.");
      throw new Error("Validation failed: Model leaked additionalInfo raw instructions");
    }
  }

  // 3. Reject if the response is under ~150 words
  const wordCount = trimmedResponse.split(/\s+/).length;
  if (wordCount < 150) {
    logger.error(`[Ollama] Validation failed: Response has only ${wordCount} words (minimum 150 required).`);
    throw new Error("Validation failed: Draft is under 150 words");
  }

  // 4. Reject if response contains forbidden markdown symbols
  if (/[#\*]|- /g.test(trimmedResponse)) {
    logger.error("[Ollama] Validation failed: Response contains forbidden markdown symbols (headings, bold, or bullets).");
    throw new Error("Validation failed: Output contains forbidden markdown symbols");
  }

  return trimmedResponse;
}
