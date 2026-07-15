export interface PreprocessedLorData {
  fullName: string;
  firstName: string;
  pronoun: string;
  possessive: string;
  objective: string;
  verbWas: string;
  verbHas: string;
  responsibilities: string;
  projects: string;
  strengths: string;
  qualitiesToHighlight: string[];
  cleanAdditionalInfo: string;
}

export interface PronounSet {
  pronoun: string;
  possessive: string;
  objective: string;
  verbWas: string;
  verbHas: string;
}

/**
 * Resolves pronouns and verbs based on preference mode or auto-detection heuristics.
 */
export function getPronouns(fullName: string, mode?: string): PronounSet {
  const cleanMode = (mode || "neutral").trim().toLowerCase();

  switch (cleanMode) {
    case "male":
    case "he":
      return { pronoun: "he", possessive: "his", objective: "him", verbWas: "was", verbHas: "has" };
      
    case "female":
    case "she":
      return { pronoun: "she", possessive: "her", objective: "her", verbWas: "was", verbHas: "has" };
      
    case "they":
    case "them":
      return { pronoun: "they", possessive: "their", objective: "them", verbWas: "were", verbHas: "have" };
      
    case "neutral":
      return { pronoun: "the candidate", possessive: "the candidate's", objective: "the candidate", verbWas: "was", verbHas: "has" };

    case "auto":
    default: {
      const firstName = fullName.trim().split(/\s+/)[0].toLowerCase();
      // Common female endings and names in Indian/global contexts
      const femaleEndings = ["a", "i", "e", "aa", "shree", "ka", "ni", "ti", "ta"];
      const femaleList = [
        "kiran", "palak", "ananya", "aditi", "shruti", "riya", "simran", "sheetal", 
        "tanvi", "komal", "pooja", "priya", "neha", "divya", "jyoti", "megha", 
        "riddhi", "shrishti", "siddhi", "isha", "sakshi", "harpreet", "jaspreet",
        "palak", "aishwarya", "shreya", "anushka", "aditi", "prerna", "mansi"
      ];

      const isFemale = femaleList.includes(firstName) || 
        (femaleEndings.some(ending => firstName.endsWith(ending)) && 
         !firstName.endsWith("ra") && 
         !firstName.endsWith("endra") && 
         !firstName.endsWith("dev") &&
         !firstName.endsWith("singh"));

      if (isFemale) {
        return { pronoun: "she", possessive: "her", objective: "her", verbWas: "was", verbHas: "has" };
      }
      return { pronoun: "he", possessive: "his", objective: "him", verbWas: "was", verbHas: "has" };
    }
  }
}

/**
 * Remove double periods
 */
export function cleanPunctuation(text: string): string {
  if (!text) return "";
  return text.trim().replace(/\.+$/, "").trim();
}

/**
 * Map first-person employee details to professional third-person statements
 */
export function convertToThirdPerson(text: string, fullName: string, mode?: string): string {
  const cleaned = cleanPunctuation(text);
  if (!cleaned || cleaned.toLowerCase() === "n/a") return "";

  const firstName = fullName.trim().split(/\s+/)[0];
  const { pronoun, possessive, objective } = getPronouns(fullName, mode);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  let result = cleaned
    .replace(/\bI initially worked\b/gi, `${firstName} initially worked`)
    .replace(/\bDuring my internship, I\b/gi, `During the internship, ${pronoun}`)
    .replace(/\bDuring my tenure, I\b/gi, `During the tenure, ${pronoun}`)
    .replace(/\bInitially I worked\b/gi, `Initially, ${firstName} worked`)
    .replace(/\bI worked\b/gi, `${firstName} worked`)
    .replace(/\bI was\b/gi, `${firstName} was`)
    .replace(/\bI have\b/gi, `${firstName} has`)
    .replace(/\bI did\b/gi, `${firstName} did`)
    .replace(/\bI handled\b/gi, `${firstName} handled`)
    .replace(/\bI coordinated\b/gi, `${firstName} coordinated`)
    .replace(/\bI learned\b/gi, `${pronoun} learned`)
    .replace(/\bI managed\b/gi, `${firstName} managed`)
    .replace(/\bI contributed\b/gi, `${firstName} contributed`)
    .replace(/\bI assisted\b/gi, `${firstName} assisted`)
    .replace(/\bI am\b/gi, `${firstName} is`)
    .replace(/\bmy internship\b/gi, `${possessive} internship`)
    .replace(/\bmy role\b/gi, `${possessive} role`)
    .replace(/\bmy duties\b/gi, `${possessive} duties`)
    .replace(/\bmy responsibilities\b/gi, `${possessive} responsibilities`)
    .replace(/\bmy tasks\b/gi, `${possessive} tasks`)
    .replace(/\bmy contributions\b/gi, `${possessive} contributions`)
    .replace(/\bmy skills\b/gi, `${possessive} skills`)
    .replace(/\bmy strengths\b/gi, `${possessive} strengths`);

  // Replace sentence starting "I" with pronoun
  result = result.replace(/(?:^|[.!?]\s+)\bI\b/g, (match) => {
    return match.replace("I", cap(pronoun));
  });

  result = result.replace(/\bI\b/g, pronoun);
  result = result.replace(/\bmy\b/gi, possessive);
  result = result.replace(/\bme\b/gi, objective);

  return result;
}

/**
 * Extract instructions/qualities from additionalInfo without printing the instruction
 */
export function extractQualities(additionalInfo: string): string[] {
  if (!additionalInfo || additionalInfo.toLowerCase() === "n/a") return [];
  
  const text = additionalInfo.toLowerCase();
  const qualities = [
    { key: "teamwork", term: "teamwork" },
    { key: "punctuality", term: "punctuality" },
    { key: "learning attitude", term: "learn" },
    { key: "leadership", term: "leadership" },
    { key: "communication", term: "communication" },
    { key: "adaptability", term: "adapt" },
    { key: "problem solving", term: "problem" },
    { key: "creativity", term: "creat" },
    { key: "dedication", term: "dedicat" },
    { key: "professionalism", term: "professional" }
  ];

  return qualities
    .filter(q => text.includes(q.term))
    .map(q => q.key);
}

/**
 * Preprocess all LOR fields
 */
export function preprocessLorData(data: {
  fullName: string;
  responsibilities?: string;
  projects?: string;
  strengths?: string;
  additionalInfo?: string;
  pronounPreference?: string;
}): PreprocessedLorData {
  const { fullName, responsibilities, projects, strengths, additionalInfo, pronounPreference } = data;
  
  const pronouns = getPronouns(fullName, pronounPreference);
  const firstName = fullName.trim().split(/\s+/)[0];

  const cleanResp = convertToThirdPerson(responsibilities || "", fullName, pronounPreference);
  const cleanProj = convertToThirdPerson(projects || "", fullName, pronounPreference);
  const cleanStrengths = cleanPunctuation(strengths || "");
  const qualities = extractQualities(additionalInfo || "");

  return {
    fullName: fullName.trim(),
    firstName,
    ...pronouns,
    responsibilities: cleanResp,
    projects: cleanProj,
    strengths: cleanStrengths,
    qualitiesToHighlight: qualities,
    cleanAdditionalInfo: cleanPunctuation(additionalInfo || "")
  };
}
