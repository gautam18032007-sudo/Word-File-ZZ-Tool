import type { PiGeneratorInput } from './piGenerator';
import { LOR_CORNER_IMG, LOR_LOGO_IMG } from './lorAssets';
import { PI_SIGNATURE_IMG } from './piAssets';

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const COMMON_CSS = `
  body {
    font-family: Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.5;
    margin: 0;
    padding: 20mm;
    font-size: 13px;
    box-sizing: border-box;
  }
  h1, h2, h3 {
    margin-top: 0;
    color: #111827;
  }
  .header-table, .content-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  .content-table th, .content-table td {
    border: 1px solid #d1d5db;
    padding: 8px 12px;
    text-align: left;
  }
  .content-table th {
    background-color: #f3f4f6;
    font-weight: bold;
  }
  .section-title {
    font-weight: bold;
    font-size: 15px;
    border-bottom: 2px solid #374151;
    padding-bottom: 4px;
    margin-top: 24px;
    margin-bottom: 12px;
  }
  .paragraph {
    margin-bottom: 14px;
    text-align: justify;
  }
  .signature-block {
    margin-top: 40px;
    page-break-inside: avoid;
  }
`;

export function renderEmployeeContractHtml(data: Record<string, string>): string {
  const empName = escapeHtml(data.EMPLOYEE_NAME || '');
  const address = escapeHtml(data.EMPLOYEE_ADDRESS || '');
  const designation = escapeHtml(data.DESIGNATION || '');
  const joiningDate = escapeHtml(data.JOINING_DATE || '');
  const monthlyCtc = escapeHtml(data.MONTHLY_CTC || '');
  const monthlyCtcWords = escapeHtml(data.MONTHLY_CTC_WORDS || '');

  const his = escapeHtml(data.PRONOUN_POSSESSIVE || 'his');
  const him = escapeHtml(data.PRONOUN_OBJECT || 'him');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Employment Agreement — ${empName}</title>
  <style>
    ${COMMON_CSS}
    .clause { margin-bottom: 12px; text-align: justify; }
    .clause-list { margin: 4px 0 12px 24px; padding: 0; }
    .clause-list li { margin-bottom: 6px; text-align: justify; }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 8px;">
    <p style="margin: 0; font-weight: bold; font-size: 14px;">BOHEMIAN CURATIONS PRIVATE LIMITED</p>
    <p style="margin: 2px 0 0 0;">CIN: U46411DL2023PTC424632</p>
    <p style="margin: 2px 0 0 0;">A-11, A Block Rd, DDA Sheds, Pocket A, Okhla Phase I, Okhla Industrial Estate, New Delhi 110020</p>
    <p style="margin: 2px 0 0 0;">Phone Nos.: 9910605187, 9958680856, Email ID: tanmay@zenzebra.in, gurpreet@zenzebra.in</p>
  </div>

  <h1 style="text-align: center; font-size: 18px; text-transform: uppercase; margin: 20px 0 16px 0;">Employment Agreement</h1>

  <p class="clause">
    THIS AGREEMENT (&ldquo;Agreement&rdquo;) is executed on <strong>${joiningDate}</strong>, by and between Bohemian Curations Private Limited, a company incorporated under the Companies Act, 2013, having its registered office at A-11, A Block Rd, DDA Sheds, Pocket A, Okhla Phase I, Okhla Industrial Estate, New Delhi, Delhi 110020, New Delhi (hereinafter referred to as the &ldquo;Employer&rdquo; or the &ldquo;Company&rdquo;, which expression shall, unless repugnant to the context or meaning thereof, be deemed to include its successors, transferees, assigns, holding companies, subsidiaries, and affiliates), and <strong>${empName}</strong>, residing at <strong>${address}</strong> (hereinafter referred to as the &ldquo;Employee&rdquo;, which expression shall, unless repugnant to the context or meaning thereof, include ${his} heirs, legal representatives, administrators, executors, and permitted assigns).
  </p>

  <p class="clause"><strong>1.</strong> For the purposes of this Agreement: (a) &ldquo;Confidential Information&rdquo; means all non-public, proprietary, or commercially valuable information, whether oral, written, electronic, or otherwise embodied, including but not limited to: (i) source code, object code, algorithms, and software; (ii) business plans, marketing strategies, pricing models, and client or vendor lists; (iii) trade secrets; (iv) contractual terms with third parties; and (v) any other information designated as confidential by the Company; (b) &ldquo;Work Product&rdquo; means all works, code, designs, inventions, trade secrets, algorithms, processes, writings, ideas, documentation, data, and materials, whether patentable or not, created, conceived, authored, developed, or contributed to by the Employee, alone or jointly, during the term of employment, that relate to the business of the Company or its anticipated business; (c) &ldquo;Termination&rdquo; means cessation of the employment relationship under any mode or circumstance, whether initiated by the Company or the Employee. Words importing the singular include the plural and vice versa; headings are for convenience only and shall not affect interpretation.</p>

  <p class="clause"><strong>2.</strong> The Employee is hereby appointed to the position of <strong>${designation}</strong> reporting to such superior(s) as the Company may designate from time to time, with effect from <strong>${joiningDate}</strong> (&ldquo;Commencement Date&rdquo;). The Employee acknowledges that ${his} appointment is conditional upon satisfactory completion of all pre-employment requirements, including verification of credentials.</p>

  <p class="clause">The Employee undertakes to furnish full, complete, and accurate information regarding ${his} personal details, qualifications, and previous employment, if any. If any declaration, statement, or information provided by the Employee is found to be false, misleading, incomplete, or if any material fact is willfully suppressed, the Company shall be entitled to terminate the Employee&rsquo;s services forthwith, without any notice or compensation, and without prejudice to any legal or equitable remedies available to the Company.</p>

  <p class="clause"><strong>3.</strong> The Employee shall be on probation for a period of three (3) months from the Commencement Date, which may be extended at the Company&rsquo;s sole discretion by up to an additional three (3) months. During the probation period (including any extension), the Employee&rsquo;s performance, conduct, and suitability for the role shall be under continuous review, and ${his} employment may be terminated by the Company at any time, without assigning any reason, by providing seven (7) days&rsquo; prior written notice or salary in lieu thereof. The Employee may terminate ${his} employment during the probationary period only upon providing thirty (30) days&rsquo; prior written notice to the Company, or, at the Company&rsquo;s discretion, by paying to the Company an amount equivalent to the gross salary for the unserved portion of such notice period.</p>

  <p class="clause"><strong>4.</strong> The Employee shall primarily work from the Company&rsquo;s ZenZebra HQ, New Delhi. Notwithstanding the foregoing, the Employee acknowledges and agrees that the Company may, at its sole discretion, require ${him} to work from any other location or remotely. Normal working days shall be Monday to Saturday; working hours shall be as prescribed by the Company and may be altered from time to time without additional compensation, subject to applicable law.</p>

  <p class="clause"><strong>5.</strong> The Employee shall receive a monthly CTC of <strong>${monthlyCtc}</strong> (Indian Rupees <strong>${monthlyCtcWords}</strong>), subject to applicable deductions. The Company may, at its sole and absolute discretion, grant a performance-based bonus, which shall be contingent upon the performance of the Company and the Employee. Any bonus paid shall be discretionary, shall not form part of the Employee&rsquo;s salary, and shall not constitute any precedent or create an entitlement in any subsequent year.</p>

  <p class="clause"><strong>6.</strong> The Employee shall be entitled to one (1) casual day leave per calendar month; unutilised leave shall not accrue, carry forward, or be encashed. Any absence without prior approval shall be deemed unauthorised and subject to disciplinary measures.</p>

  <p class="clause"><strong>7.</strong> The Employee shall devote ${his} full professional time and attention exclusively to the Company&rsquo;s business, faithfully discharge all duties assigned and comply with all instructions and policies, avoid any conduct prejudicial to the Company&rsquo;s reputation or interests. The Employee shall not, without the prior written consent of the Company:</p>
  <ul class="clause-list">
    <li>directly or indirectly engage in any external business, employment, or professional activity, which is similar to, connected with, or competitive with the business of the Company, or which could reasonably be considered to impair ${his} ability to act at all times in the best interests of the Company, outside ${his} hours of work for the Company;</li>
    <li>take up any other work for remuneration or otherwise (whether part-time or full-time), or work in any capacity, or be interested directly or indirectly in any other trade or business, without the prior written permission of the Company.</li>
  </ul>

  <p class="clause"><strong>8.</strong> All Work Product shall be deemed to have been created in the course of employment and shall vest absolutely in the Company from the moment of creation. The Employee hereby irrevocably assigns to the Company, without further consideration, all rights, title, and interest, present and future, in and to such Work Product, including all intellectual property rights therein, and waives all moral rights in such Work Product to the fullest extent permitted by law. This obligation shall survive Termination in perpetuity.</p>

  <p class="clause"><strong>9.</strong> The Employee shall not, during or after the Termination of the employment, use, disclose, or permit access to any Confidential Information except as required for the proper performance of duties. The Employee shall take all reasonable steps to protect such Confidential Information, and this obligation is perpetual and irrevocable, and any breach of this Clause shall entitle the Company to seek injunctive relief, damages, or any other remedies available under law.</p>

  <p class="clause"><strong>10.</strong> The Employee shall not, for a period of twenty-four (24) months following the Termination of the employment, directly or indirectly engage in any business, profession, or activity that competes with the business of the Company. The Employee shall not, during employment and for twelve (12) months thereafter, directly or indirectly solicit, induce, or attempt to induce any client, customer, supplier, contractor, or employee of the Company to cease or alter their relationship with the Company. Any breach of this Clause or Clause 9 shall entitle the Company to seek immediate injunctive relief without the necessity of proving irreparable harm, recovery of liquidated damages of INR 5,00,000 without prejudice to any greater claim for actual damages, and recovery of all legal costs incurred in enforcement.</p>

  <p class="clause"><strong>11.</strong> The Employee may terminate ${his} employment only upon giving the Company not less than three (3) calendar months&rsquo; prior written notice; failure to serve the full notice shall render ${him} liable to pay to the Company an amount equivalent to the gross salary for the unserved portion, which the Company may recover by deduction from amounts payable to ${him}. The Company may terminate employment without cause upon giving one (1) calendar month&rsquo;s prior written notice or salary in lieu thereof. The Company may terminate the Employee immediately and without notice in cases of misconduct, gross negligence, breach of this Agreement, breach of confidentiality, or conduct prejudicial to the Company&rsquo;s interests. The Company may, during any notice period, at its sole discretion, direct the Employee not to attend the workplace, to work remotely, or to refrain from performing certain duties, while continuing to pay ${his} salary. All final payments, relieving letters, and experience certificates shall be conditional upon full compliance with handover obligations and settlement of all dues owed to the Company.</p>

  <p class="clause"><strong>12.</strong> Upon Termination of the employment, the Employee shall a) provide complete handover of all work, documents, and access credentials; b) return all Company property, including but not limited to hardware, software, data storage devices, records and any other materials belonging to the Company; and c) permanently delete any Company data from personal devices and certify such deletion in writing.</p>

  <p class="clause"><strong>13.</strong> The Employee shall fully indemnify and hold harmless the Company, its officers, and affiliates from and against any and all losses, liabilities, claims, damages, and expenses (including legal fees) arising directly or indirectly from a) any breach of this Agreement by the Employee; b) any act, omission or negligence of the Employee in the performance of ${his} duties; or c) any misrepresentation, fraud, or willful misconduct by the Employee.</p>

  <p class="clause"><strong>14.</strong> The Employee acknowledges that monetary damages may be inadequate for certain breaches, and that the Company shall be entitled to specific performance, interim relief, and permanent injunction without proof of special damage, in addition to any other remedies available at law or in equity.</p>

  <p class="clause"><strong>15.</strong> In the event of legal, arbitration or other proceedings to enforce this Agreement, the Employee shall bear all costs, fees, and expenses incurred by the Company, including attorney&rsquo;s fees, unless the adjudicating body rules entirely in ${his} favor.</p>

  <p class="clause"><strong>16.</strong> All disputes arising out of or relating to this Agreement shall be resolved exclusively by binding arbitration under the Arbitration and Conciliation Act, 1996. The arbitration shall be conducted by a sole arbitrator, with the seat and venue in New Delhi, and the language of proceedings being English. The arbitral award shall be final and binding, and enforceable in any competent court of law.</p>

  <p class="clause"><strong>17.</strong> All obligations under Clauses 8, 9, 10, 13, 14, 15, and 16 shall survive Termination indefinitely. The remedies provided herein are cumulative and may be exercised concurrently, and are in addition to any other remedies available at law or in equity.</p>

  <p class="clause"><strong>18.</strong> If any provision of this Agreement is held to be invalid, illegal, or unenforceable, the remainder of the Agreement shall remain enforceable. Failure to enforce any provision shall not operate as a waiver of the Company&rsquo;s rights.</p>

  <p class="clause"><strong>19.</strong> This Agreement constitutes the entire understanding between the Parties and supersedes all prior agreements, whether oral or written, relating to the subject matter herein.</p>

  <p class="clause">IN WITNESS WHEREOF, the Parties have executed this Agreement as of the date first written above.</p>

  <div class="signature-block">
    <div style="float: left; width: 45%;">
      <p>For Bohemian Curations Private Limited</p>
      <br><br>
      <p>Authorized Signatory: ____________________</p>
      <p>Name: Tanmay Jain</p>
      <p>Designation: CEO</p>
    </div>
    <div style="float: right; width: 45%;">
      <p>Employee</p>
      <br><br>
      <p>Signature: ____________________</p>
      <p>Name: <strong>${empName}</strong></p>
    </div>
    <div style="clear: both;"></div>
  </div>

  <div style="page-break-before: always;"></div>
  <div class="section-title">Annexure A — Salary Breakup</div>
  <table class="content-table">
    <thead>
      <tr>
        <th>Salary Component</th>
        <th>Monthly (INR)</th>
        <th>Annual (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Basic Salary</td><td>${escapeHtml(data.ANN_BASIC || '')}</td><td>${escapeHtml(data.ANN_BASIC_ANNUAL || '')}</td></tr>
      <tr><td>HRA</td><td>${escapeHtml(data.ANN_HRA || '')}</td><td>${escapeHtml(data.ANN_HRA_ANNUAL || '')}</td></tr>
      <tr><td>Conveyance Allowance</td><td>${escapeHtml(data.ANN_CONVEYANCE || '')}</td><td>${escapeHtml(data.ANN_CONVEYANCE_ANNUAL || '')}</td></tr>
      <tr><td>PF Employer Contribution</td><td>${escapeHtml(data.ANN_PF_EMPLOYER || '')}</td><td>${escapeHtml(data.ANN_PF_EMPLOYER_ANNUAL || '')}</td></tr>
      <tr><td>Special Allowance</td><td>${escapeHtml(data.ANN_SPECIAL_ALLOWANCE || '')}</td><td>${escapeHtml(data.ANN_SPECIAL_ALLOWANCE_ANNUAL || '')}</td></tr>
      <tr style="font-weight: bold; background-color: #f9fafb;"><td>Total CTC</td><td>${escapeHtml(data.ANN_TOTAL_CTC || '')}</td><td>${escapeHtml(data.ANN_TOTAL_CTC_ANNUAL || '')}</td></tr>
      <tr><td>PF Employee Contribution</td><td>${escapeHtml(data.ANN_PF_EMPLOYEE || '')}</td><td>${escapeHtml(data.ANN_PF_EMPLOYEE_ANNUAL || '')}</td></tr>
      <tr style="font-weight: bold; background-color: #f3f4f6;"><td>Salary In Hand</td><td>${escapeHtml(data.ANN_SALARY_IN_HAND || '')}</td><td>${escapeHtml(data.ANN_SALARY_IN_HAND_ANNUAL || '')}</td></tr>
    </tbody>
  </table>
</body>
</html>
  `;
}

export function renderBrandContractHtml(data: Record<string, string>): string {
  const legalName = escapeHtml(data.LEGAL_NAME || '');
  const brandCategory = escapeHtml(data.BRAND_CATEGORY || '');
  const address = escapeHtml(data.ADDRESS || '');
  const stampingDate = escapeHtml(data.STAMPING_DATE || '');
  const effectiveDate = escapeHtml(data.EFFECTIVE_DATE || '');
  const feeClause = escapeHtml(data.FEE_CLAUSE || '');
  const commissionClause = escapeHtml(data.COMMISSION_CLAUSE || '');
  const paymentMethod = escapeHtml(data.PAYMENT_METHOD || '');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Brand Services Agreement — ${legalName}</title>
  <style>
    ${COMMON_CSS}
    .clause { margin-bottom: 12px; text-align: justify; }
    .clause-list { margin: 4px 0 12px 24px; padding: 0; }
    .clause-list li { margin-bottom: 6px; text-align: justify; }
  </style>
</head>
<body>
  <h1 style="text-align: center; font-size: 18px; text-transform: uppercase; margin: 0 0 16px 0;">Brand Services Agreement</h1>

  <p class="clause">This Brand Services Agreement (&ldquo;Agreement&rdquo;) is reduced to writing on <strong>${stampingDate}</strong>, and shall be effective from <strong>${effectiveDate}</strong> (&ldquo;Effective Date&rdquo;), by and between:</p>

  <p class="clause">ZenZebra, also known as Bohemian Curations Private Limited, a company incorporated under the laws of India, having its registered office at A-11, A Block Rd, DDA Sheds, Pocket A, Okhla Phase I, Okhla Industrial Estate, New Delhi, Delhi 110020 (hereinafter referred to as the &ldquo;Company&rdquo;), and</p>

  <p class="clause"><strong>${legalName}</strong>, a company/individual engaged in the business of <strong>${brandCategory}</strong>, having its principal place of business at <strong>${address}</strong> (hereinafter referred to as the &ldquo;Brand Partner&rdquo;).</p>

  <p class="clause"><strong>Whereas:</strong></p>
  <ul class="clause-list">
    <li>The Company is engaged in the business of setting up PermaPop Setups in various locations and promoting and distributing lifestyle products;</li>
    <li>The Brand Partner is engaged in the business of ${brandCategory};</li>
    <li>Relying on the representations made by the Brand Partner, the Company is desirous of displaying, promoting and distributing the products of the Brand Partner, subject to the terms and conditions set forth in this Agreement.</li>
  </ul>
  <p class="clause">Collectively referred to as the &ldquo;Parties&rdquo; and individually as a &ldquo;Party.&rdquo;</p>

  <div class="section-title">1. Scope of Services</div>
  <p class="clause">The Company shall onboard the Brand Partner&rsquo;s products at its stores for promotion and sale thereof. The services provided by the Company shall include but not be limited to marketing, product display, payment collection, and customer engagement. The onboarding of the Brand Partner&rsquo;s products shall be valid during the Term (as defined hereinafter) on a non-exclusive basis.</p>

  <div class="section-title">2. Delivery</div>
  <p class="clause">During the Term, the Company shall place written orders with the Brand Partner for the products (&ldquo;Order&rdquo;), where each such order shall contain the following information:</p>
  <ul class="clause-list">
    <li>The name and quantity of the products;</li>
    <li>The delivery address to which such products should be delivered;</li>
    <li>The delivery date and time at which such products shall be delivered.</li>
  </ul>
  <p class="clause">The Brand Partner shall use commercially reasonable efforts to accept each Order and supply to the Company with all of its requirements of the products ordered under this Agreement.</p>
  <p class="clause">The Brand Partner shall deliver the products to the delivery address as provided in the Order. All the costs associated with shipment and delivery of the products shall be borne by the Brand Partner.</p>
  <p class="clause">The Company shall verify and inspect the products delivered at the delivery address and communicate the acceptance of the products to the Brand Partner within 72 hours from the date of delivery.</p>
  <p class="clause">The Company shall within a period of 72 hours from the date of delivery of the products, be entitled to notify the Brand Partner for the return of such products which fulfil the following criteria (&ldquo;Clause 2.5&rdquo;):</p>
  <ul class="clause-list">
    <li>Visibly damaged and/or defective; or</li>
    <li>Not in conformity with the Order requirements.</li>
  </ul>
  <p class="clause">On the occurrence of the events as set out in Clause 2.5 above, the Company shall be entitled to return the relevant products to the Brand Partner. The Brand Partner shall schedule the pick-up of such products from the delivery address. The Brand Partner shall confirm the pick-up schedule and accordingly arrange for the pick-up of the products.</p>
  <p class="clause">The Brand Partner hereby agrees and undertakes that any and all costs and expenses including delivery expenses for delivering the products to the delivery address, and/or for the collection of products from the delivery address shall be borne by the Brand Partner.</p>

  <div class="section-title">3. Duration</div>
  <p class="clause">This Agreement shall commence on ${effectiveDate} and shall remain in effect until terminated in accordance with Clause 13 of this Agreement (&ldquo;Term&rdquo;).</p>

  <div class="section-title">4. Rental and Commission Structure</div>
  <p class="clause">The Brand Partner agrees to pay the Company:</p>
  <ul class="clause-list">
    <li>${feeClause}</li>
    <li>${commissionClause}</li>
  </ul>

  <div class="section-title">5. Reverse Logistics Costs</div>
  <p class="clause">The responsibility for the costs associated with reverse logistics (returns from end customers) shall be borne by the Brand Partner.</p>
  <p class="clause">The Company shall facilitate the return process but shall not be liable for associated costs unless otherwise agreed.</p>

  <div class="section-title">6. Insurance Coverage</div>
  <p class="clause">The Company shall be responsible for maintaining adequate insurance coverage for their products displayed at the PermaPop Setup, covering potential risks such as loss, damage, or theft, and any third party claims in respect of the products.</p>
  <p class="clause">The Company shall not be held liable for any loss or damage unless it results from gross negligence or willful misconduct.</p>

  <div class="section-title">7. Payment to Brand Partner</div>
  <p class="clause">Payments for products sold shall be made by the Company to the Brand Partner on the 10th, 20th, and 30th day of each calendar month, based on sales completed within the corresponding period.</p>
  <p class="clause">Payments shall be processed through ${paymentMethod || '[Payment Method]'} (e.g., bank transfer, digital wallet, etc.).</p>

  <div class="section-title">8. Point of Sale (POS) System Integration</div>
  <p class="clause">All sales transactions shall be processed through a POS payment system incorporated by the Company.</p>
  <p class="clause">The Company shall collect payments from customers on behalf of the Brand Partner and disburse the due amount after deducting applicable commissions and fees.</p>

  <div class="section-title">9. Representations and Warranties</div>
  <p class="clause">Each Party hereby represents and warrants that:</p>
  <ul class="clause-list">
    <li>It has all requisite authority and rights to enter into and to perform its obligations under this Agreement;</li>
    <li>It has full and absolute power to execute and enter into this Agreement, and does not and will not violate any law, rule, regulation, order, or decree applicable to it;</li>
    <li>No proceedings are pending against it which shall have a material adverse impact on the implementation of this Agreement or the performance of the obligations hereunder;</li>
    <li>It has full legal capacity to enter into this Agreement and that there are no existing facts/circumstances/contractual obligations with third parties which prohibits or impairs its capacity to enter into this Agreement.</li>
  </ul>
  <p class="clause">The Brand Partner represents and warrants to the Company that:</p>
  <ul class="clause-list">
    <li>The products have been manufactured in compliance with applicable law;</li>
    <li>It has all necessary licenses and permits to manufacture the products;</li>
    <li>It has not directly or indirectly violated the intellectual property rights of any third party, and there are no pending or threatened claims against it regarding infringement of a third party&rsquo;s intellectual property rights.</li>
  </ul>
  <p class="clause">The Company represents and warrants to the Brand Partner that:</p>
  <ul class="clause-list">
    <li>It has the necessary skill and resources to carry out its obligations under this Agreement;</li>
    <li>It has obtained all licenses, approvals and consents necessary under the applicable laws to carry on its business operations and is in compliance with the licenses, approvals and consents under applicable laws.</li>
  </ul>

  <div class="section-title">10. Limitation of Liability</div>
  <p class="clause">In no event shall the Company be liable to the Brand Partner for any indirect, incidental, special, consequential, or punitive damages, including lost profits or loss of business opportunities.</p>
  <p class="clause">The Company&rsquo;s total liability under this Agreement shall be limited to the total amount paid by the Brand Partner to the Company in the preceding 1 month.</p>

  <div class="section-title">11. Indemnity</div>
  <p class="clause">The Brand Partner shall indemnify, defend, and hold harmless the Company, its affiliates, directors, employees, and agents from and against any claims, liabilities, damages, costs, and expenses arising out of any breach of this Agreement, negligence, willful misconduct, violation of applicable laws, or breach of any representations by the Brand Partner.</p>
  <p class="clause">The Brand Partner shall further indemnify, defend, and hold harmless the Company from any claims, disputes, legal actions, damages, or liabilities arising from complaints, defects, deficiencies, or quality issues related to the products sold through the PermaPop Setups, including but not limited to claims made by customers or third parties.</p>
  <p class="clause">In the event of any legal proceedings or disputes initiated by customers concerning the products, the Brand Partner shall assume full responsibility and shall bear all associated costs, including legal fees and settlement amounts, and shall indemnify the Company against any loss or damage suffered as a result.</p>

  <div class="section-title">12. Act of God (Force Majeure)</div>
  <p class="clause">Neither Party shall be liable for any failure or delay in the performance of its obligations under this Agreement due to any cause beyond its reasonable control, including but not limited to natural disasters, strikes, wars, pandemics, government restrictions, or disruptions in supply chains (&ldquo;Force Majeure Event&rdquo;).</p>
  <p class="clause">If a Force Majeure Event continues for more than 15 days, either Party may terminate this Agreement upon written notice to the other Party.</p>

  <div class="section-title">13. Termination</div>
  <p class="clause">Either Party may terminate this Agreement by providing 20 days written notice.</p>
  <p class="clause">The Company reserves the right to terminate the Agreement immediately in case of non-compliance, non-payment, or breach of terms by the Brand Partner.</p>
  <p class="clause">Upon receipt of any notice of termination, both the Parties shall conduct all their respective obligations until the Effective Date of termination mentioned in such notice in the manner which is consistent with the obligations of the Parties hereunder and does not prejudice the reputation or goodwill of either Party.</p>
  <p class="clause">Upon the termination of this Agreement, the Company shall return to the Brand Partner any products which remain unsold and in its possession within 40 days of the Effective Date of termination.</p>

  <div class="section-title">14. Confidentiality</div>
  <p class="clause">Both Parties agree to maintain the confidentiality of any business or financial information shared during the term of this Agreement, and for a period of 90 days after the Effective Date of the termination of this Agreement.</p>

  <div class="section-title">15. Governing Law &amp; Jurisdiction</div>
  <p class="clause">This Agreement shall be governed by and construed in accordance with the laws of India.</p>
  <p class="clause">Any disputes arising out of or in connection with this Agreement shall be subject to the exclusive jurisdiction of the courts in New Delhi, India.</p>

  <div class="section-title">16. Miscellaneous</div>
  <p class="clause"><strong>Entire Agreement:</strong> this Agreement (together with any schedules or annexures attached hereto and forming an integral part hereof) constitutes the full and entire understanding and agreement among the Parties with regard to the subject matter hereof and for the avoidance of doubt, supersedes and replaces and pre-existing agreements.</p>
  <p class="clause"><strong>Successors and assigns:</strong> except as otherwise expressly limited or provided for herein, the provisions of this Agreement shall inure to the benefit of, and be binding upon the successors, permitted assigns, heirs, executors and administrators of the Parties, as applicable.</p>
  <p class="clause"><strong>Waiver:</strong> no delay or omission to exercise any right, power or remedy accruing to any Party upon any breach or default under this Agreement, shall be deemed a waiver of any other breach or default occurred, or thereafter occurring. Any waiver, permit, consent or approval of any kind or character on the part of any Party of any breach or default under this Agreement, or any waiver on the part of any Party of any provisions or conditions of this Agreement, must be in writing and shall be effective only to the extent specifically set forth in such writing.</p>
  <p class="clause"><strong>Severability:</strong> if any provision of this Agreement is held by a court of competent jurisdiction to be unenforceable under applicable law, then such provision shall be excluded from this Agreement and the remainder of this Agreement shall be interpreted as if such provision was so excluded and the Agreement be enforceable in accordance with the remainder terms.</p>
  <p class="clause"><strong>Survival:</strong> the Parties hereby agree and acknowledge that those provisions of this Agreement which by their very nature, should be deemed to survive its termination shall survive. Notwithstanding anything to the contrary, the following provisions shall survive indefinitely the termination of this Agreement for any reason: Clause 9, Clause 11, Clause 14 and Clause 15.</p>
  <p class="clause"><strong>Relationship of the Parties:</strong> the Parties are independent contractors. Nothing in this Agreement creates a partnership, joint venture or agency relationship between the Parties, and neither Party shall have a fiduciary duty to the other in connection with this Agreement. Except as otherwise expressly provided in this Agreement, nothing grants either Party to bind any obligation or contract in the name or on account of the other Party, or to make any statement, representation, warranty or commitment on behalf of the other Party and all costs and obligations incurred by reason of any such employment shall be for the account and expense of such Party.</p>
  <p class="clause"><strong>Variations:</strong> any amendment or modification of this Agreement must be in writing and signed by authorised representatives of both Parties.</p>
  <p class="clause"><strong>Counterparts:</strong> this Agreement may be executed in any number of counterparts, each of which is an original and all of which taken together shall be deemed to constitute one and the same instrument.</p>

  <p class="clause">IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.</p>

  <div class="signature-block">
    <div style="float: left; width: 45%;">
      <p>For ZenZebra (Bohemian Curations Private Limited)</p>
      <p>Authorized Signatory: ______________________</p>
      <p>Name: ___________________________</p>
      <p>Designation: _______________________</p>
      <p>Date: ___________________________</p>
    </div>
    <div style="float: right; width: 45%;">
      <p>For <strong>${legalName}</strong></p>
      <p>Authorized Signatory: ______________________</p>
      <p>Name: ___________________________</p>
      <p>Designation: _______________________</p>
      <p>Date: ___________________________</p>
    </div>
    <div style="clear: both;"></div>
  </div>
</body>
</html>
  `;
}

