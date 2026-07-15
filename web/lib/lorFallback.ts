import { LorDraftPayload } from './ollama';

/**
 * Remove trailing periods and trim text to avoid double-punctuation
 */
function cleanPunctuation(text: string): string {
  if (!text) return "";
  return text.trim().replace(/\.+$/, "").trim();
}

/**
 * Perform a lightweight first-person -> third-person conversion step
 * on candidate inputs.
 */
function convertToThirdPerson(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();

  // Replace common first-person patterns
  cleaned = cleaned
    .replace(/\bI've\b/gi, "they have")
    .replace(/\bI'm\b/gi, "they are")
    .replace(/\bI am\b/gi, "they are")
    .replace(/\bI was\b/gi, "they were")
    .replace(/\bI have\b/gi, "they have")
    .replace(/\bI did\b/gi, "they did")
    .replace(/\bI worked\b/gi, "they worked")
    .replace(/\bI managed\b/gi, "they managed")
    .replace(/\bI handled\b/gi, "they handled")
    .replace(/\bI coordinated\b/gi, "they coordinated")
    .replace(/\bI learned\b/gi, "they learned")
    .replace(/\bI contributed\b/gi, "they contributed")
    .replace(/\bI assisted\b/gi, "they assisted")
    .replace(/\bmy\b/gi, "their")
    .replace(/\bme\b/gi, "them");

  // Capitalize sentence-starting "I"
  cleaned = cleaned.replace(/(?:^|[.!?]\s+)\bI\b/g, (match) => match.replace("I", "They"));
  cleaned = cleaned.replace(/\bI\b/g, "they");

  return cleaned;
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
  } = payload;

  const typeLabel = employmentType || 'Intern';
  const deptLabel = department ? `in the ${department} department` : '';

  // Helper to format dates to standard ordinals if possible
  const formatDateFmt = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    const day = d.getDate();
    const month = d.toLocaleString('en-GB', { month: 'long' });
    const year = d.getFullYear();
    const ordinal = (n: number) => {
      const s = ['th','st','nd','rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    return `${ordinal(day)} ${month}, ${year}`;
  };

  const formattedJoining = formatDateFmt(joiningDate);
  const formattedLwd = formatDateFmt(lastWorkingDate);

  // 1. Introduction Paragraph
  const intro = `This letter serves as a professional recommendation for ${fullName}, who was associated with Bohemian Curations Private Limited (ZenZebra) as a ${designation} ${deptLabel}. ${fullName} worked with the company under the employment type of ${typeLabel} from ${formattedJoining} to ${formattedLwd}. During this tenure, they demonstrated dedication and carried out all assigned tasks with a high degree of professionalism.`;

  // 2. Responsibilities Paragraph (pronoun "they" used to avoid name repetition, clean first person, clean double periods)
  const cleanResponsibilities = cleanPunctuation(convertToThirdPerson(responsibilities || ""));
  const responsibilitiesPara = cleanResponsibilities && cleanResponsibilities !== 'N/A'
    ? `In the role of ${designation}, they were responsible for key areas including: ${cleanResponsibilities}. These duties were executed with diligence and attention to detail, ensuring alignment with organizational requirements.`
    : `In the role of ${designation}, they handled the standard responsibilities aligned with the position's professional requirements. The core duties were performed consistently, demonstrating a steady focus and reliable output.`;

  // 3. Projects Paragraph (pronoun "they" used, clean first person, clean double periods)
  const cleanProjects = cleanPunctuation(convertToThirdPerson(projects || ""));
  const projectsPara = cleanProjects && cleanProjects !== 'N/A'
    ? `Additionally, they were actively involved in key projects and tasks, notably: ${cleanProjects}. The execution of these tasks contributed positively to the team's progress and project milestones.`
    : `Additionally, they contributed to various operational tasks and team initiatives. These efforts supported ongoing workflows and maintained the overall productivity of the department.`;

  // 4. Strengths Paragraph (pronoun "they" used, clean first person, clean double periods)
  const cleanStrengths = cleanPunctuation(convertToThirdPerson(strengths || ""));
  let strengthsText = cleanStrengths && cleanStrengths !== 'N/A'
    ? `Throughout their tenure, they demonstrated key professional strengths, specifically: ${cleanStrengths}.`
    : `Throughout their tenure, they demonstrated a positive attitude, adaptability, and a willingness to learn.`;

  // Conditionally include strengths sentences based on additionalInfo (avoid raw text leakage)
  if (additionalInfo) {
    const lower = additionalInfo.toLowerCase();
    if (lower.includes("teamwork") || lower.includes("collaborat")) {
      strengthsText += " They worked exceptionally well in team environments, fostering a collaborative spirit.";
    } else if (lower.includes("punctual") || lower.includes("time")) {
      strengthsText += " Their punctuality and consistent time management were highly appreciated.";
    } else if (lower.includes("learn") || lower.includes("curious")) {
      strengthsText += " They also displayed a strong willingness to learn and adapt to new challenges.";
    }
  }
  const strengthsPara = cleanPunctuation(strengthsText) + ".";

  // 5. Conclusion Paragraph (no name repetition, raw additionalInfo note removed completely)
  const conclusion = `We appreciate the efforts and contributions made by them during the employment period and wish them success in all future academic and professional endeavors.`;

  return [intro, responsibilitiesPara, projectsPara, strengthsPara, conclusion].join('\n\n');
}
