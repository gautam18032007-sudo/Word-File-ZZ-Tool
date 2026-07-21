const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sequencePath = path.resolve(__dirname, '..', 'output', 'sequence.json');

function readSequenceValue() {
  if (!fs.existsSync(sequencePath)) {
    return 'File not found';
  }
  const content = fs.readFileSync(sequencePath, 'utf-8');
  try {
    const parsed = JSON.parse(content);
    return parsed.PI ? parsed.PI.all : 'PI counter not found';
  } catch (e) {
    return 'Invalid JSON';
  }
}

async function runPreviewTest() {
  console.log("=== STARTING ELAMRA PREVIEW VERIFICATION TEST ===\n");

  const initialCounter = readSequenceValue();
  console.log(`[Before Test] Sequence counter 'PI' value: ${initialCounter}`);

  const payload = {
    buyerName: "Elamra Enterprises",
    date: "2026-07-21",
    preview: true,
    items: [
      {
        description: "Service Charge for advertisement of Products - KJL Noida One",
        amount: 5000,
        commission: 20,
        quantity: 3,
        gstPct: 18
      },
      {
        description: "Service Charge for advertisement of Products - Smartworks",
        amount: 5000,
        commission: 20,
        quantity: 3,
        gstPct: 18
      }
    ]
  };

  console.log("Calling generate/pi API with preview: true...");
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

  console.log("\nAPI Success Response:", data);
  const finalCounter = readSequenceValue();
  console.log(`[After Test] Sequence counter 'PI' value: ${finalCounter}`);
  
  if (initialCounter === finalCounter) {
    console.log("SUCCESS: Real sequence counter is UNCHANGED after preview generation!\n");
  } else {
    console.error("FAIL: Real sequence counter drifted!\n");
  }

  const pdfPath = path.resolve(__dirname, '..', 'output', 'pi', data.pdfName);
  console.log(`PDF saved at: ${pdfPath}`);
  
  // Create a quick python command to dump PDF text runs for validation
  console.log("\nReading generated PDF text content for validation...");
  const inspectPy = `
import pypdf
reader = pypdf.PdfReader(r"${pdfPath}")
text = reader.pages[0].extract_text()
print("Contains '35,400.00':", "35,400.00" in text)
print("Contains 'INR 5000 +':", "INR 5000 +" in text)
print("Contains '20% commission':", "20% commission" in text)
`;
  
  const pyPath = path.resolve(process.env.USERPROFILE || 'C:\\Users\\pc', '.gemini', 'antigravity-ide', 'scratch', 'inspect_preview_pdf.py');
  fs.writeFileSync(pyPath, inspectPy);
  
  const inspectOut = execSync(`python "${pyPath}"`).toString();
  console.log(inspectOut);
}

runPreviewTest().catch(console.error);
