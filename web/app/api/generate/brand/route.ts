import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { renderDocx } from '@/lib/template';
import { docxToPdf, PdfError } from '@/lib/pdf';
import { nextContractNumber, buildFilename } from '@/lib/contractNumber';
import { appendContract } from '@/lib/store';
import { formatINR, formatDate } from '@/lib/formatting';
import type { BrandRow, Location, ContractType } from '@/lib/types';

const OUTPUT_DIR = path.resolve(process.cwd(), '..', 'output', 'brands');

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
  commissionPct: string;
  effectiveDate: string;  // ISO date
  stampingDate: string;   // ISO date
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

export async function POST(req: NextRequest) {
  let payload: BrandGeneratePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { brand, location, contractType, noOfMonths = 0, noOfSku = 0,
    commissionPct, effectiveDate, stampingDate } = payload;

  let effectiveDateFmt: string, stampingDateFmt: string;
  try {
    effectiveDateFmt = formatDate(effectiveDate);
    stampingDateFmt = formatDate(stampingDate);
  } catch {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
  }

  const locationText = buildLocationText(location);
  const { displayAmount, totalAmount } = calcTotal(payload);

  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const contractNo = nextContractNumber('BRAND');
    const data: Record<string, string> = {
      LEGAL_NAME: brand.legalName,
      BRAND_CATEGORY: brand.brandCategory,
      ADDRESS: brand.address,
      EMAIL: brand.email,
      PHONE: brand.phone,
      CONTACT_PERSON: brand.contactPerson,
      STAMPING_DATE: stampingDateFmt,
      EFFECTIVE_DATE: effectiveDateFmt,
      LOCATION_TEXT: locationText,
      AMOUNT: formatINR(displayAmount),
      NO_OF_MONTHS: String(noOfMonths),
      NO_OF_SKUS: String(noOfSku),
      TOTAL_AMOUNT: formatINR(totalAmount),
      COMMISSION_PCT: `${commissionPct}%`,
      PAYMENT_METHOD: '',
    };

    const docxBytes = renderDocx('brand-contract-template.docx', data);
    const docxName = buildFilename(contractNo, brand.legalName, 'docx');
    fs.writeFileSync(path.join(OUTPUT_DIR, docxName), docxBytes);

    let pdfName: string | null = null;
    try {
      const pdfBytes = docxToPdf(docxBytes);
      pdfName = buildFilename(contractNo, brand.legalName, 'pdf');
      fs.writeFileSync(path.join(OUTPUT_DIR, pdfName), pdfBytes);
    } catch (e) {
      if (!(e instanceof PdfError)) throw e;
      // PDF is optional — DOCX always succeeds
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

    return NextResponse.json({ contractNo, docxName, pdfName });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
