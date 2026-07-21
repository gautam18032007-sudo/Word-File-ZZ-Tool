import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { renderDocx } from '@/lib/template';
import { docxToPdf, PdfError } from '@/lib/pdf';
import { supportsLibreOffice, isVercel } from '@/lib/environment';
import { generatePdfFromHtml } from '@/lib/pdfRenderer';
import { renderEmployeeContractHtml } from '@/lib/documentHtmlRenderer';
import { nextContractNumber, buildFilename } from '@/lib/contractNumber';

import { appendContract } from '@/lib/store';
import { calcSalary } from '@/lib/salary';
import { formatINR, numberToWords, formatDate } from '@/lib/formatting';
import type { EmployeeRow } from '@/lib/types';
import { logger } from '@/lib/logger';
import { writableDir } from '@/lib/paths';

const OUTPUT_DIR = path.join(writableDir('output'), 'employees');

export const maxDuration = 60;

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
    logger.gen(`[API/generate/employee] Received generate request for employee: "${payload.employee?.name || 'Unknown'}"`);
  } catch (err) {
    logger.error(`[API/generate/employee] Invalid payload JSON: ${err}`);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { employee: e, annualCTC, joiningDate, gender } = payload;
  const pfEnabled = true; // Enforced company policy: PF is always YES

  if (!annualCTC || annualCTC <= 0) {
    logger.error(`[API/generate/employee] Invalid Annual CTC: ${annualCTC}`);
    return NextResponse.json({ error: 'Annual CTC must be greater than 0.' }, { status: 400 });
  }

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
      ANN_BASIC_ANNUAL: formatINR(s.basicAnnual),
      ANN_HRA_ANNUAL: formatINR(s.hraAnnual),
      ANN_CONVEYANCE_ANNUAL: formatINR(s.conveyanceAnnual),
      ANN_PF_EMPLOYER_ANNUAL: formatINR(s.pfEmployerAnnual),
      ANN_SPECIAL_ALLOWANCE_ANNUAL: formatINR(s.specialAllowanceAnnual),
      ANN_TOTAL_CTC_ANNUAL: formatINR(s.annualCTC),
      ANN_PF_EMPLOYEE_ANNUAL: formatINR(s.pfEmployeeAnnual),
      ANN_SALARY_IN_HAND_ANNUAL: formatINR(s.salaryInHandAnnual),
    };

    logger.gen(`[API/generate/employee] Generating template for contract #${contractNo}`);
    const docxBytes = renderDocx('employee-contract-template.docx', data);
    const docxName = buildFilename(contractNo, e.name, 'docx');
    fs.writeFileSync(path.join(OUTPUT_DIR, docxName), docxBytes);
    logger.gen(`[API/generate/employee] Saved DOCX: ${docxName}`);

    let pdfName: string | null = null;
    let message: string | undefined = undefined;

    if (supportsLibreOffice()) {
      try {
        logger.gen(`[API/generate/employee] Converting DOCX to PDF via LibreOffice...`);
        const pdfBytes = docxToPdf(docxBytes);
        pdfName = buildFilename(contractNo, e.name, 'pdf');
        fs.writeFileSync(path.join(OUTPUT_DIR, pdfName), pdfBytes);
        logger.gen(`[API/generate/employee] Saved PDF: ${pdfName}`);
      } catch (err) {
        if (!(err instanceof PdfError)) throw err;
        logger.error(`[API/generate/employee] PDF conversion failed (skipped): ${err.message}`);
        message = 'PDF generation unavailable.';
      }
    } else if (isVercel()) {
      try {
        logger.gen(`[API/generate/employee] Generating PDF via Puppeteer Chromium on Vercel...`);
        const html = renderEmployeeContractHtml(data);
        const pdfBytes = await generatePdfFromHtml(html);
        pdfName = buildFilename(contractNo, e.name, 'pdf');
        fs.writeFileSync(path.join(OUTPUT_DIR, pdfName), pdfBytes);
        logger.gen(`[API/generate/employee] Saved Puppeteer PDF: ${pdfName}`);
      } catch (err) {
        logger.error(`[API/generate/employee] Puppeteer PDF rendering failed: ${err}`);
        message = 'PDF generation unavailable.';
      }
    } else {
      message = 'PDF generation unavailable.';
      logger.gen(`[API/generate/employee] LibreOffice and Vercel unavailable. Skipping PDF conversion.`);
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
    logger.gen(`[API/generate/employee] Appended contract #${contractNo} to history.`);

    return NextResponse.json({
      success: true,
      contractNo,
      docxName,
      pdfName,
      message,
    });

  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`[API/generate/employee] Generation failed: ${errMsg}`);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
