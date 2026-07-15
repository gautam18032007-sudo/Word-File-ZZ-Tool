export interface EmployeeDraftPayload {
  name: string;
  fatherName: string;
  gender: string;
  address: string;
  phone: string;
  email: string;
  pan: string;
  aadhar: string;
  joiningDate: string;
  designation: string;
  department: string;
  annualCTC: number;
}

export interface EmployeeDraftResult {
  responsibilities: string;
  probationTerms: string;
  workDescription: string;
  professionalSummary: string;
}

export function generateFallbackEmployeeDraft(payload: EmployeeDraftPayload): EmployeeDraftResult {
  const { name, designation, department, annualCTC } = payload;
  const deptPart = department ? ` in the ${department} department` : '';

  return {
    responsibilities: `As a ${designation}${deptPart}, your primary responsibilities will include executing key operational tasks, participating in daily team standups, contributing to core technical deliverables, and ensuring quality standards are met across all assigned objectives.`,
    probationTerms: `You will be on a probation period of three (3) months from your date of joining. Upon successful completion of your probation, your employment status will be reviewed for official confirmation.`,
    workDescription: `This is a full-time professional position where you are expected to collaborate with cross-functional teams, support ongoing milestones, and represent the organization in a professional manner.`,
    professionalSummary: `${name} is appointed as a ${designation} at Bohemian Curations Private Limited (ZenZebra) with an Annual CTC of ₹${annualCTC.toLocaleString('en-IN')}. In this role, the employee will bring technical dedication to support the department's standard execution frameworks.`
  };
}
