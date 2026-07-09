import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { renderDocx } from '@/lib/template';
import { docxToPdf, PdfError } from '@/lib/pdf';
import { nextContractNumber, buildFilename } from '@/lib/contractNumber';
import { appendContract } from '@/lib/store';
import { calcSalary } from '@/lib/salary';
import { formatINR, numberToWords, formatDate } from '@/lib/formatting';
import type { EmployeeRow } from '@/lib/types';

const OUTPUT_DIR = path.resolve(process.cwd(), '..', 'output', 'employees');

interface EmployeeGeneratePayload {
  employee: EmployeeRow;
  annualCTC: number;
  joiningDate: string;  // ISO date
  pfEnabled: boolean;
  gender: 'Male' | 'Female';
}

export async function POST(req: NextRequest) {
  let payload: EmployeeGeneratePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { employee: e, annualCTC, joiningDate, pfEnabled, gender } = payload;

  let joiningDateFmt: string;
  try {
    joiningDateFmt = formatDate(joiningDate);
  } catch {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
  }

  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const s = calcSalary(annualCTC, pfEnabled);
    const contractNo = nextContractNumber('EMP');

    const isFemale = gender.toLowerCase() === 'female';
    const pronouns = isFemale
      ? {
          PRONOUN_SUBJECT: 'she', PRONOUN_SUBJECT_CAP: 'She',
          PRONOUN_OBJECT: 'her', PRONOUN_OBJECT_CAP: 'Her',
          PRONOUN_POSSESSIVE: 'her', PRONOUN_POSSESSIVE_CAP: 'Her',
        }
      : {
          PRONOUN_SUBJECT: 'he', PRONOUN_SUBJECT_CAP: 'He',
          PRONOUN_OBJECT: 'him', PRONOUN_OBJECT_CAP: 'Him',
          PRONOUN_POSSESSIVE: 'his', PRONOUN_POSSESSIVE_CAP: 'His',
        };

    const data: Record<string, string> = {
      EMPLOYEE_NAME: e.name,
      FATHER_NAME: e.fatherName,
      EMPLOYEE_ADDRESS: e.address,
      PHONE: e.phone,
      EMAIL: e.email,
      PAN: e.pan,
      AADHAR: e.aadhar,
      DESIGNATION: e.designation,
      DEPARTMENT: e.department,
      JOINING_DATE: joiningDateFmt,
      MONTHLY_CTC: formatINR(s.monthlyCTC),
      MONTHLY_CTC_WORDS: numberToWords(s.monthlyCTC),
      ANNUAL_CTC: formatINR(s.annualCTC),
      ANNUAL_CTC_WORDS: numberToWords(s.annualCTC),
      ...pronouns,
      // Annexure-A monthly
      ANN_BASIC: formatINR(s.basic),
      ANN_HRA: formatINR(s.hra),
      ANN_CONVEYANCE: formatINR(s.conveyance),
      ANN_PF_EMPLOYER: formatINR(s.pfEmployer),
      ANN_SPECIAL_ALLOWANCE: formatINR(s.specialAllowance),
      ANN_TOTAL_CTC: formatINR(s.monthlyCTC),
      ANN_PF_EMPLOYEE: formatINR(s.pfEmployee),
      ANN_SALARY_IN_HAND: formatINR(s.salaryInHand),
      // Annexure-A annual
      ANN_BASIC_ANNUAL: formatINR(s.basic * 12),
      ANN_HRA_ANNUAL: formatINR(s.hra * 12),
      ANN_CONVEYANCE_ANNUAL: formatINR(s.conveyance * 12),
      ANN_PF_EMPLOYER_ANNUAL: formatINR(s.pfEmployer * 12),
      ANN_SPECIAL_ALLOWANCE_ANNUAL: formatINR(s.specialAllowance * 12),
      ANN_TOTAL_CTC_ANNUAL: formatINR(s.annualCTC),
      ANN_PF_EMPLOYEE_ANNUAL: formatINR(s.pfEmployee * 12),
      ANN_SALARY_IN_HAND_ANNUAL: formatINR(s.salaryInHand * 12),
    };

    const docxBytes = renderDocx('employee-contract-template.docx', data);
    const docxName = buildFilename(contractNo, e.name, 'docx');
    fs.writeFileSync(path.join(OUTPUT_DIR, docxName), docxBytes);

    let pdfName: string | null = null;
    try {
      const pdfBytes = docxToPdf(docxBytes);
      pdfName = buildFilename(contractNo, e.name, 'pdf');
      fs.writeFileSync(path.join(OUTPUT_DIR, pdfName), pdfBytes);
    } catch (err) {
      if (!(err instanceof PdfError)) throw err;
    }

    appendContract({
      contract_no: contractNo,
      type: 'employee',
      party_name: e.name,
      generated_at: new Date().toISOString(),
      docx: docxName,
      pdf: pdfName,
      folder: 'employees',
      annual_ctc: s.annualCTC,
      designation: e.designation,
    });

    return NextResponse.json({ contractNo, docxName, pdfName });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
