import { LorDraftPayload } from './ollama';

/**
 * Remove trailing periods and trim text to avoid double-punctuation
 */
function cleanPunctuation(text: string): string {
  if (!text) return "";
  return text.trim().replace(/\.+$/, "").trim();
}

/**
 * Remove extra spaces before punctuation globally and collapse multiple spaces.
 * Fixes "internship , took" -> "internship, took".
 */
function normalizePunctuationSpaces(text: string): string {
  if (!text) return "";
  return text
    .replace(/\s+([,.!?:;])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lowercase the first letter of mid-sentence spliced text unless it's an acronym/proper noun.
 */
function lowercaseFirstChar(text: string): string {
  if (!text) return "";
  const clean = text.trim();
  if (!clean) return "";
  const firstWord = clean.split(/\s+/)[0];
  if (firstWord.length > 1 && firstWord === firstWord.toUpperCase()) {
    return clean; // Acronym like REST, AWS, SQL
  }
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}

/**
 * Perform a lightweight first-person -> third-person conversion step
 * on candidate inputs.
 */
function convertToThirdPerson(text: string, subj: string = "they", obj: string = "them", poss: string = "their"): string {
  if (!text) return "";
  let cleaned = text.trim();

  const haveVerb = (subj === 'they') ? 'have' : 'has';
  const beVerb = (subj === 'they') ? 'are' : 'is';
  const wasVerb = (subj === 'they') ? 'were' : 'was';

  // Replace common first-person patterns
  cleaned = cleaned
    .replace(/\bI've\b/gi, `${subj} ${haveVerb}`)
    .replace(/\bI'm\b/gi, `${subj} ${beVerb}`)
    .replace(/\bI am\b/gi, `${subj} ${beVerb}`)
    .replace(/\bI was\b/gi, `${subj} ${wasVerb}`)
    .replace(/\bI have\b/gi, `${subj} ${haveVerb}`)
    .replace(/\bI did\b/gi, `${subj} did`)
    .replace(/\bI worked\b/gi, `${subj} worked`)
    .replace(/\bI managed\b/gi, `${subj} managed`)
    .replace(/\bI handled\b/gi, `${subj} handled`)
    .replace(/\bI coordinated\b/gi, `${subj} coordinated`)
    .replace(/\bI learned\b/gi, `${subj} learned`)
    .replace(/\bI contributed\b/gi, `${subj} contributed`)
    .replace(/\bI assisted\b/gi, `${subj} assisted`)
    .replace(/\bmy\b/gi, poss)
    .replace(/\bme\b/gi, obj);

  const capSubj = subj.charAt(0).toUpperCase() + subj.slice(1);
  const capPoss = poss.charAt(0).toUpperCase() + poss.slice(1);

  // Capitalize sentence-starting subject pronoun
  const subjRegex = new RegExp(`(^|[.!?]\\s+)\\b${subj}\\b`, 'g');
  cleaned = cleaned.replace(subjRegex, (match, prefix) => prefix + capSubj);

  // Capitalize sentence-starting possessive pronoun
  const possRegex = new RegExp(`(^|[.!?]\\s+)\\b${poss}\\b`, 'g');
  cleaned = cleaned.replace(possRegex, (match, prefix) => prefix + capPoss);

  // Capitalize sentence-starting "I" that might not have matched first-person verb patterns
  cleaned = cleaned.replace(/(?:^|[.!?]\s+)\bI\b/g, (match) => match.replace("I", capSubj));
  cleaned = cleaned.replace(/\bI\b/g, subj);

  return cleaned;
}

const IRREGULAR_VERBS: Record<string, string> = {
  did: "doing",
  done: "doing",
  led: "leading",
  built: "building",
  took: "taking",
  ran: "running",
  sold: "selling",
  held: "holding",
  wrote: "writing",
  spoke: "speaking",
  taught: "teaching",
  brought: "bringing",
  thought: "thinking",
  sent: "sending",
  spent: "spending",
  met: "meeting",
  got: "getting",
  made: "making",
  gave: "giving",
  kept: "keeping",
  dealt: "dealing",
  had: "having",
  was: "being",
  were: "being",
  began: "beginning",
  grew: "growing",
  drove: "driving",
  chose: "choosing",
};

function convertVerbToGerund(word: string): string {
  if (!word) return "";
  const cleanWord = word.trim();
  const lower = cleanWord.toLowerCase();

  // 1. Check irregular dictionary (past tense -> gerund)
  if (IRREGULAR_VERBS[lower]) {
    const gerund = IRREGULAR_VERBS[lower];
    return cleanWord[0] === cleanWord[0].toUpperCase()
      ? gerund.charAt(0).toUpperCase() + gerund.slice(1)
      : gerund;
  }

  // 2. Check regular "-ed" verbs (strip "ed" and append "ing")
  if (lower.endsWith("ed") && lower.length > 3) {
    const base = cleanWord.slice(0, -2);
    return base + "ing";
  }

  // 3. Already ending in "ing" or not a recognized past-tense verb
  return cleanWord;
}

function sanitizeSingleClause(clauseText: string): string {
  if (!clauseText) return "";
  let c = clauseText.trim();
  if (!c) return "";

  // 2a. Strip leading subject/auxiliary pronouns or conjunctions from start of clause
  c = c.replace(/^(and|&)\s+/i, "");
  c = c.replace(/^(I|they|he|she)\s+(was\s+responsible\s+for|were\s+responsible\s+for)\s+/i, "");
  c = c.replace(/^(was\s+responsible\s+for|were\s+responsible\s+for)\s+/i, "");
  c = c.replace(/^(I|they|he|she)\s+(have|has|had|did|were|was)\s+/i, "");
  c = c.replace(/^(I|they|he|she)\s+/i, "");
  c = c.replace(/^(have|has|had)\s+/i, "");
  c = c.replace(/^(was|were)\s+/i, "");

  c = normalizePunctuationSpaces(c);
  if (!c) return "";

  // 2b. Convert clause's leading verb to gerund
  const words = c.split(/\s+/);
  const firstWord = words[0];
  const restWords = words.slice(1).join(" ");

  const convertedFirst = convertVerbToGerund(firstWord);
  const fullClause = restWords ? `${convertedFirst} ${restWords}` : convertedFirst;

  // 2c. Lowercase clause's first letter after conversion
  return lowercaseFirstChar(fullClause);
}

/**
 * Clause-level converter: splits on commas and "and", converts each clause,
 * and rejoins cleanly with Oxford comma or "and" for two items.
 */
function sanitizeSplicedPhrase(text: string, subj: string, obj: string, poss: string): string {
  if (!text) return "";
  let cleanInput = normalizePunctuationSpaces(convertToThirdPerson(text, subj, obj, poss));
  if (!cleanInput) return "";

  // Split into clauses on commas and "and" conjunctions
  const rawParts = cleanInput.split(/,\s*/);
  const clauses: string[] = [];

  for (const part of rawParts) {
    const subParts = part.split(/\s+and\s+/i);
    for (const sub of subParts) {
      const converted = sanitizeSingleClause(sub);
      if (converted) {
        clauses.push(converted);
      }
    }
  }

  if (clauses.length === 0) return "";
  if (clauses.length === 1) return clauses[0];
  if (clauses.length === 2) return `${clauses[0]} and ${clauses[1]}`;

  return `${clauses.slice(0, -1).join(", ")}, and ${clauses[clauses.length - 1]}`;
}

/**
 * Format strengths field cleanly into natural prose.
 */
function formatStrengthsPhrase(text: string, subj: string, obj: string, poss: string): string {
  if (!text) return "enthusiasm, creativity, and a willingness to learn";
  let clean = normalizePunctuationSpaces(cleanPunctuation(convertToThirdPerson(text, subj, obj, poss)));
  if (!clean || clean === "N/A") return "enthusiasm, creativity, and a willingness to learn";

  const words = clean.split(/\s+/);
  if (words.length <= 4) {
    const lower = clean.toLowerCase();
    if (!lower.includes("qualities") && !lower.includes("skills") && !lower.includes("ability") && !lower.includes("demonstrated")) {
      return `strong ${lower} qualities`;
    }
    return lowercaseFirstChar(clean);
  }
  return lowercaseFirstChar(clean);
}

export function generateFallbackLorDraft(payload: LorDraftPayload): string {
  const {
    fullName,
    designation,
    department,
    joiningDate,
    lastWorkingDate,
    employmentType,
    responsibilities,
    projects,
    strengths,
    additionalInfo,
    pronounPreference,
  } = payload;

  // Format dates strictly as "MMM, YYYY" (e.g. "Aug, 2025")
  const formatDateFmt = (iso: string) => {
    if (!iso) return '';
    const clean = iso.trim();
    const d = new Date(clean.includes('T') ? clean : clean + 'T00:00:00');
    if (isNaN(d.getTime())) return clean;
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `${month}, ${year}`;
  };

  const formattedJoining = formatDateFmt(joiningDate);
  const formattedLwd = formatDateFmt(lastWorkingDate);
  const firstName = fullName ? fullName.trim().split(/\s+/)[0] : 'The employee';

  // FIX 1: Pronoun resolution — default to gender-neutral "they/them/their" unless explicitly male or female
  const pref = (pronounPreference || '').toLowerCase().trim();
  let subj = 'they';
  let obj = 'them';
  let poss = 'their';

  if (pref === 'female' || pref.includes('female') || pref === 'she' || pref === 'her') {
    subj = 'she';
    obj = 'her';
    poss = 'her';
  } else if (pref === 'male' || pref.includes('male') || pref === 'he' || pref === 'him') {
    subj = 'he';
    obj = 'him';
    poss = 'his';
  }

  const periodWord = (employmentType || '').toLowerCase().includes('intern') ? 'internship' : 'tenure';
  const periodLabel = (employmentType || '').toLowerCase().includes('intern') ? 'internship period' : 'tenure';

  // Determine a rotation index deterministically based on the department and designation name
  const isIntern = (employmentType || '').toLowerCase().includes('intern');
  const combinedStr = ((department || '') + (designation || '')).toLowerCase().trim();
  
  let hash = 0;
  for (let i = 0; i < combinedStr.length; i++) {
    hash = (hash * 31 + combinedStr.charCodeAt(i)) | 0;
  }
  const rotationIndex = Math.abs(hash) % 3;

  // Rotate Connector 1 (Paragraph 2 opening phrase)
  let p2Connector = `During the tenure, ${firstName} was involved in supporting the company's activities.`;
  if (isIntern) {
    if (rotationIndex === 0) {
      p2Connector = `Throughout the internship, ${firstName} was actively engaged in supporting our team's daily operations.`;
    } else if (rotationIndex === 1) {
      p2Connector = `During the internship period, ${firstName} assisted with a variety of company initiatives.`;
    } else {
      p2Connector = `Throughout the internship, ${firstName} worked closely with the team to support our operational needs.`;
    }
  } else {
    if (rotationIndex === 0) {
      p2Connector = `During the tenure, ${firstName} was involved in supporting the company's activities.`;
    } else if (rotationIndex === 1) {
      p2Connector = `Throughout this period, ${firstName} played a key role in supporting the department's core functions.`;
    } else {
      p2Connector = `During this tenure, ${firstName} contributed consistently to our team's ongoing objectives.`;
    }
  }

  // Rotate Connector 2 (Paragraph 3 second sentence)
  let p3Connector = `The individual carried out assigned responsibilities diligently and contributed positively to the team.`;
  if (isIntern) {
    if (rotationIndex === 0) {
      p3Connector = `The individual carried out assigned tasks diligently and contributed positively to the team.`;
    } else if (rotationIndex === 1) {
      p3Connector = `${firstName} approached all responsibilities with a strong work ethic and integrated well into the team.`;
    } else {
      p3Connector = `${subj.charAt(0).toUpperCase() + subj.slice(1)} handled each task with care and proved to be a collaborative team player.`;
    }
  } else {
    if (rotationIndex === 0) {
      p3Connector = `The individual carried out assigned responsibilities diligently and contributed positively to the team.`;
    } else if (rotationIndex === 1) {
      p3Connector = `${firstName} consistently delivered on all responsibilities and was a valued member of the department.`;
    } else {
      p3Connector = `${subj.charAt(0).toUpperCase() + subj.slice(1)} managed their tasks with great diligence and fostered strong working relationships.`;
    }
  }

  // Paragraph 1: Reference opening
  const intro = `This is to certify that ${fullName} was associated with Bohemian Curations Private Limited (ZenZebra) as a ${designation} from ${formattedJoining} to ${formattedLwd}.`;

  // Paragraph 2: Responsibilities & projects (3-4 sentences max)
  const cleanResp = cleanPunctuation(convertToThirdPerson(responsibilities || '', subj, obj, poss));
  const cleanProj = cleanPunctuation(convertToThirdPerson(projects || '', subj, obj, poss));

  let respText = p2Connector;
  if (cleanResp && cleanResp !== 'N/A') {
    respText += ` Key responsibilities included ${sanitizeSplicedPhrase(cleanResp, subj, obj, poss)}.`;
  } else {
    respText += ` Key responsibilities included executing core operational tasks and supporting team initiatives.`;
  }
  if (cleanProj && cleanProj !== 'N/A') {
    respText += ` Additionally, key tasks and projects handled included ${sanitizeSplicedPhrase(cleanProj, subj, obj, poss)}.`;
  }

  // Paragraph 3: Demonstrated qualities (2 sentences max) + FIX 2: restore additionalInfo keyword matching
  const formattedStrengths = formatStrengthsPhrase(strengths || '', subj, obj, poss);
  let qualitiesText = `Throughout the ${periodWord}, ${subj} demonstrated ${formattedStrengths}. ${p3Connector}`;

  if (additionalInfo && additionalInfo.trim() && additionalInfo.toLowerCase() !== 'n/a') {
    const lower = additionalInfo.toLowerCase();
    const capSubj = subj.charAt(0).toUpperCase() + subj.slice(1);
    const capPoss = poss.charAt(0).toUpperCase() + poss.slice(1);
    if (lower.includes("teamwork") || lower.includes("collaborat") || lower.includes("team")) {
      qualitiesText += ` ${capSubj} worked exceptionally well in team environments, fostering a collaborative spirit.`;
    } else if (lower.includes("punctual") || lower.includes("time") || lower.includes("schedule")) {
      qualitiesText += ` ${capPoss} punctuality and consistent time management were highly appreciated.`;
    } else if (lower.includes("learn") || lower.includes("curious") || lower.includes("adapt")) {
      qualitiesText += ` ${capSubj} also displayed a strong willingness to learn and adapt to new challenges.`;
    } else {
      const cleaned = normalizePunctuationSpaces(convertToThirdPerson(cleanPunctuation(additionalInfo), subj, obj, poss));
      const cleanedInfo = cleaned.replace(/^(please\s+)?(mention|highlight|write|note)(\s+that)?\s+/i, "");
      qualitiesText += ` It is also worth noting that ${lowercaseFirstChar(cleanedInfo)}.`;
    }
  }

  // Paragraph 4: Reference closing
  const conclusion = `We appreciate the efforts and contributions made during the ${periodLabel} and wish ${obj} success in all future academic and professional endeavors.`;

  return [intro, respText, qualitiesText, conclusion].join('\n\n');
}
