async function runTest() {
  console.log("=== RUNNING ELAMRA INVOICE MATH VERIFICATION TEST ===");

  const payload = {
    buyerName: "Elamra Enterprises",
    deliveryAddress: "123 Delhi Road, Delhi",
    placeOfSupply: "Delhi",
    date: "2026-07-21",
    items: [
      {
        description: "Service Charge for advertisement of Products",
        notes: "INR 30000",
        uom: "NOS",
        quantity: 1,
        rate: 30000,
        gstPct: 18,
      },
    ],
  };

  // Perform local calculations to verify the math
  let totalQuantity = 0;
  let totalTaxableAmount = 0;
  let totalGstAmount = 0;

  payload.items.forEach((it) => {
    const qty = it.quantity;
    const rate = it.rate;
    const gstPct = it.gstPct;
    const taxable = qty * rate;
    const gst = taxable * (gstPct / 100);

    totalQuantity += qty;
    totalTaxableAmount += taxable;
    totalGstAmount += gst;
  });

  const grandTotal = totalTaxableAmount + totalGstAmount;

  console.log("Local Calculations:");
  console.log(`- Total Quantity: ${totalQuantity}`);
  console.log(`- Taxable Amount: ${totalTaxableAmount.toFixed(2)}`);
  console.log(`- GST Amount (18%): ${totalGstAmount.toFixed(2)}`);
  console.log(`- Grand Total: ${grandTotal.toFixed(2)}`);

  const expectedGrandTotal = 35400.00;
  if (Math.abs(grandTotal - expectedGrandTotal) < 0.001) {
    console.log("SUCCESS: Local math matches Elamra reference (35,400.00) perfectly!");
  } else {
    console.error(`FAILURE: Local math expected ${expectedGrandTotal}, got ${grandTotal}`);
    process.exit(1);
  }

  // Verify by calling the API endpoint
  console.log("\nCalling generate/pi API on dev server...");
  try {
    const response = await fetch("http://localhost:3000/api/generate/pi", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "API request failed");
    }

    console.log("API Success Response:", data);
    console.log(`SUCCESS: Proforma Invoice generated with sequence: ${data.contractNo}`);
    console.log(`SUCCESS: Output PDF saved as: ${data.pdfName}`);
  } catch (err) {
    console.error("FAILURE: API request crashed:", err.message || String(err));
    process.exit(1);
  }
}

runTest();
