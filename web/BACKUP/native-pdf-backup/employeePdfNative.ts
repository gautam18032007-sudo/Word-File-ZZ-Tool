import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PagedWriter } from './pdfTextLayout';

/**
 * Native pdf-lib fallback for the Employee Employment Agreement.
 * Renders the same clause text as templates/employee-contract-template.docx
 * so it works on Vercel with zero external dependencies (no LibreOffice,
 * no Gotenberg) when convertDocumentToPdf() comes back empty.
 */
export async function generateEmployeePdfNative(data: Record<string, string>): Promise<Buffer> {
  const empName = data.EMPLOYEE_NAME || '';
  const address = data.EMPLOYEE_ADDRESS || '';
  const designation = data.DESIGNATION || '';
  const joiningDate = data.JOINING_DATE || '';
  const monthlyCtc = data.MONTHLY_CTC || '';
  const monthlyCtcWords = data.MONTHLY_CTC_WORDS || '';
  const his = data.PRONOUN_POSSESSIVE || 'his';
  const him = data.PRONOUN_OBJECT || 'him';

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new PagedWriter(doc);

  const centerText = (text: string, size: number, useFont = bold) => {
    const textWidth = useFont.widthOfTextAtSize(text, size);
    w.ensureSpace(size * 1.4);
    w.page.drawText(text, { x: (w.width - textWidth) / 2, y: w.y, size, font: useFont, color: rgb(0.05, 0.05, 0.05) });
    w.y -= size * 1.4;
  };

  centerText('BOHEMIAN CURATIONS PRIVATE LIMITED', 11);
  centerText('CIN: U46411DL2023PTC424632', 9, font);
  centerText('A-11, A Block Rd, DDA Sheds, Pocket A, Okhla Phase I, Okhla Industrial Estate, New Delhi 110020', 9, font);
  centerText('Phone Nos.: 9910605187, 9958680856, Email ID: tanmay@zenzebra.in, gurpreet@zenzebra.in', 9, font);
  w.gap(14);
  centerText('EMPLOYMENT AGREEMENT', 14);
  w.gap(10);

  const clause = (text: string) => w.drawParagraph(text, { font, size: 10, gapAfter: 8 });

  clause(
    `THIS AGREEMENT ("Agreement") is executed on ${joiningDate}, by and between Bohemian Curations Private Limited, a company incorporated under the Companies Act, 2013, having its registered office at A-11, A Block Rd, DDA Sheds, Pocket A, Okhla Phase I, Okhla Industrial Estate, New Delhi, Delhi 110020, New Delhi (hereinafter referred to as the "Employer" or the "Company", which expression shall, unless repugnant to the context or meaning thereof, be deemed to include its successors, transferees, assigns, holding companies, subsidiaries, and affiliates), and ${empName}, residing at ${address} (hereinafter referred to as the "Employee", which expression shall, unless repugnant to the context or meaning thereof, include ${his} heirs, legal representatives, administrators, executors, and permitted assigns).`
  );

  clause(
    `1. For the purposes of this Agreement: (a) "Confidential Information" means all non-public, proprietary, or commercially valuable information, whether oral, written, electronic, or otherwise embodied, including but not limited to: (i) source code, object code, algorithms, and software; (ii) business plans, marketing strategies, pricing models, and client or vendor lists; (iii) trade secrets; (iv) contractual terms with third parties; and (v) any other information designated as confidential by the Company; (b) "Work Product" means all works, code, designs, inventions, trade secrets, algorithms, processes, writings, ideas, documentation, data, and materials, whether patentable or not, created, conceived, authored, developed, or contributed to by the Employee, alone or jointly, during the term of employment, that relate to the business of the Company or its anticipated business; (c) "Termination" means cessation of the employment relationship under any mode or circumstance, whether initiated by the Company or the Employee. Words importing the singular include the plural and vice versa; headings are for convenience only and shall not affect interpretation.`
  );

  clause(
    `2. The Employee is hereby appointed to the position of ${designation} reporting to such superior(s) as the Company may designate from time to time, with effect from ${joiningDate} ("Commencement Date"). The Employee acknowledges that ${his} appointment is conditional upon satisfactory completion of all pre-employment requirements, including verification of credentials.`
  );

  clause(
    `The Employee undertakes to furnish full, complete, and accurate information regarding ${his} personal details, qualifications, and previous employment, if any. If any declaration, statement, or information provided by the Employee is found to be false, misleading, incomplete, or if any material fact is willfully suppressed, the Company shall be entitled to terminate the Employee's services forthwith, without any notice or compensation, and without prejudice to any legal or equitable remedies available to the Company.`
  );

  clause(
    `3. The Employee shall be on probation for a period of three (3) months from the Commencement Date, which may be extended at the Company's sole discretion by up to an additional three (3) months. During the probation period (including any extension), the Employee's performance, conduct, and suitability for the role shall be under continuous review, and ${his} employment may be terminated by the Company at any time, without assigning any reason, by providing seven (7) days' prior written notice or salary in lieu thereof. The Employee may terminate ${his} employment during the probationary period only upon providing thirty (30) days' prior written notice to the Company, or, at the Company's discretion, by paying to the Company an amount equivalent to the gross salary for the unserved portion of such notice period.`
  );

  clause(
    `4. The Employee shall primarily work from the Company's ZenZebra HQ, New Delhi. Notwithstanding the foregoing, the Employee acknowledges and agrees that the Company may, at its sole discretion, require ${him} to work from any other location or remotely. Normal working days shall be Monday to Saturday; working hours shall be as prescribed by the Company and may be altered from time to time without additional compensation, subject to applicable law.`
  );

  clause(
    `5. The Employee shall receive a monthly CTC of ${monthlyCtc} (Indian Rupees ${monthlyCtcWords}), subject to applicable deductions. The Company may, at its sole and absolute discretion, grant a performance-based bonus, which shall be contingent upon the performance of the Company and the Employee. Any bonus paid shall be discretionary, shall not form part of the Employee's salary, and shall not constitute any precedent or create an entitlement in any subsequent year.`
  );

  clause(
    `6. The Employee shall be entitled to one (1) casual day leave per calendar month; unutilised leave shall not accrue, carry forward, or be encashed. Any absence without prior approval shall be deemed unauthorised and subject to disciplinary measures.`
  );

  clause(
    `7. The Employee shall devote ${his} full professional time and attention exclusively to the Company's business, faithfully discharge all duties assigned and comply with all instructions and policies, avoid any conduct prejudicial to the Company's reputation or interests. The Employee shall not, without the prior written consent of the Company: (a) directly or indirectly engage in any external business, employment, or professional activity, which is similar to, connected with, or competitive with the business of the Company, or which could reasonably be considered to impair ${his} ability to act at all times in the best interests of the Company, outside ${his} hours of work for the Company; (b) take up any other work for remuneration or otherwise (whether part-time or full-time), or work in any capacity, or be interested directly or indirectly in any other trade or business, without the prior written permission of the Company.`
  );

  clause(
    `8. All Work Product shall be deemed to have been created in the course of employment and shall vest absolutely in the Company from the moment of creation. The Employee hereby irrevocably assigns to the Company, without further consideration, all rights, title, and interest, present and future, in and to such Work Product, including all intellectual property rights therein, and waives all moral rights in such Work Product to the fullest extent permitted by law. This obligation shall survive Termination in perpetuity.`
  );

  clause(
    `9. The Employee shall not, during or after the Termination of the employment, use, disclose, or permit access to any Confidential Information except as required for the proper performance of duties. The Employee shall take all reasonable steps to protect such Confidential Information, and this obligation is perpetual and irrevocable, and any breach of this Clause shall entitle the Company to seek injunctive relief, damages, or any other remedies available under law.`
  );

  clause(
    `10. The Employee shall not, for a period of twenty-four (24) months following the Termination of the employment, directly or indirectly engage in any business, profession, or activity that competes with the business of the Company. The Employee shall not, during employment and for twelve (12) months thereafter, directly or indirectly solicit, induce, or attempt to induce any client, customer, supplier, contractor, or employee of the Company to cease or alter their relationship with the Company. Any breach of this Clause or Clause 9 shall entitle the Company to seek immediate injunctive relief without the necessity of proving irreparable harm, recovery of liquidated damages of INR 5,00,000 without prejudice to any greater claim for actual damages, and recovery of all legal costs incurred in enforcement.`
  );

  clause(
    `11. The Employee may terminate ${his} employment only upon giving the Company not less than three (3) calendar months' prior written notice; failure to serve the full notice shall render ${him} liable to pay to the Company an amount equivalent to the gross salary for the unserved portion, which the Company may recover by deduction from amounts payable to ${him}. The Company may terminate employment without cause upon giving one (1) calendar month's prior written notice or salary in lieu thereof. The Company may terminate the Employee immediately and without notice in cases of misconduct, gross negligence, breach of this Agreement, breach of confidentiality, or conduct prejudicial to the Company's interests. The Company may, during any notice period, at its sole discretion, direct the Employee not to attend the workplace, to work remotely, or to refrain from performing certain duties, while continuing to pay ${his} salary. All final payments, relieving letters, and experience certificates shall be conditional upon full compliance with handover obligations and settlement of all dues owed to the Company.`
  );

  clause(
    `12. Upon Termination of the employment, the Employee shall a) provide complete handover of all work, documents, and access credentials; b) return all Company property, including but not limited to hardware, software, data storage devices, records and any other materials belonging to the Company; and c) permanently delete any Company data from personal devices and certify such deletion in writing.`
  );

  clause(
    `13. The Employee shall fully indemnify and hold harmless the Company, its officers, and affiliates from and against any and all losses, liabilities, claims, damages, and expenses (including legal fees) arising directly or indirectly from a) any breach of this Agreement by the Employee; b) any act, omission or negligence of the Employee in the performance of ${his} duties; or c) any misrepresentation, fraud, or willful misconduct by the Employee.`
  );

  clause(
    `14. The Employee acknowledges that monetary damages may be inadequate for certain breaches, and that the Company shall be entitled to specific performance, interim relief, and permanent injunction without proof of special damage, in addition to any other remedies available at law or in equity.`
  );

  clause(
    `15. In the event of legal, arbitration or other proceedings to enforce this Agreement, the Employee shall bear all costs, fees, and expenses incurred by the Company, including attorney's fees, unless the adjudicating body rules entirely in ${his} favor.`
  );

  clause(
    `16. All disputes arising out of or relating to this Agreement shall be resolved exclusively by binding arbitration under the Arbitration and Conciliation Act, 1996. The arbitration shall be conducted by a sole arbitrator, with the seat and venue in New Delhi, and the language of proceedings being English. The arbitral award shall be final and binding, and enforceable in any competent court of law.`
  );

  clause(
    `17. All obligations under Clauses 8, 9, 10, 13, 14, 15, and 16 shall survive Termination indefinitely. The remedies provided herein are cumulative and may be exercised concurrently, and are in addition to any other remedies available at law or in equity.`
  );

  clause(
    `18. If any provision of this Agreement is held to be invalid, illegal, or unenforceable, the remainder of the Agreement shall remain enforceable. Failure to enforce any provision shall not operate as a waiver of the Company's rights.`
  );

  clause(
    `19. This Agreement constitutes the entire understanding between the Parties and supersedes all prior agreements, whether oral or written, relating to the subject matter herein.`
  );

  clause(`IN WITNESS WHEREOF, the Parties have executed this Agreement as of the date first written above.`);

  w.gap(30);
  w.ensureSpace(90);
  const sigY = w.y;
  w.page.drawText('For Bohemian Curations Private Limited', { x: w.marginX, y: sigY, size: 10, font: bold });
  w.page.drawText('Employee', { x: w.width / 2 + 20, y: sigY, size: 10, font: bold });
  w.page.drawText('Authorized Signatory: ____________________', { x: w.marginX, y: sigY - 30, size: 9, font });
  w.page.drawText('Signature: ____________________', { x: w.width / 2 + 20, y: sigY - 30, size: 9, font });
  w.page.drawText('Name: Tanmay Jain', { x: w.marginX, y: sigY - 46, size: 9, font });
  w.page.drawText(`Name: ${empName}`, { x: w.width / 2 + 20, y: sigY - 46, size: 9, font });
  w.page.drawText('Designation: CEO', { x: w.marginX, y: sigY - 62, size: 9, font });
  w.y = sigY - 80;

  // Annexure A on its own page
  w.newPage();
  centerText('Annexure A — Salary Breakup', 13);
  w.gap(14);

  const rows: [string, string, string][] = [
    ['Basic Salary', data.ANN_BASIC || '', data.ANN_BASIC_ANNUAL || ''],
    ['HRA', data.ANN_HRA || '', data.ANN_HRA_ANNUAL || ''],
    ['Conveyance Allowance', data.ANN_CONVEYANCE || '', data.ANN_CONVEYANCE_ANNUAL || ''],
    ['PF Employer Contribution', data.ANN_PF_EMPLOYER || '', data.ANN_PF_EMPLOYER_ANNUAL || ''],
    ['Special Allowance', data.ANN_SPECIAL_ALLOWANCE || '', data.ANN_SPECIAL_ALLOWANCE_ANNUAL || ''],
    ['Total CTC', data.ANN_TOTAL_CTC || '', data.ANN_TOTAL_CTC_ANNUAL || ''],
    ['PF Employee Contribution', data.ANN_PF_EMPLOYEE || '', data.ANN_PF_EMPLOYEE_ANNUAL || ''],
    ['Salary In Hand', data.ANN_SALARY_IN_HAND || '', data.ANN_SALARY_IN_HAND_ANNUAL || ''],
  ];

  const col1 = w.marginX;
  const col2 = w.marginX + 260;
  const col3 = w.marginX + 400;
  w.page.drawText('Salary Component', { x: col1, y: w.y, size: 10, font: bold });
  w.page.drawText('Monthly (INR)', { x: col2, y: w.y, size: 10, font: bold });
  w.page.drawText('Annual (INR)', { x: col3, y: w.y, size: 10, font: bold });
  w.y -= 18;
  for (const [label, monthly, annual] of rows) {
    w.ensureSpace(16);
    w.page.drawText(label, { x: col1, y: w.y, size: 9.5, font });
    w.page.drawText(monthly, { x: col2, y: w.y, size: 9.5, font });
    w.page.drawText(annual, { x: col3, y: w.y, size: 9.5, font });
    w.y -= 16;
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