export function renderLorHtml(data: Record<string, string>): string {
  const fullName = escapeHtml(data.FULL_NAME || '');
  const designation = escapeHtml(data.DESIGNATION || '');
  const dateStr = escapeHtml(data.DATE || '');
  const signatoryName = escapeHtml(data.SIGNATORY_NAME || 'Tanmay Jain');
  const signatoryRole = escapeHtml(data.SIGNATORY_ROLE || 'Co-Founder');

  const bodyHtml = (data.FINAL_DRAFT || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Letter of Recommendation — ${fullName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      color: #1a1a1a;
      font-size: 13px;
      margin: 0;
    }
    .page {
      position: relative;
      width: 210mm;
      background: #fff;
    }
    .corner-decoration {
      position: absolute;
      top: 0;
      left: 0;
      width: 70mm;
      z-index: 0;
    }
    .logo-box {
      position: absolute;
      top: 10mm;
      right: 10mm;
      width: 50mm;
      z-index: 1;
    }
    .content {
      position: relative;
      z-index: 1;
      padding: 55mm 18mm 20mm 18mm;
    }
    .title-block {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-bottom: 16mm;
    }
    .gold-line {
      flex: 1;
      max-width: 55px;
      height: 2px;
      background: #b8935a;
    }
    .title-text {
      text-align: center;
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1.15;
    }
    .title-line1 { font-size: 26px; color: #2e2e2e; }
    .title-line2 { font-size: 30px; font-style: italic; color: #2e2e2e; }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10mm;
      font-size: 13px;
    }
    .info-right { text-align: right; }
    .info-row p { margin: 2px 0; }
    .body-text { text-align: justify; line-height: 1.7; }
    .body-text p { margin: 0 0 12px 0; }
    .signoff { margin-top: 16mm; }
    .signoff p { margin: 2px 0; }
    .bottom-bar {
      /* fixed (not absolute) so it's pinned to the bottom of each printed
         page rather than the bottom of the content div, which would push
         it onto an orphan page if content runs even slightly past 297mm */
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 4mm;
      background: #b8935a;
    }
  </style>
</head>
<body>
  <div class="page">
    <img class="corner-decoration" src="${LOR_CORNER_IMG}" />
    <img class="logo-box" src="${LOR_LOGO_IMG}" />
    <div class="content">
      <div class="title-block">
        <span class="gold-line"></span>
        <div class="title-text">
          <div class="title-line1">Letter of</div>
          <div class="title-line2">Recommendation</div>
        </div>
        <span class="gold-line"></span>
      </div>

      <div class="info-row">
        <div>
          <p><strong>Letter to:</strong></p>
          <p>${fullName}</p>
          <p><strong>${designation}</strong></p>
          <p><strong>ZenZebra</strong></p>
        </div>
        <div class="info-right">
          <p><strong>Date:</strong></p>
          <p>${dateStr}</p>
        </div>
      </div>

      <p><strong>To Whom It May Concern:</strong></p>
      <div class="body-text">${bodyHtml}</div>

      <div class="signoff">
        <p>Best Regards</p>
        <br><br>
        <p><strong>${signatoryName}</strong></p>
        <p>${signatoryRole}</p>
      </div>
    </div>
    <div class="bottom-bar"></div>
  </div>
</body>
</html>
  `;
}

export function renderProformaInvoiceHtml(input: PiGeneratorInput): string {
  const {
    piNumber,
    date,
    buyerName,
    deliveryAddress = '',
    placeOfSupply = 'Delhi',
    transporter = '',
    destination = '',
    contactPerson = '',
    contactNumber = '',
    items,
  } = input;

  let totalTaxable = 0;
  let totalGst = 0;

  const itemRowsHtml = items.map((item, idx) => {
    const amount = Number(item.amount) || 0;
    const isSkuMode = item.billingMode === 'sku';
    const sku = isSkuMode && Number(item.sku) > 0 ? Number(item.sku) : 1;
    const effectiveRate = isSkuMode ? amount * sku : amount;
    const qty = Number(item.quantity) || 0;
    const gstPct = Number(item.gstPct) || 0;
    const rowGst = effectiveRate * (gstPct / 100);
    const rowTaxable = effectiveRate * qty;
    const rowTotal = rowTaxable + rowGst;

    totalTaxable += rowTaxable;
    totalGst += rowGst;

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>${escapeHtml(item.uom || 'NOS')}</td>
        <td style="text-align: center;">${qty}</td>
        <td style="text-align: right;">${effectiveRate.toFixed(2)}</td>
        <td style="text-align: right;">${gstPct}%</td>
        <td style="text-align: right;">${rowGst.toFixed(2)}</td>
        <td style="text-align: right; font-weight: bold;">${rowTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const grandTotal = totalTaxable + totalGst;
  const isDelhi = placeOfSupply.trim().toLowerCase() === 'delhi';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Proforma Invoice — ${escapeHtml(piNumber)}</title>
  <style>
    ${COMMON_CSS}
  </style>
</head>
<body>
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
    <div>
      <h1 style="font-size: 20px; margin: 0 0 6px 0;">PROFORMA INVOICE</h1>
      <p style="margin: 0; font-weight: bold; font-size: 14px;">BOHEMIAN CURATIONS PVT LTD</p>
      <p style="margin: 2px 0 0 0;">GST NO. 07AAMCB2083P1Z5</p>
      <p style="margin: 2px 0 0 0;">Plot No. 96, Pocket-2</p>
      <p style="margin: 2px 0 0 0;">Jasola, New Delhi-110025</p>
      <p style="margin: 2px 0 0 0;">Mobile No. 9910605187, 9958680856</p>
      <p style="margin: 2px 0 0 0;">admin@zenzebra.in | www.zenzebra.in</p>
    </div>
    <img src="${LOR_LOGO_IMG}" style="width: 160px;" />
  </div>

  <table class="header-table" style="border: 1px solid #d1d5db; padding: 12px; background-color: #f9fafb;">
    <tr>
      <td style="width: 50%; vertical-align: top;">
        <strong>Buyer:</strong><br>
        <span style="font-size: 14px; font-weight: bold;">${escapeHtml(buyerName)}</span><br>
        <strong>Delivery Address:</strong> ${escapeHtml(deliveryAddress)}<br>
        Contact: ${escapeHtml(contactPerson)} ${contactNumber ? '(' + escapeHtml(contactNumber) + ')' : ''}
      </td>
      <td style="width: 50%; vertical-align: top; text-align: right;">
        <strong>Invoice No:</strong> ${escapeHtml(piNumber)}<br>
        <strong>Date:</strong> ${escapeHtml(date)}<br>
        <strong>Place of Supply:</strong> ${escapeHtml(placeOfSupply)}<br>
        ${transporter ? '<strong>Transporter:</strong> ' + escapeHtml(transporter) + '<br>' : ''}
        ${destination ? '<strong>Destination:</strong> ' + escapeHtml(destination) : ''}
      </td>
    </tr>
  </table>

  <table class="content-table">
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 35%;">Description</th>
        <th style="width: 8%;">UOM</th>
        <th style="width: 8%;">Qty</th>
        <th style="width: 12%; text-align: right;">Rate (INR)</th>
        <th style="width: 8%; text-align: right;">GST %</th>
        <th style="width: 12%; text-align: right;">GST Amount</th>
        <th style="width: 12%; text-align: right;">Total Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHtml}
      <tr style="font-weight: bold; background-color: #f3f4f6;">
        <td colspan="3" style="text-align: right;">TOTAL</td>
        <td style="text-align: center;"></td>
        <td colspan="2"></td>
        <td style="text-align: right;">${totalGst.toFixed(2)}</td>
        <td style="text-align: right;">${grandTotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">Tax Summary Table</div>
  <table class="content-table" style="width: 60%;">
    <thead>
      <tr>
        <th>Taxable Amount</th>
        <th>CGST</th>
        <th>SGST</th>
        <th>IGST</th>
        <th>Total Tax Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Rs. ${totalTaxable.toFixed(2)}</td>
        <td>${isDelhi ? 'Rs. ' + (totalGst / 2).toFixed(2) : '-'}</td>
        <td>${isDelhi ? 'Rs. ' + (totalGst / 2).toFixed(2) : '-'}</td>
        <td>${!isDelhi ? 'Rs. ' + totalGst.toFixed(2) : '-'}</td>
        <td style="font-weight: bold;">Rs. ${totalGst.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 24px; font-size: 15px; font-weight: bold; text-align: right;">
    Grand Total: Rs. ${grandTotal.toFixed(2)}
  </div>

  <div style="display: flex; justify-content: space-between; margin-top: 28px; gap: 24px;">
    <div style="flex: 1;">
      <p style="font-weight: bold; margin: 0 0 6px 0;">TERMS &amp; CONDITIONS</p>
      <p style="margin: 2px 0;">1. The Rates are for Display.</p>
      <p style="margin: 2px 0;">2. Freight : Your scope</p>
      <p style="margin: 2px 0;">3. Payment terms : Against this PI, 100% Advance</p>
      <p style="margin: 2px 0;">4. GST : Extra applicable as shown above</p>
      <p style="margin: 10px 0 0 0;">Hope, our above offer will be best for your requirement.</p>
    </div>
    <div style="flex: 1;">
      <p style="font-weight: bold; margin: 0 0 6px 0;">OUR BANK DETAILS</p>
      <p style="margin: 2px 0;">ACCOUNT NAME : BOHEMIAN CURATIONS PRIVATE LIMITED</p>
      <p style="margin: 2px 0;">Bank Name - ICICI Bank</p>
      <p style="margin: 2px 0;">Account No. - 113405500373</p>
      <p style="margin: 2px 0;">IFSC CODE : ICIC0001134</p>
    </div>
  </div>

  <div style="text-align: right; margin-top: 24px;">
    <p style="margin: 0; font-weight: bold;">For BOHEMIAN CURATIONS PVT. LTD.</p>
    <img src="${PI_SIGNATURE_IMG}" style="width: 160px; margin: 4px 0;" />
    <p style="margin: 0;">(Authorised Signatory)</p>
  </div>
</body>
</html>
  `;
}
