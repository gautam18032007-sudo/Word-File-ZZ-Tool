import { LorDraftPayload } from './ollama';

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
  const intro = `This letter serves as a professional recommendation for ${fullName}, who was associated with Bohemian Curations Private Limited (ZenZebra) as a ${designation} ${deptLabel}. ${fullName} worked with the company under the employment type of ${typeLabel} from ${formattedJoining} to ${formattedLwd}. During this tenure, ${fullName} demonstrated dedication and carried out all assigned tasks with a high degree of professionalism.`;

  // 2. Responsibilities Paragraph
  const responsibilitiesPara = responsibilities && responsibilities.trim() && responsibilities !== 'N/A'
    ? `In the role of ${designation}, ${fullName} was responsible for key areas including: ${responsibilities.trim()}. These duties were executed with diligence and attention to detail, ensuring alignment with organizational requirements.`
    : `In the role of ${designation}, ${fullName} handled the standard responsibilities aligned with the position's professional requirements. The core duties were performed consistently, demonstrating a steady focus and reliable output.`;

  // 3. Projects Paragraph
  const projectsPara = projects && projects.trim() && projects !== 'N/A'
    ? `Additionally, ${fullName} was actively involved in key projects and tasks, notably: ${projects.trim()}. The execution of these tasks contributed positively to the team's progress and project milestones.`
    : `Additionally, ${fullName} contributed to various operational tasks and team initiatives. These efforts supported ongoing workflows and maintained the overall productivity of the department.`;

  // 4. Strengths Paragraph
  const strengthsPara = strengths && strengths.trim() && strengths !== 'N/A'
    ? `Throughout the tenure, ${fullName} demonstrated key professional strengths, specifically: ${strengths.trim()}. These qualities were visible in daily interactions and collaborative efforts within the team.`
    : `Throughout the tenure, ${fullName} demonstrated a positive attitude, adaptability, and a willingness to learn. These attributes supported overall performance and integration into the company's culture.`;

  // 5. Conclusion Paragraph
  const extraInfo = additionalInfo && additionalInfo.trim() && additionalInfo !== 'N/A' ? ` Note: ${additionalInfo.trim()}` : '';
  const conclusion = `We appreciate the efforts and contributions made by ${fullName} during the employment period and wish them success in all future academic and professional endeavors.${extraInfo}`;

  return [intro, responsibilitiesPara, projectsPara, strengthsPara, conclusion].join('\n\n');
}
