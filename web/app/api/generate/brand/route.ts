import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { renderDocx } from '@/lib/template';
import { convertDocumentToPdf } from '@/lib/pdfProvider';

import { nextContractNumber, buildFilename } from '@/lib/contractNumber';



import { appendContract } from '@/lib/store';
import { uploadToBlob } from '@/lib/blobStore';

import { formatINR, formatDate } from '@/lib/formatting';
import type { BrandRow, Location, ContractType } from '@/lib/types';
import { logger } from '@/lib/logger';
import { writableDir } from '@/lib/paths';

const OUTPUT_DIR = path.join(writableDir('output'), 'brands');

export const maxDuration = 60;

interface BrandGeneratePayload {
  brand: BrandRow;
  location?: Location;
  locations?: string[];
  amountsByLocation?: Record<string, number>;
  commissionsByLocation?: Record<string, string>;
  contractType: ContractType;
  amountPerMonth?: number;
  amountPerSku?: number;
  amountSwn?: number;
  amountKlj?: number;
  noOfMonths?: number;
  noOfSku?: number;
  commissionPct?: string;        // used when location !== 'BOTH'
  commissionPctSwn?: string;    // used when location === 'BOTH'
  commissionPctKlj?: string;    // used when location === 'BOTH'
  effectiveDate?: string;  // ISO date (optional)
  stampingDate?: string;   // ISO date (optional)
}

function resolveLocationData(payload: BrandGeneratePayload): {
  locations: string[];
  amounts: Record<string, number>;
  commissions: Record<string, string>;
} {
  if (payload.locations && Array.isArray(payload.locations) && payload.locations.length > 0) {
    const locs = payload.locations;
    const amounts: Record<string, number> = {};
    const commissions: Record<string, string> = {};
    locs.forEach(loc => {
      amounts[loc] = payload.amountsByLocation?.[loc] ?? (payload.contractType === 'MONTH' ? payload.amountPerMonth : payload.amountPerSku) ?? 0;
      commissions[loc] = payload.commissionsByLocation?.[loc] ?? payload.commissionPct ?? '';
    });
    return { locations: locs, amounts, commissions };
  }

  const loc = payload.location || 'SWN';
  if (loc === 'BOTH') {
    return {
      locations: ['SWN', 'KLJ'],
      amounts: { SWN: payload.amountSwn || 0, KLJ: payload.amountKlj || 0 },
      commissions: { SWN: payload.commissionPctSwn || '', KLJ: payload.commissionPctKlj || '' },
    };
  }

  const unitAmt = (payload.contractType === 'MONTH' ? payload.amountPerMonth : payload.amountPerSku) || 0;
  return {
    locations: [loc],
    amounts: { [loc]: unitAmt },
    commissions: { [loc]: payload.commissionPct || '' },
  };
}

function buildLocationText(locations: string[]): string {
  if (!locations || locations.length === 0) return 'SWN setup';
  if (locations.length === 1) return `${locations[0]} setup`;
  if (locations.length === 2) return `${locations[0]} and ${locations[1]} setups`;
  const allButLast = locations.slice(0, -1).join(', ');
  return `${allButLast} and ${locations[locations.length - 1]} setups`;
}

function calcTotal(payload: BrandGeneratePayload, locations: string[], amounts: Record<string, number>): {
  displayAmount: number;
  totalAmount: number;
} {
  const { contractType, noOfMonths = 0, noOfSku = 0 } = payload;

  if (contractType === 'COMMISSION') {
    return { displayAmount: 0, totalAmount: 0 };
  }

  const sumPerUnit = locations.reduce((sum, loc) => sum + (amounts[loc] || 0), 0);
  const totalAmount = contractType === 'MONTH' 
    ? sumPerUnit * noOfMonths 
    : sumPerUnit * noOfSku * noOfMonths;

  return {
    displayAmount: amounts[locations[0]] || sumPerUnit,
    totalAmount,
  };
}

function monthsWord(n: number): string {
  return `${n} month${n === 1 ? '' : 's'}`;
}

function isValidCommission(val: string | undefined): boolean {
  if (val === undefined || val === null || val.trim() === '') return false;
  const num = Number(val);
  if (isNaN(num)) return false;
  return num > 0 && num <= 100;
}

