import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { renderDocx } from '@/lib/template';
import { docxToPdf, PdfError } from '@/lib/pdf';
import { supportsLibreOffice, isVercel } from '@/lib/environment';
import { generatePdfFromHtml } from '@/lib/pdfRenderer';
import { renderBrandContractHtml } from '@/lib/documentHtmlRenderer';
import { nextContractNumber, buildFilename } from '@/lib/contractNumber';


import { appendContract } from '@/lib/store';
import { formatINR, formatDate } from '@/lib/formatting';
import type { BrandRow, Location, ContractType } from '@/lib/types';
import { logger } from '@/lib/logger';
import { writableDir } from '@/lib/paths';

const OUTPUT_DIR = path.join(writableDir('output'), 'brands');

interface BrandGeneratePayload {
  brand: BrandRow;
  location: Location;
  contractType: ContractType;
  amountPerMonth?: number;
  amountPerSku?: number;
  amountSwn?: number;
  amountKlj?: number;
  noOfMonths?: number;
  noOfSku?: number;
  commissionPct: string;        // used when location !== 'BOTH'
  commissionPctSwn?: string;    // used when location === 'BOTH'
  commissionPctKlj?: string;    // used when location === 'BOTH'
  effectiveDate?: string;  // ISO date (optional)
  stampingDate?: string;   // ISO date (optional)
}

function buildLocationText(location: Location): string {
  return { SWN: 'SWN setup', KLJ: 'KLJ setup', BOTH: 'SWN and KLJ setups' }[location];
}

function calcTotal(payload: BrandGeneratePayload): {
  displayAmount: number;
  totalAmount: number;
} {
  const { location, contractType, amountPerMonth = 0, amountPerSku = 0,
    amountSwn = 0, amountKlj = 0, noOfMonths = 0, noOfSku = 0 } = payload;

  if (location === 'BOTH') {
    if (contractType === 'MONTH') {
      return {
        displayAmount: amountSwn,
        totalAmount: (amountSwn + amountKlj) * noOfMonths,
      };
    }
    return {
      displayAmount: amountSwn,
      totalAmount: (amountSwn + amountKlj) * noOfSku * noOfMonths,
    };
  }

  if (contractType === 'MONTH') {
    return { displayAmount: amountPerMonth, totalAmount: amountPerMonth * noOfMonths };
  }
  return { displayAmount: amountPerSku, totalAmount: amountPerSku * noOfSku * noOfMonths };
}

function monthsWord(n: number): string {
  return `${n} month${n === 1 ? '' : 's'}`;
}

/**
 * Builds the two "Rental and Commission Structure" list-item sentences.
 * Wording branches structurally on Location (BOTH names both setups with two
 * amounts; a single location names just that one) — this can't be expressed
 * with small per-field tags, so the whole sentence is composed here and
 * dropped into a single {{FEE_CLAUSE}} / {{COMMISSION_CLAUSE}} tag.
 */
