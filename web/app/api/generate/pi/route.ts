import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { generatePiWorkbook } from "@/lib/piGenerator";
import { nextContractNumber, buildFilename, peekNextPiNumber, commitPiNumber } from "@/lib/contractNumber";

import { readPiHistory, appendPiHistory, archivePiRecord, PiHistoryRecord } from "@/lib/piStore";
import { logger } from "@/lib/logger";
import { writableDir } from "@/lib/paths";

const OUTPUT_DIR = path.join(writableDir("output"), "pi");

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const {
      buyerName,
      deliveryAddress,
      placeOfSupply = "Delhi",
      transporter,
      destination,
      contactPerson,
      contactNumber,
      date,
      items,
      piSeq,
      preview = false,
      confirmRegenerate = false,
    } = payload;

    logger.gen(`[API/generate/pi] Received request for: "${buyerName || "Unknown"}" (preview: ${preview}, confirmRegenerate: ${confirmRegenerate})`);

    // 1. Validations
    if (!buyerName || !buyerName.trim()) {
      return NextResponse.json({ error: "Buyer Name is required." }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: "Proforma Date is required." }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one line item is required." }, { status: 400 });
    }
    if (items.length > 4) {
      return NextResponse.json({ error: "A maximum of 4 line items is supported." }, { status: 400 });
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.description || !it.description.trim()) {
        return NextResponse.json({ error: `Item #${i + 1} Description is required.` }, { status: 400 });
      }
      if (it.quantity === undefined || Number(it.quantity) <= 0) {
        return NextResponse.json({ error: `Item #${i + 1} Number of Months must be greater than 0.` }, { status: 400 });
      }
      if (it.amount === undefined || Number(it.amount) < 0) {
        return NextResponse.json({ error: `Item #${i + 1} Amount cannot be negative.` }, { status: 400 });
      }
      if (it.billingMode === 'sku' && (it.sku === undefined || Number(it.sku) <= 0)) {
        return NextResponse.json({ error: `Item #${i + 1} SKUs must be greater than 0 in SKU mode.` }, { status: 400 });
      }
      if (it.commission === undefined || Number(it.commission) < 0) {
        return NextResponse.json({ error: `Item #${i + 1} Commission % cannot be negative.` }, { status: 400 });
      }
      if (it.gstPct === undefined || Number(it.gstPct) < 0) {
        return NextResponse.json({ error: `Item #${i + 1} GST Rate (%) cannot be negative.` }, { status: 400 });
      }
    }

    // 2. Determine PI Number and Regeneration Flow
    let contractNo = "";
    let isRegeneration = false;

    if (preview) {
      contractNo = "BCPL/NO/PREVIEW";
    } else if (piSeq !== undefined && piSeq !== null && piSeq !== "") {
      const manualNum = Number(piSeq);
      if (isNaN(manualNum) || manualNum <= 0 || !Number.isInteger(manualNum)) {
        return NextResponse.json({ error: "Proforma Invoice Number must be a positive integer." }, { status: 400 });
      }

      const targetNo = `BCPL/NO/${manualNum}`;
      const history = readPiHistory();
      const existingActive = history.find(
        (r) => (r.status === 'active' || !r.status) && (r.piNumber === targetNo || r.originalPiNumber === targetNo)
      );

      if (existingActive) {
        if (!confirmRegenerate) {
          return NextResponse.json({
            requiresConfirmation: true,
            existingRecord: {
              piNumber: existingActive.piNumber,
              buyerName: existingActive.buyerName,
              grandTotal: existingActive.grandTotal,
              date: existingActive.date,
            },
          });
        }

        logger.gen(`[API/generate/pi] Regeneration confirmed for existing ${targetNo}. Archiving old version...`);
        archivePiRecord(targetNo);
        contractNo = targetNo;
        isRegeneration = true;
      } else {
        const nextSuggested = peekNextPiNumber();
        if (manualNum === nextSuggested) {
          contractNo = nextContractNumber("PI");
        } else if (manualNum > nextSuggested - 1) {
          contractNo = commitPiNumber(manualNum);
        } else {
          contractNo = targetNo;
        }
      }
    } else {
      contractNo = nextContractNumber("PI");
    }

    logger.gen(`[API/generate/pi] Resolved sequence: ${contractNo} (Regeneration: ${isRegeneration})`);

    // 3. Generate XLSX -> PDF
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const result = await generatePiWorkbook({
      piNumber: contractNo,
      date,
      buyerName: buyerName.trim(),
      deliveryAddress: deliveryAddress?.trim(),
      placeOfSupply: placeOfSupply.trim(),
      transporter: transporter?.trim(),
      destination: destination?.trim(),
      contactPerson: contactPerson?.trim(),
      contactNumber: contactNumber?.trim(),
      items: items.map((it) => ({
        description: it.description.trim(),
        billingMode: it.billingMode === 'sku' ? 'sku' : 'month',
        amount: Number(it.amount),
        sku: it.sku !== undefined && it.sku !== null && Number(it.sku) > 0 ? Number(it.sku) : 1,
        commission: Number(it.commission),
        uom: it.uom?.trim() || "NOS",
        quantity: Number(it.quantity),
        gstPct: Number(it.gstPct),
      })),
    });

    const xlsxName = buildFilename(contractNo, buyerName, "xlsx");
    const xlsxPath = path.join(OUTPUT_DIR, xlsxName);
    fs.writeFileSync(xlsxPath, result.xlsxBuffer);
    logger.gen(`[API/generate/pi] Saved XLSX file: ${xlsxName}`);

    let pdfName: string | null = null;
    let message: string | undefined = undefined;

    if (result.pdfBuffer) {
      pdfName = buildFilename(contractNo, buyerName, "pdf");
      const pdfPath = path.join(OUTPUT_DIR, pdfName);
      fs.writeFileSync(pdfPath, result.pdfBuffer);
      logger.gen(`[API/generate/pi] Saved active PDF file: ${pdfName}`);
    } else {
      message = 'PDF conversion available only in local environment.';
      logger.gen(`[API/generate/pi] PDF conversion skipped/unavailable.`);
    }

    // 4. Save to History (Only if NOT a preview)
    if (!preview) {
      let totalTaxable = 0;
      let totalGst = 0;
      items.forEach((it) => {
        const amount = Number(it.amount) || 0;
        const isSkuMode = it.billingMode === 'sku';
        const sku = isSkuMode && Number(it.sku) > 0 ? Number(it.sku) : 1;
        const effectiveRate = isSkuMode ? amount * sku : amount;
        const qty = Number(it.quantity) || 0;
        const gstPct = Number(it.gstPct) || 0;
        const rowGst = effectiveRate * (gstPct / 100);
        const rowTaxable = effectiveRate * qty;
        totalTaxable += rowTaxable;
        totalGst += rowGst;
      });
      const grandTotal = totalTaxable + totalGst;

      const record: PiHistoryRecord = {
        id: `${contractNo}-${Date.now()}`,
        piNumber: contractNo,
        originalPiNumber: contractNo,
        status: "active",
        buyerName: buyerName.trim(),
        date,
        grandTotal,
        pdfFile: pdfName || xlsxName,
        generatedAt: new Date().toISOString(),
        deliveryAddress: deliveryAddress?.trim(),
        placeOfSupply: placeOfSupply.trim(),
      };

      appendPiHistory(record);
      logger.gen(`[API/generate/pi] Appended new active history record for ${contractNo}`);
    }

    return NextResponse.json({
      success: true,
      contractNo,
      xlsxName,
      pdfName,
      isRegeneration,
      message,
    });

  } catch (e: any) {
    const errMsg = e.message || String(e);
    logger.error(`[API/generate/pi] Generation failed: ${errMsg}`);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