function buildFeeAndCommissionClauses(
  payload: BrandGeneratePayload,
  locations: string[],
  amounts: Record<string, number>,
  commissions: Record<string, string>
): {
  feeClause: string;
  commissionClause: string;
} {
  const { contractType, noOfMonths = 0, noOfSku = 0 } = payload;
  const { totalAmount } = calcTotal(payload, locations, amounts);

  if (contractType === 'COMMISSION') {
    let commText = '';
    if (locations.length === 1) {
      commText = `A commission of ${commissions[locations[0]] || '0'}% on the sale price of each product sold through the ${locations[0]} setup, as disclosed in the Proforma Invoice (PI).`;
    } else if (locations.length === 2) {
      commText = `A commission of ${commissions[locations[0]] || '0'}% on the sale price of each product sold through the ${locations[0]} setup and ${commissions[locations[1]] || '0'}% on the sale price of each product sold through the ${locations[1]} setup, as disclosed in the Proforma Invoice (PI).`;
    } else {
      const parts = locations.map(loc => `${commissions[loc] || '0'}% on the sale price of each product sold through the ${loc} setup`);
      const allButLast = parts.slice(0, -1).join(', ');
      commText = `A commission of ${allButLast}, and ${parts[parts.length - 1]}, as disclosed in the Proforma Invoice (PI).`;
    }

    return {
      feeClause: '',
      commissionClause: commText,
    };
  }

  const months = monthsWord(noOfMonths);
  const perUnit = contractType === 'MONTH' ? 'month' : 'SKU';
  const skuSuffix = contractType === 'SKU' ? `, for ${noOfSku} SKUs` : '';

  let feeText = '';
  if (locations.length === 1) {
    const loc = locations[0];
    const amt = amounts[loc] || 0;
    const total = contractType === 'MONTH' ? amt * noOfMonths : amt * noOfSku * noOfMonths;
    feeText = `An advance fixed fee of ${formatINR(amt)} per ${perUnit} for the ${loc} setup${skuSuffix}, payable for a period of ${months}, amounting to a total of ${formatINR(total)} (exclusive of GST); and`;
  } else if (locations.length === 2) {
    const loc1 = locations[0], loc2 = locations[1];
    const amt1 = amounts[loc1] || 0, amt2 = amounts[loc2] || 0;
    feeText = `An advance fixed fee of ${formatINR(amt1)} per ${perUnit} for the ${loc1} setup and ${formatINR(amt2)} per ${perUnit} for the ${loc2} setup${skuSuffix}, payable for a period of ${months}, amounting to a total of ${formatINR(totalAmount)} (exclusive of GST); and`;
  } else {
    const parts = locations.map(loc => `${formatINR(amounts[loc] || 0)} per ${perUnit} for the ${loc} setup`);
    const allButLast = parts.slice(0, -1).join(', ');
    feeText = `An advance fixed fee of ${allButLast}, and ${parts[parts.length - 1]}${skuSuffix}, payable for a period of ${months}, amounting to a total of ${formatINR(totalAmount)} (exclusive of GST); and`;
  }

  let commText = '';
  if (locations.length === 1) {
    commText = `A commission of ${commissions[locations[0]] || '0'}% on the sale price of each product sold through the ${locations[0]} setup, as disclosed in the Proforma Invoice (PI).`;
  } else if (locations.length === 2) {
    commText = `A commission of ${commissions[locations[0]] || '0'}% on the sale price of each product sold through the ${locations[0]} setup and ${commissions[locations[1]] || '0'}% on the sale price of each product sold through the ${locations[1]} setup, as disclosed in the Proforma Invoice (PI).`;
  } else {
    const parts = locations.map(loc => `${commissions[loc] || '0'}% on the sale price of each product sold through the ${loc} setup`);
    const allButLast = parts.slice(0, -1).join(', ');
    commText = `A commission of ${allButLast}, and ${parts[parts.length - 1]}, as disclosed in the Proforma Invoice (PI).`;
  }

  return { feeClause: feeText, commissionClause: commText };
}

