const fs = require('fs');
const path = require('path');

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

async function runTests() {
  console.log("=== STARTING SEQUENCE OVERRIDE E2E TESTS ===\n");
  
  // Step 0: Initial State
  const initialValue = readSequenceValue();
  console.log(`Initial 'PI' counter value in sequence.json: ${initialValue}`);

  // Fetch the next suggested number via the API
  let nextRes = await fetch("http://localhost:3000/api/pi/next-number");
  let nextData = await nextRes.json();
  const suggestedNumber = nextData.nextNumber;
  console.log(`Suggested next number from API: ${suggestedNumber}\n`);

  // (a) Test A: Generate with the auto-suggested number
  console.log(`(a) Generating with auto-suggested number: ${suggestedNumber}...`);
  let resA = await fetch("http://localhost:3000/api/generate/pi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buyerName: "Sequence Test A",
      date: "2026-07-21",
      piSeq: suggestedNumber,
      items: [{ description: "Test Item A", uom: "NOS", quantity: 1, rate: 100, gstPct: 18 }]
    })
  });
  let dataA = await resA.json();
  if (!resA.ok) {
    console.error("Test A Failed:", dataA);
    return;
  }
  console.log("Generated:", dataA.contractNo);
  console.log(`'PI' counter value in sequence.json after Test A: ${readSequenceValue()}\n`);

  // (b) Test B: Generate with a manually-typed HIGHER number
  const higherNumber = Number(readSequenceValue()) + 5;
  console.log(`(b) Generating with manual HIGHER number: ${higherNumber}...`);
  let resB = await fetch("http://localhost:3000/api/generate/pi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buyerName: "Sequence Test B",
      date: "2026-07-21",
      piSeq: higherNumber,
      items: [{ description: "Test Item B", uom: "NOS", quantity: 1, rate: 100, gstPct: 18 }]
    })
  });
  let dataB = await resB.json();
  if (!resB.ok) {
    console.error("Test B Failed:", dataB);
    return;
  }
  console.log("Generated:", dataB.contractNo);
  console.log(`'PI' counter value in sequence.json after Test B: ${readSequenceValue()}\n`);

  // (c) Test C: Generate with a manually-typed LOWER number
  const currentCounter = Number(readSequenceValue());
  const lowerNumber = currentCounter - 3;
  console.log(`(c) Generating with manual LOWER number: ${lowerNumber}...`);
  let resC = await fetch("http://localhost:3000/api/generate/pi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      buyerName: "Sequence Test C",
      date: "2026-07-21",
      piSeq: lowerNumber,
      items: [{ description: "Test Item C", uom: "NOS", quantity: 1, rate: 100, gstPct: 18 }]
    })
  });
  let dataC = await resC.json();
  if (!resC.ok) {
    console.error("Test C Failed:", dataC);
    return;
  }
  console.log("Generated:", dataC.contractNo);
  console.log(`'PI' counter value in sequence.json after Test C (expected to remain unchanged at ${currentCounter}): ${readSequenceValue()}\n`);
  
  console.log("=== TESTS COMPLETED SUCCESSFULLY ===");
}

runTests().catch(console.error);
