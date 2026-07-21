const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sequencePath = path.resolve(__dirname, '..', 'output', 'sequence.json');

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

async function runPartEVerification() {
  console.log("=== STARTING PART D & PART E VERIFICATION TEST (PREVIEW MODE) ===\n");

  const initialCounter = readSequenceValue();
  console.log(`[Before Test] Real Sequence counter 'PI' value: ${initialCounter}`);

  const payload = {
    buyerName: "Part E SKU Test Buyer",
    date: "2026-07-21",
    preview: true,
    items: [
      {
        description: "Service Charge for advertisement of Products - KLJ Noida One",
        amount: 1000,
        sku: 5,
        commission: 20,
        quantity: 3,
        gstPct: 18
      },
      {
        description: "Service Charge for advertisement of Products - Smartworks Noida",
        amount: 2000,
        sku: 1,
        commission: 15,
        quantity: 2,
        gstPct: 18
      }
    ]
  };

  const res = await fetch("http://localhost:3000/api/generate/pi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("API Error Response:", data);
    return;
  }

  const finalCounter = readSequenceValue();
  console.log(`[After Test] Real Sequence counter 'PI' value: ${finalCounter}`);
  console.log(`Sequence counter unchanged: ${initialCounter === finalCounter}`);

  const pdfPath = path.resolve(__dirname, '..', 'output', 'pi', data.pdfName);

  const pyPath = path.resolve(process.env.USERPROFILE || 'C:\\Users\\pc', '.gemini', 'antigravity-ide', 'scratch', 'verify_parte.py');
  const out = execSync(`python "${pyPath}" "${pdfPath}"`).toString();
  console.log(out);
}

runPartEVerification().catch(console.error);