export async function POST(req: NextRequest) {
  let payload: BrandGeneratePayload;
  try {
    payload = await req.json();
    logger.gen(`[API/generate/brand] Received generate request for brand: "${payload.brand?.legalName || 'Unknown'}"`);
  } catch (err) {
    logger.error(`[API/generate/brand] Invalid payload JSON: ${err}`);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { brand, contractType, noOfMonths = 0, noOfSku = 0 } = payload;

  const { locations, amounts, commissions } = resolveLocationData(payload);

  if (locations.length === 0) {
    return NextResponse.json({ error: 'Please select at least one location.' }, { status: 400 });
  }

  // Enforce zero and negative checks
  if (contractType !== 'COMMISSION') {
    if (noOfMonths <= 0) {
      logger.error(`[API/generate/brand] Invalid Months count: ${noOfMonths}`);
      return NextResponse.json({ error: 'Months count must be greater than 0.' }, { status: 400 });
    }
    if (contractType === 'SKU' && noOfSku <= 0) {
      logger.error(`[API/generate/brand] Invalid SKU count: ${noOfSku}`);
      return NextResponse.json({ error: 'SKU count must be greater than 0 for SKU contracts.' }, { status: 400 });
    }

    for (const loc of locations) {
      if ((amounts[loc] ?? 0) <= 0) {
        logger.error(`[API/generate/brand] Amount for location ${loc} must be greater than 0.`);
        return NextResponse.json({ error: `Amount for location "${loc}" must be greater than 0.` }, { status: 400 });
      }
    }
  }

  for (const loc of locations) {
    if (!isValidCommission(commissions[loc])) {
      logger.error(`[API/generate/brand] Invalid Commission % for location ${loc}: ${commissions[loc]}`);
      return NextResponse.json({ error: `Commission % for location "${loc}" must be a number between 0 and 100.` }, { status: 400 });
    }
  }

  // Generate current date in Asia/Kolkata (IST) timezone
  const today = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(today);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value.padStart(2, '0');
  const day = parts.find(p => p.type === 'day')?.value.padStart(2, '0');
  const todayIso = `${year}-${month}-${day}`;

  const effectiveDateFmt = formatDate(todayIso);
  const stampingDateFmt = formatDate(todayIso);

  const locationText = buildLocationText(locations);
  const { totalAmount } = calcTotal(payload, locations, amounts);
  const { feeClause, commissionClause } = buildFeeAndCommissionClauses(payload, locations, amounts, commissions);

  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const contractNo = nextContractNumber('BRAND');

    const data: Record<string, string> = {
      LEGAL_NAME: brand.legalName,
      BRAND_CATEGORY: brand.brandCategory,
      ADDRESS: brand.address,
      EMAIL: '',
      PHONE: '',
      CONTACT_PERSON: '',
      STAMPING_DATE: stampingDateFmt,
      EFFECTIVE_DATE: effectiveDateFmt,
      LOCATION: locationText,
      FEE_CLAUSE: feeClause,
      COMMISSION_CLAUSE: commissionClause,
      PAYMENT_METHOD: '',
    };

    logger.gen(`[API/generate/brand] Generating template for contract #${contractNo}`);
    const docxBytes = renderDocx('brand-contract-template.docx', data);
    const docxName = buildFilename(contractNo, brand.legalName, 'docx');
    fs.writeFileSync(path.join(OUTPUT_DIR, docxName), docxBytes);
    logger.gen(`[API/generate/brand] Saved DOCX: ${docxName}`);

    let pdfName: string | null = null;
    let pdfBase64: string | null = null;
    let message: string | undefined = undefined;

    const docxNameForPdf = buildFilename(contractNo, brand.legalName, 'docx');
    const pdfResult = await convertDocumentToPdf(docxBytes, docxNameForPdf);

    let pdfBuffer = pdfResult.pdfBuffer;
    if (!pdfBuffer) {
      logger.gen(`[API/generate/brand] No PDF engine available for contract #${contractNo} — DOCX only. Set GOTENBERG_URL to enable PDF generation.`);
    }

    if (pdfBuffer) {
      pdfName = buildFilename(contractNo, brand.legalName, 'pdf');
      fs.writeFileSync(path.join(OUTPUT_DIR, pdfName), pdfBuffer);
      pdfBase64 = pdfBuffer.toString('base64');
      logger.gen(`[API/generate/brand] Saved PDF (${pdfResult.method}): ${pdfName}`);
    } else {
      message = pdfResult.error || 'PDF generation unavailable.';
    }




    let docxBlobUrl: string | undefined = undefined;
    let pdfBlobUrl: string | undefined = undefined;

    if (docxBytes && docxName) {
      const u = await uploadToBlob(docxName, docxBytes, 'brands');
      if (u) docxBlobUrl = u;
    }
    if (pdfBase64 && pdfName) {
      const pdfBuf = Buffer.from(pdfBase64, 'base64');
      const u = await uploadToBlob(pdfName, pdfBuf, 'brands');
      if (u) pdfBlobUrl = u;
    }

    appendContract({
      contract_no: contractNo,
      type: 'brand',
      party_name: brand.legalName,
      generated_at: new Date().toISOString(),
      docx: docxName,
      pdf: pdfName,
      folder: 'brands',
      docx_blob_url: docxBlobUrl,
      pdf_blob_url: pdfBlobUrl,
      location: locationText,
      total_amount: totalAmount,
    });

    logger.gen(`[API/generate/brand] Appended contract #${contractNo} to history.`);

    return NextResponse.json({
      success: true,
      contractNo,
      docxName,
      pdfName,
      docxBase64: docxBytes.toString('base64'),
      pdfBase64,
      message,
    });

  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`[API/generate/brand] Generation failed: ${errMsg}`);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
