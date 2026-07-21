// ─── Domain Types ────────────────────────────────────────────────────────────

export interface BrandRow {
  index: number;
  legalName: string;
  brandCategory: string;
  address: string;
  email: string;
  phone: string;
  contactPerson: string;
}

export interface EmployeeRow {
  index: number;
  name: string;
  fatherName: string;
  address: string;
  phone: string;
  email: string;
  pan: string;
  aadhar: string;
  designation: string;
  department: string;
  gender: string;
  joiningDate?: string;
}

export interface SalaryBreakup {
  monthlyCTC: number;
  annualCTC: number;
  basic: number;
  hra: number;
  conveyance: number;
  pfEmployer: number;
  pfEmployee: number;
  specialAllowance: number;
  salaryInHand: number;
  pfEnabled: boolean;
  basicAnnual: number;
  hraAnnual: number;
  conveyanceAnnual: number;
  pfEmployerAnnual: number;
  pfEmployeeAnnual: number;
  specialAllowanceAnnual: number;
  salaryInHandAnnual: number;
}

export interface ContractRecord {
  contract_no: string;
  type: 'brand' | 'employee' | 'certificate';
  party_name: string;
  generated_at: string;
  docx: string;
  pdf: string | null;
  folder: string;
  location?: string;
  total_amount?: number;
  annual_ctc?: number;
  designation?: string;
  // Certificate specific fields:
  certificateType?: string;
  template?: string;
}

// ─── Form Data ────────────────────────────────────────────────────────────────

export type Location = 'SWN' | 'KLJ' | 'BOTH';
export type ContractType = 'MONTH' | 'SKU';

export interface BrandFormData {
  sheetUrl: string;
  selectedBrand: BrandRow | null;
  location: Location;
  contractType: ContractType;
  amountPerMonth: string;
  amountPerSku: string;
  amountSwn: string;
  amountKlj: string;
  noOfMonths: string;
  noOfSku: string;
  commissionPct: string;       // used when location !== 'BOTH'
  commissionPctSwn: string;    // used when location === 'BOTH'
  commissionPctKlj: string;    // used when location === 'BOTH'
  effectiveDate: string;
  stampingDate: string;
}

export interface EmployeeFormData {
  sheetUrl: string;
  selectedEmployee: EmployeeRow | null;
  annualCTC: string;
  joiningDate: string;
  pfEnabled: boolean;
  gender: 'Male' | 'Female';
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiError {
  error: string;
}

export interface GenerateResult {
  contractNo: string;
  docxName: string;
  pdfName: string | null;
  docxBase64?: string;
  pdfBase64?: string | null;
}
