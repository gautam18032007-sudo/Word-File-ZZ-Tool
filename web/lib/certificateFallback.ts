export interface CertificateDraftPayload {
  recipientName: string;
  designation: string;
  department: string;
  certificateType: string;
  issueDate: string;
}

export interface CertificateDraftResult {
  certificateCitation: string;
  achievementSummary: string;
  recognitionText: string;
}

export function generateFallbackCertificateDraft(payload: CertificateDraftPayload): CertificateDraftResult {
  const { recipientName, designation, department, certificateType, issueDate } = payload;
  const deptPart = department ? ` in the ${department} department` : '';

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

  const formattedDate = formatDateFmt(issueDate);

  return {
    certificateCitation: `This certificate is proudly presented to ${recipientName} for outstanding contributions as a ${designation}${deptPart}.`,
    achievementSummary: `Demonstrated professionalism, diligence, and commitment to project milestones during their engagement with the company.`,
    recognitionText: `In recognition of their valuable performance, dedication, and successful completion of assignments, Bohemian Curations Private Limited (ZenZebra) issues this certificate of ${certificateType} on ${formattedDate || issueDate}.`
  };
}