function buildFeeAndCommissionClauses(payload: BrandGeneratePayload): {
  feeClause: string;
  commissionClause: string;
} {
  const { location, contractType, amountPerMonth = 0, amountPerSku = 0,
    amountSwn = 0, amountKlj = 0, noOfMonths = 0, noOfSku = 0,
    commissionPct, commissionPctSwn, commissionPctKlj } = payload;
  const months = monthsWord(noOfMonths);

  if (location === 'BOTH') {
    const perUnit = contractType === 'MONTH' ? 'month' : 'SKU';
    const totalSwn = contractType === 'MONTH' ? amountSwn * noOfMonths : amountSwn * noOfSku * noOfMonths;
    const totalKlj = contractType === 'MONTH' ? amountKlj * noOfMonths : amountKlj * noOfSku * noOfMonths;
    const skuSuffix = contractType === 'SKU' ? `, for ${noOfSku} SKUs` : '';

    return {
      feeClause:
        `An advance fixed fee of ${formatINR(amountSwn)} per ${perUnit} for the SWN setup and ` +
        `${formatINR(amountKlj)} per ${perUnit} for the KLJ setup${skuSuffix}, payable for a period of ${months}, ` +
        `amounting to a total of ${formatINR(totalSwn + totalKlj)} (exclusive of GST); and`,
      commissionClause:
        `A commission of ${commissionPctSwn}% on the sale price of each product sold through the SWN setup and ` +
        `${commissionPctKlj}% on the sale price of each product sold through the KLJ setup, as disclosed in the Proforma Invoice (PI).`,
    };
  }

  const locationLabel = location === 'SWN' ? 'SWN' : 'KLJ';
  const amount = contractType === 'MONTH' ? amountPerMonth : amountPerSku;
  const total = contractType === 'MONTH' ? amount * noOfMonths : amount * noOfSku * noOfMonths;
  const perUnit = contractType === 'MONTH' ? 'month' : 'SKU';
  const skuSuffix = contractType === 'SKU' ? `, for ${noOfSku} SKUs` : '';

  return {
    feeClause:
      `An advance fixed fee of ${formatINR(amount)} per ${perUnit} for the ${locationLabel} setup${skuSuffix}, ` +
      `payable for a period of ${months}, amounting to a total of ${formatINR(total)} (exclusive of GST); and`,
    commissionClause:
      `A commission of ${commissionPct}% on the sale price of each product sold through the ${locationLabel} setup, ` +
      `as disclosed in the Proforma Invoice (PI).`,
  };
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

  const { brand, location, contractType, noOfMonths = 0, noOfSku = 0,
    commissionPct, commissionPctSwn, commissionPctKlj } = payload;

  // Enforce zero and negative checks
  if (noOfMonths <= 0) {
    logger.error(`[API/generate/brand] Invalid Months count: ${noOfMonths}`);
    return NextResponse.json({ error: 'Months count must be greater than 0.' }, { status: 400 });
  }
  if (contractType === 'SKU' && noOfSku <= 0) {
    logger.error(`[API/generate/brand] Invalid SKU count: ${noOfSku}`);
    return NextResponse.json({ error: 'SKU count must be greater than 0 for SKU contracts.' }, { status: 400 });
  }
  if (location === 'BOTH') {
    const swnPctNum = parseFloat(commissionPctSwn ?? '') || 0;
    const kljPctNum = parseFloat(commissionPctKlj ?? '') || 0;
    if (swnPctNum <= 0 || kljPctNum <= 0) {
      logger.error(`[API/generate/brand] Invalid Commission %: SWN=${commissionPctSwn}, KLJ=${commissionPctKlj}`);
      return NextResponse.json({ error: 'Commission % must be greater than 0 for both SWN and KLJ.' }, { status: 400 });
    }
  } else {
    const commPctNum = parseFloat(commissionPct) || 0;
    if (commPctNum <= 0) {
      logger.error(`[API/generate/brand] Invalid Commission %: ${commissionPct}`);
      return NextResponse.json({ error: 'Commission % must be greater than 0.' }, { status: 400 });
    }
  }
  if (
    (payload.amountPerMonth !== undefined && payload.amountPerMonth <= 0 && contractType === 'MONTH' && location !== 'BOTH') ||
    (payload.amountPerSku !== undefined && payload.amountPerSku <= 0 && contractType === 'SKU' && location !== 'BOTH') ||
    (payload.amountSwn !== undefined && payload.amountSwn <= 0 && location === 'BOTH') ||
    (payload.amountKlj !== undefined && payload.amountKlj <= 0 && location === 'BOTH')
  ) {
    logger.error(`[API/generate/brand] Amount must be greater than 0.`);
    return NextResponse.json({ error: 'All amount fields must be greater than 0.' }, { status: 400 });
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

  const locationText = buildLocationText(location);
  const { totalAmount } = calcTotal(payload);
  const { feeClause, commissionClause } = buildFeeAndCommissionClauses(payload);

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
    let message: string | undefined = undefined;

    if (supportsLibreOffice()) {
      try {
        logger.gen(`[API/generate/brand] Converting DOCX to PDF via LibreOffice...`);
        const pdfBytes = docxToPdf(docxBytes);
        pdfName = buildFilename(contractNo, brand.legalName, 'pdf');
        fs.writeFileSync(path.join(OUTPUT_DIR, pdfName), pdfBytes);
        logger.gen(`[API/generate/brand] Saved PDF: ${pdfName}`);
      } catch (e) {
        if (!(e instanceof PdfError)) throw e;
        logger.error(`[API/generate/brand] PDF conversion failed (skipped): ${e.message}`);
        message = 'PDF generation unavailable.';
      }
    } else if (isVercel()) {
      try {
        logger.gen(`[API/generate/brand] Generating PDF via Puppeteer Chromium on Vercel...`);
        const html = renderBrandContractHtml(data);
        const pdfBytes = await generatePdfFromHtml(html);
        pdfName = buildFilename(contractNo, brand.legalName, 'pdf');
        fs.writeFileSync(path.join(OUTPUT_DIR, pdfName), pdfBytes);
        logger.gen(`[API/generate/brand] Saved Puppeteer PDF: ${pdfName}`);
      } catch (e) {
        logger.error(`[API/generate/brand] Puppeteer PDF rendering failed: ${e}`);
        message = 'PDF generation unavailable.';
      }
    } else {
      message = 'PDF generation unavailable.';
      logger.gen(`[API/generate/brand] LibreOffice and Vercel unavailable. Skipping PDF conversion.`);
    }


    appendContract({
      contract_no: contractNo,
      type: 'brand',
      party_name: brand.legalName,
      generated_at: new Date().toISOString(),
      docx: docxName,
      pdf: pdfName,
      folder: 'brands',
      location,
      total_amount: totalAmount,
    });
    logger.gen(`[API/generate/brand] Appended contract #${contractNo} to history.`);

    return NextResponse.json({
      success: true,
      contractNo,
      docxName,
      pdfName,
      message,
    });

  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`[API/generate/brand] Generation failed: ${errMsg}`);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
