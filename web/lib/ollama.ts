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

function formatDateMMM_YYYY(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  const d = new Date(clean.includes('T') ? clean : clean + 'T00:00:00');
  if (isNaN(d.getTime())) return clean;
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${month}, ${year}`;
}

export async function generateLorDraftWithOllama(
  payload: LorDraftPayload
): Promise<string> {
  const ollamaUrl = (process.env.OLLAMA_URL || 'http://localhost:11434').trim().replace(/\/$/, '');
  const modelName = (process.env.OLLAMA_MODEL_LOR || 'qwen3:32b').trim();
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

  const formattedJoining = formatDateMMM_YYYY(payload.joiningDate);
  const formattedLwd = formatDateMMM_YYYY(payload.lastWorkingDate);
  const periodLabel = (payload.employmentType || '').toLowerCase().includes('intern')
    ? 'internship period'
    : 'tenure';

  let pronounObj = 'them';
  let pronounSubj = 'they';
  let pronounPoss = 'their';
  const pref = (payload.pronounPreference || '').toLowerCase().trim();

  if (pref === 'female' || pref.includes('female') || pref === 'she' || pref === 'her') {
    pronounObj = 'her';
    pronounSubj = 'she';
    pronounPoss = 'her';
  } else if (pref === 'male' || pref.includes('male') || pref === 'he' || pref === 'him') {
    pronounObj = 'him';
    pronounSubj = 'he';
    pronounPoss = 'his';
  }

  const prompt = `You are a senior HR Director at Bohemian Curations Private Limited (ZenZebra).

Write a professional 4-paragraph Letter of Recommendation for the employee below, matching the reference structure and tone exactly.

Write this the way an experienced HR professional would actually write it by hand — not by filling in a template. Vary sentence structure and length naturally across paragraphs; don't make every paragraph the same shape or length.

Avoid stock corporate phrases like 'demonstrated dedication', 'high degree of professionalism', 'carried out assigned responsibilities diligently' unless they genuinely fit what was actually described — prefer specific, concrete language drawn from the Department/Team, Designation/Role, Responsibilities, and Projects fields over generic praise.

Every field provided — Department/Team, Designation/Role, Responsibilities, Projects, Strengths, and Additional Information — should be reflected somewhere in the letter. If Additional Information contains something specific and factual (a promotion, an extension, a particular achievement), weave it naturally into whichever paragraph fits best rather than bolting it on as an obviously separate final sentence.

REFERENCE STRUCTURE AND TONE (MATCH EXACTLY):
Paragraph 1: "This is to certify that ${payload.fullName} was associated with Bohemian Curations Private Limited (ZenZebra) as a ${payload.designation} from ${formattedJoining} to ${formattedLwd}."
Paragraph 2: During the tenure, describe key responsibilities and projects in flowing prose (3-4 sentences max).
Paragraph 3: Throughout the internship/tenure, describe demonstrated qualities and strengths (2 sentences max). Blend strengths into natural sentences; do not itemize every keyword.
Paragraph 4: "We appreciate the efforts and contributions made during the ${periodLabel} and wish ${pronounObj} success in all future academic and professional endeavors."

Rules:
- Do not include any meta-commentary, notes, headers, bullet points, or markdown. Output ONLY the 4-paragraph letter text.
- If any input field contains first-person language ('I did X'), rewrite it in third person (${pronounSubj}/${pronounObj}).
- Total length: 4 paragraphs, ~120-160 words total.
- Use dates formatted as "MMM, YYYY" (e.g. "${formattedJoining}"). Do NOT use ordinal day format.
- Do not fabricate achievements, awards, promotions, or roles.

Employee Details:
Name: ${payload.fullName}
Department: ${payload.department || 'N/A'}
Designation: ${payload.designation}
Joining Date: ${formattedJoining}
Last Working Date: ${formattedLwd}
Employment Type: ${payload.employmentType || 'Intern'}
Responsibilities: ${payload.responsibilities || 'N/A'}
Projects: ${payload.projects || 'N/A'}
Strengths: ${payload.strengths || 'N/A'}
Additional Info: ${payload.additionalInfo || 'N/A'}

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

  // 3. Reject if the response is under ~90 words
  const wordCount = trimmedResponse.split(/\s+/).length;
  if (wordCount < 90) {
    logger.error(`[Ollama] Validation failed: Response has only ${wordCount} words (minimum 90 required).`);
    throw new Error("Validation failed: Draft is under 90 words");
  }

  // 4. Reject if response contains forbidden markdown symbols
  if (/[#\*]|- /g.test(trimmedResponse)) {
    logger.error("[Ollama] Validation failed: Response contains forbidden markdown symbols (headings, bold, or bullets).");
    throw new Error("Validation failed: Output contains forbidden markdown symbols");
  }

  return trimmedResponse;
}
