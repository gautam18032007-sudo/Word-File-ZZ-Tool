import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PagedWriter } from './pdfTextLayout';

/**
 * Native pdf-lib fallback for the Brand Services Agreement.
 * Renders the same clause text as templates/brand-contract-template.docx
 * so it works on Vercel with zero external dependencies (no LibreOffice,
 * no Gotenberg) when convertDocumentToPdf() comes back empty.
 */
export async function generateBrandPdfNative(data: Record<string, string>): Promise<Buffer> {
  const legalName = data.LEGAL_NAME || '';
  const brandCategory = data.BRAND_CATEGORY || '';
  const address = data.ADDRESS || '';
  const stampingDate = data.STAMPING_DATE || '';
  const effectiveDate = data.EFFECTIVE_DATE || '';
  const feeClause = data.FEE_CLAUSE || '';
  const commissionClause = data.COMMISSION_CLAUSE || '';
  const paymentMethod = data.PAYMENT_METHOD || '[Payment Method]';

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

  const heading = (text: string) => {
    w.gap(6);
    w.drawLine(text, { font: bold, size: 11.5, gapAfter: 6 });
  };
  const clause = (text: string) => w.drawParagraph(text, { font, size: 10, gapAfter: 7 });
  const bullet = (text: string) => w.drawParagraph(`•  ${text}`, { font, size: 10, indent: 10, gapAfter: 5 });

  centerText('BRAND SERVICES AGREEMENT', 14);
  w.gap(12);

  clause(`This Brand Services Agreement ("Agreement") is reduced to writing on ${stampingDate}, and shall be effective from ${effectiveDate} ("Effective Date"), by and between:`);
  clause(`ZenZebra, also known as Bohemian Curations Private Limited, a company incorporated under the laws of India, having its registered office at A-11, A Block Rd, DDA Sheds, Pocket A, Okhla Phase I, Okhla Industrial Estate, New Delhi, Delhi 110020 (hereinafter referred to as the "Company"), and`);
  clause(`${legalName}, a company/individual engaged in the business of ${brandCategory}, having its principal place of business at ${address} (hereinafter referred to as the "Brand Partner").`);

  w.drawLine('Whereas:', { font: bold, size: 10.5, gapAfter: 4 });
  bullet('The Company is engaged in the business of setting up PermaPop Setups in various locations and promoting and distributing lifestyle products;');
  bullet(`The Brand Partner is engaged in the business of ${brandCategory};`);
  bullet('Relying on the representations made by the Brand Partner, the Company is desirous of displaying, promoting and distributing the products of the Brand Partner, subject to the terms and conditions set forth in this Agreement.');
  clause('Collectively referred to as the "Parties" and individually as a "Party."');

  heading('1. Scope of Services');
  clause(`The Company shall onboard the Brand Partner's products at its stores for promotion and sale thereof. The services provided by the Company shall include but not be limited to marketing, product display, payment collection, and customer engagement. The onboarding of the Brand Partner's products shall be valid during the Term (as defined hereinafter) on a non-exclusive basis.`);

  heading('2. Delivery');
  clause('During the Term, the Company shall place written orders with the Brand Partner for the products ("Order"), where each such order shall contain the following information:');
  bullet('The name and quantity of the products;');
  bullet('The delivery address to which such products should be delivered;');
  bullet('The delivery date and time at which such products shall be delivered.');
  clause('The Brand Partner shall use commercially reasonable efforts to accept each Order and supply to the Company with all of its requirements of the products ordered under this Agreement.');
  clause('The Brand Partner shall deliver the products to the delivery address as provided in the Order. All the costs associated with shipment and delivery of the products shall be borne by the Brand Partner.');
  clause('The Company shall verify and inspect the products delivered at the delivery address and communicate the acceptance of the products to the Brand Partner within 72 hours from the date of delivery.');
  clause('The Company shall within a period of 72 hours from the date of delivery of the products, be entitled to notify the Brand Partner for the return of such products which fulfil the following criteria ("Clause 2.5"):');
  bullet('Visibly damaged and/or defective; or');
  bullet('Not in conformity with the Order requirements.');
  clause('On the occurrence of the events as set out in Clause 2.5 above, the Company shall be entitled to return the relevant products to the Brand Partner. The Brand Partner shall schedule the pick-up of such products from the delivery address. The Brand Partner shall confirm the pick-up schedule and accordingly arrange for the pick-up of the products.');
  clause('The Brand Partner hereby agrees and undertakes that any and all costs and expenses including delivery expenses for delivering the products to the delivery address, and/or for the collection of products from the delivery address shall be borne by the Brand Partner.');

  heading('3. Duration');
  clause(`This Agreement shall commence on ${effectiveDate} and shall remain in effect until terminated in accordance with Clause 13 of this Agreement ("Term").`);

  heading('4. Rental and Commission Structure');
  clause('The Brand Partner agrees to pay the Company:');
  bullet(feeClause);
  bullet(commissionClause);

  heading('5. Reverse Logistics Costs');
  clause('The responsibility for the costs associated with reverse logistics (returns from end customers) shall be borne by the Brand Partner.');
  clause('The Company shall facilitate the return process but shall not be liable for associated costs unless otherwise agreed.');

  heading('6. Insurance Coverage');
  clause('The Company shall be responsible for maintaining adequate insurance coverage for their products displayed at the PermaPop Setup, covering potential risks such as loss, damage, or theft, and any third party claims in respect of the products.');
  clause('The Company shall not be held liable for any loss or damage unless it results from gross negligence or willful misconduct.');

  heading('7. Payment to Brand Partner');
  clause('Payments for products sold shall be made by the Company to the Brand Partner on the 10th, 20th, and 30th day of each calendar month, based on sales completed within the corresponding period.');
  clause(`Payments shall be processed through ${paymentMethod} (e.g., bank transfer, digital wallet, etc.).`);

  heading('8. Point of Sale (POS) System Integration');
  clause('All sales transactions shall be processed through a POS payment system incorporated by the Company.');
  clause('The Company shall collect payments from customers on behalf of the Brand Partner and disburse the due amount after deducting applicable commissions and fees.');

  heading('9. Representations and Warranties');
  clause('Each Party hereby represents and warrants that:');
  bullet('It has all requisite authority and rights to enter into and to perform its obligations under this Agreement;');
  bullet('It has full and absolute power to execute and enter into this Agreement, and does not and will not violate any law, rule, regulation, order, or decree applicable to it;');
  bullet('No proceedings are pending against it which shall have a material adverse impact on the implementation of this Agreement or the performance of the obligations hereunder;');
  bullet('It has full legal capacity to enter into this Agreement and that there are no existing facts/circumstances/contractual obligations with third parties which prohibits or impairs its capacity to enter into this Agreement.');
  clause('The Brand Partner represents and warrants to the Company that:');
  bullet('The products have been manufactured in compliance with applicable law;');
  bullet('It has all necessary licenses and permits to manufacture the products;');
  bullet(`It has not directly or indirectly violated the intellectual property rights of any third party, and there are no pending or threatened claims against it regarding infringement of a third party's intellectual property rights.`);
  clause('The Company represents and warrants to the Brand Partner that:');
  bullet('It has the necessary skill and resources to carry out its obligations under this Agreement;');
  bullet('It has obtained all licenses, approvals and consents necessary under the applicable laws to carry on its business operations and is in compliance with the licenses, approvals and consents under applicable laws.');

  heading('10. Limitation of Liability');
  clause('In no event shall the Company be liable to the Brand Partner for any indirect, incidental, special, consequential, or punitive damages, including lost profits or loss of business opportunities.');
  clause(`The Company's total liability under this Agreement shall be limited to the total amount paid by the Brand Partner to the Company in the preceding 1 month.`);

  heading('11. Indemnity');
  clause('The Brand Partner shall indemnify, defend, and hold harmless the Company, its affiliates, directors, employees, and agents from and against any claims, liabilities, damages, costs, and expenses arising out of any breach of this Agreement, negligence, willful misconduct, violation of applicable laws, or breach of any representations by the Brand Partner.');
  clause('The Brand Partner shall further indemnify, defend, and hold harmless the Company from any claims, disputes, legal actions, damages, or liabilities arising from complaints, defects, deficiencies, or quality issues related to the products sold through the PermaPop Setups, including but not limited to claims made by customers or third parties.');
  clause('In the event of any legal proceedings or disputes initiated by customers concerning the products, the Brand Partner shall assume full responsibility and shall bear all associated costs, including legal fees and settlement amounts, and shall indemnify the Company against any loss or damage suffered as a result.');

  heading('12. Act of God (Force Majeure)');
  clause('Neither Party shall be liable for any failure or delay in the performance of its obligations under this Agreement due to any cause beyond its reasonable control, including but not limited to natural disasters, strikes, wars, pandemics, government restrictions, or disruptions in supply chains ("Force Majeure Event").');
  clause('If a Force Majeure Event continues for more than 15 days, either Party may terminate this Agreement upon written notice to the other Party.');

  heading('13. Termination');
  clause('Either Party may terminate this Agreement by providing 20 days written notice.');
  clause('The Company reserves the right to terminate the Agreement immediately in case of non-compliance, non-payment, or breach of terms by the Brand Partner.');
  clause('Upon receipt of any notice of termination, both the Parties shall conduct all their respective obligations until the Effective Date of termination mentioned in such notice in the manner which is consistent with the obligations of the Parties hereunder and does not prejudice the reputation or goodwill of either Party.');
  clause('Upon the termination of this Agreement, the Company shall return to the Brand Partner any products which remain unsold and in its possession within 40 days of the Effective Date of termination.');

  heading('14. Confidentiality');
  clause('Both Parties agree to maintain the confidentiality of any business or financial information shared during the term of this Agreement, and for a period of 90 days after the Effective Date of the termination of this Agreement.');

  heading('15. Governing Law & Jurisdiction');
  clause('This Agreement shall be governed by and construed in accordance with the laws of India.');
  clause('Any disputes arising out of or in connection with this Agreement shall be subject to the exclusive jurisdiction of the courts in New Delhi, India.');

  heading('16. Miscellaneous');
  clause('Entire Agreement: this Agreement (together with any schedules or annexures attached hereto and forming an integral part hereof) constitutes the full and entire understanding and agreement among the Parties with regard to the subject matter hereof and for the avoidance of doubt, supersedes and replaces and pre-existing agreements.');
  clause('Successors and assigns: except as otherwise expressly limited or provided for herein, the provisions of this Agreement shall inure to the benefit of, and be binding upon the successors, permitted assigns, heirs, executors and administrators of the Parties, as applicable.');
  clause('Waiver: no delay or omission to exercise any right, power or remedy accruing to any Party upon any breach or default under this Agreement, shall be deemed a waiver of any other breach or default occurred, or thereafter occurring. Any waiver, permit, consent or approval of any kind or character on the part of any Party of any breach or default under this Agreement, or any waiver on the part of any Party of any provisions or conditions of this Agreement, must be in writing and shall be effective only to the extent specifically set forth in such writing.');
  clause('Severability: if any provision of this Agreement is held by a court of competent jurisdiction to be unenforceable under applicable law, then such provision shall be excluded from this Agreement and the remainder of this Agreement shall be interpreted as if such provision was so excluded and the Agreement be enforceable in accordance with the remainder terms.');
  clause('Survival: the Parties hereby agree and acknowledge that those provisions of this Agreement which by their very nature, should be deemed to survive its termination shall survive. Notwithstanding anything to the contrary, the following provisions shall survive indefinitely the termination of this Agreement for any reason: Clause 9, Clause 11, Clause 14 and Clause 15.');
  clause('Relationship of the Parties: the Parties are independent contractors. Nothing in this Agreement creates a partnership, joint venture or agency relationship between the Parties, and neither Party shall have a fiduciary duty to the other in connection with this Agreement. Except as otherwise expressly provided in this Agreement, nothing grants either Party to bind any obligation or contract in the name or on account of the other Party, or to make any statement, representation, warranty or commitment on behalf of the other Party and all costs and obligations incurred by reason of any such employment shall be for the account and expense of such Party.');
  clause('Variations: any amendment or modification of this Agreement must be in writing and signed by authorised representatives of both Parties.');
  clause('Counterparts: this Agreement may be executed in any number of counterparts, each of which is an original and all of which taken together shall be deemed to constitute one and the same instrument.');

  clause('IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.');

  w.gap(20);
  w.ensureSpace(90);
  const sigY = w.y;
  w.page.drawText('For ZenZebra (Bohemian Curations Private Limited)', { x: w.marginX, y: sigY, size: 9.5, font: bold });
  w.page.drawText(`For ${legalName}`, { x: w.width / 2 + 20, y: sigY, size: 9.5, font: bold });
  w.page.drawText('Authorized Signatory: ______________________', { x: w.marginX, y: sigY - 24, size: 9, font });
  w.page.drawText('Authorized Signatory: ______________________', { x: w.width / 2 + 20, y: sigY - 24, size: 9, font });
  w.page.drawText('Name: ___________________________', { x: w.marginX, y: sigY - 40, size: 9, font });
  w.page.drawText('Name: ___________________________', { x: w.width / 2 + 20, y: sigY - 40, size: 9, font });
  w.page.drawText('Designation: _______________________', { x: w.marginX, y: sigY - 56, size: 9, font });
  w.page.drawText('Designation: _______________________', { x: w.width / 2 + 20, y: sigY - 56, size: 9, font });
  w.page.drawText('Date: ___________________________', { x: w.marginX, y: sigY - 72, size: 9, font });
  w.page.drawText('Date: ___________________________', { x: w.width / 2 + 20, y: sigY - 72, size: 9, font });
  w.y = sigY - 90;

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
