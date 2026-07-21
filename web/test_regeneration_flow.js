const fs = require('fs');
const path = require('path');

const sequencePath = path.resolve(__dirname, '..', 'output', 'sequence.json');
const piOutputDir = path.resolve(__dirname, '..', 'output', 'pi');

function readSequenceValue() {
  if (!fs.existsSync(sequencePath)) return 'File not found';
  const content = fs.readFileSync(sequencePath, 'utf-8');
  try {
    const parsed = JSON.parse(content);
    return parsed.PI ? parsed.PI.all : 'PI counter not found';
  } catch (e) {
    return 'Invalid JSON';
  }
}

async function runRegenerationTest() {
  console.log("=== STARTING PI REGENERATION FLOW VERIFICATION TEST ===\n");

  const initialCounter = readSequenceValue();
  console.log(`[Initial State] Sequence counter 'PI' value: ${initialCounter}`);

  // Step 1: Generate initial (wrong) BCPL/NO/112 invoice
  console.log("\nStep 1: Generating initial (wrong) BCPL/NO/112 invoice...");
  const wrongPayload = {
    buyerName: "Elamra Enterprises (Wrong Initial)",
    date: "2026-07-21",
    piSeq: 112,
    preview: false,
    items: [
      {
        description: "Service Charge for advertisement of Products - KLJ Noida One",
        amount: 2000,
        commission: 10,
        quantity: 1,
        gstPct: 18
      },
      {
        description: "Service Charge for advertisement of Products - Smartworks Noida",
        amount: 2000,
        commission: 10,
        quantity: 1,
        gstPct: 18
      }
    ]
  };

  const res1 = await fetch("http://localhost:3000/api/generate/pi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(wrongPayload)
  });

  const data1 = await res1.json();
  console.log("Step 1 Response:", data1);

  // Step 2: Attempt resubmission without confirmRegenerate -> Should ask for confirmation
  console.log("\nStep 2: Submitting corrected BCPL/NO/112 without confirmation flag...");
  const correctPayload = {
    buyerName: "Elamra Enterprises (Corrected)",
    date: "2026-07-21",
    piSeq: 112,
    preview: false,
    items: [
      {
        description: "Service Charge for advertisement of Products - KLJ Noida One",
        amount: 5000,
        commission: 20,
        quantity: 3,
        gstPct: 18
      },
      {
        description: "Service Charge for advertisement of Products - Smartworks Noida",
        amount: 5000,
        commission: 20,
        quantity: 3,
        gstPct: 18
      }
    ]
  };

  const res2 = await fetch("http://localhost:3000/api/generate/pi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(correctPayload)
  });

  const data2 = await res2.json();
  console.log("Step 2 Pre-check Response (requiresConfirmation?):", data2.requiresConfirmation, data2.existingRecord);

  // Step 3: Resubmit with confirmRegenerate = true
  console.log("\nStep 3: Resubmitting corrected BCPL/NO/112 with confirmRegenerate = true...");
  const res3 = await fetch("http://localhost:3000/api/generate/pi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...correctPayload, confirmRegenerate: true })
  });

  const data3 = await res3.json();
  console.log("Step 3 Success Response:", data3);

  // Step 4: Verify History and disk files
  console.log("\nStep 4: Verifying History Store and Files on Disk...");
  const historyRes = await fetch("http://localhost:3000/api/pi/history");
  const history = await historyRes.json();

  const active112 = history.find(r => r.piNumber === "BCPL/NO/112" && r.status === "active");
  const archived112 = history.find(r => r.piNumber.includes("Old/Wrong") && r.status === "archived");

  console.log("\n=== REGENERATION VERIFICATION RESULTS ===");
  console.log("1. Active 112 Record Found:", !!active112, active112 ? `Buyer: "${active112.buyerName}", Total: ₹${active112.grandTotal}` : "");
  console.log("2. Archived 112 Record Found:", !!archived112, archived112 ? `Label: "${archived112.piNumber}", Buyer: "${archived112.buyerName}"` : "");

  let oldPdfExists = false;
  let newPdfExists = false;

  if (archived112 && archived112.pdfFile) {
    oldPdfExists = fs.existsSync(path.join(piOutputDir, archived112.pdfFile));
  }
  if (active112 && active112.pdfFile) {
    newPdfExists = fs.existsSync(path.join(piOutputDir, active112.pdfFile));
  }

  console.log(`3. Old (Archived) PDF file exists on disk: ${oldPdfExists} (${archived112?.pdfFile})`);
  console.log(`4. New (Active) PDF file exists on disk: ${newPdfExists} (${active112?.pdfFile})`);

  const finalCounter = readSequenceValue();
  console.log(`5. Final Sequence counter 'PI' value: ${finalCounter}`);
  console.log(`6. Sequence Counter Unchanged: ${initialCounter === finalCounter}`);

  const allPass = active112 && archived112 && oldPdfExists && newPdfExists && (initialCounter === finalCounter);
  console.log(`\nOVERALL TEST RESULT: ${allPass ? "ALL PASS" : "SOME FAILS"}`);
}

runRegenerationTest().catch(console.error);
