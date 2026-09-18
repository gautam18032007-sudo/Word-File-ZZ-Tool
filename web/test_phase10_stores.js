/**
 * Comprehensive Automated Verification Suite for Phase 10:
 * Dynamic Store Master & Future Store Scalability
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
  STORE_MASTER,
  normalizeDateToIso,
  getApplicableStores,
  getStoreByCode,
  isStoreApplicable,
  getAllStoreCodes,
} = require('./lib/storeMaster');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('PHASE 10: STORE MASTER DETERMINISTIC TEST SUITE');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// Test Group 1: Store Master Setup & Existing Stores
// -----------------------------------------------------------------------------
console.log('Test Group 1: Store Master Setup & Existing Stores');

it('Store Master has exactly 4 stores including Club 125', () => {
  assert.strictEqual(STORE_MASTER.length, 4);
  const codes = STORE_MASTER.map(s => s.storeCode);
  assert(codes.includes('SWN'), 'Should include SWN');
  assert(codes.includes('KLJ'), 'Should include KLJ');
  assert(codes.includes('HQ27'), 'Should include HQ27');
  assert(codes.includes('CLUB125'), 'Should include CLUB125');
});

it('Club 125 has correct metadata and is active', () => {
  const club = getStoreByCode('CLUB125');
  assert(club, 'CLUB125 must exist in Store Master');
  assert.strictEqual(club.storeName, 'Club 125');
  assert.strictEqual(club.active, true);
  assert(club.openingDate <= '2026-09-18', 'Club 125 should be open');
});

it('getStoreByCode is case-insensitive and matches storeCode or storeName', () => {
  assert.strictEqual(getStoreByCode('swn')?.storeCode, 'SWN');
  assert.strictEqual(getStoreByCode('club125')?.storeCode, 'CLUB125');
  assert.strictEqual(getStoreByCode('Club 125')?.storeCode, 'CLUB125');
  assert.strictEqual(getStoreByCode('Smartworks Noida')?.storeCode, 'SWN');
});

// -----------------------------------------------------------------------------
// Test Group 2: Date Normalization
// -----------------------------------------------------------------------------
console.log('\nTest Group 2: Date Normalization');

it('Normalizes YYYY-MM-DD correctly', () => {
  assert.strictEqual(normalizeDateToIso('2026-07-15'), '2026-07-15');
});

it('Normalizes DD.MM.YYYY and DD-MM-YYYY correctly', () => {
  assert.strictEqual(normalizeDateToIso('15.07.2026'), '2026-07-15');
  assert.strictEqual(normalizeDateToIso('09-08-2025'), '2025-08-09');
});

it('Normalizes JavaScript Date objects in IST timezone', () => {
  const d = new Date('2026-11-05T00:00:00Z');
  const iso = normalizeDateToIso(d);
  assert(iso.startsWith('2026-11-05'), `Expected 2026-11-05, got ${iso}`);
});

it('Falls back to today when null/undefined/empty is passed', () => {
  const isoNull = normalizeDateToIso(null);
  const isoEmpty = normalizeDateToIso('');
  assert.match(isoNull, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(isoEmpty, /^\d{4}-\d{2}-\d{2}$/);
});

// -----------------------------------------------------------------------------
// Test Group 3: Future Store Test Scenario (Phase 6 Specs)
// -----------------------------------------------------------------------------
console.log('\nTest Group 3: Future Store Test Scenario (Phase 6 Specs)');

const mockMaster = [
  { storeCode: 'A', storeName: 'Store A', openingDate: '2025-01-01', active: true },
  { storeCode: 'B', storeName: 'Store B', openingDate: '2025-01-01', active: true },
  { storeCode: 'C', storeName: 'Store C', openingDate: '2025-01-01', active: true },
  { storeCode: 'D', storeName: 'Store D', openingDate: '2026-10-01', active: true },
  { storeCode: 'E', storeName: 'Store E', openingDate: '2026-12-01', active: true },
];

it('Document date BEFORE Store D opens: only A, B, C appear', () => {
  const stores = getApplicableStores('2026-09-30', mockMaster).map(s => s.storeCode);
  assert.deepStrictEqual(stores, ['A', 'B', 'C']);
  assert(!isStoreApplicable('D', '2026-09-30', mockMaster), 'Store D must not be applicable');
});

it('Document date ON Store D opening date: A, B, C, D appear', () => {
  const stores = getApplicableStores('2026-10-01', mockMaster).map(s => s.storeCode);
  assert.deepStrictEqual(stores, ['A', 'B', 'C', 'D']);
  assert(isStoreApplicable('D', '2026-10-01', mockMaster), 'Store D must be applicable');
});

it('Document date AFTER Store D opens (between D and E): A, B, C, D appear, E excluded', () => {
  const stores = getApplicableStores('2026-11-15', mockMaster).map(s => s.storeCode);
  assert.deepStrictEqual(stores, ['A', 'B', 'C', 'D']);
  assert(isStoreApplicable('D', '2026-11-15', mockMaster), 'Store D must be applicable');
  assert(!isStoreApplicable('E', '2026-11-15', mockMaster), 'Store E must not be applicable');
});

it('Document date ON Store E opening date: A, B, C, D, E appear', () => {
  const stores = getApplicableStores('2026-12-01', mockMaster).map(s => s.storeCode);
  assert.deepStrictEqual(stores, ['A', 'B', 'C', 'D', 'E']);
});

it('Document date AFTER Store E opens: A, B, C, D, E appear', () => {
  const stores = getApplicableStores('2027-01-01', mockMaster).map(s => s.storeCode);
  assert.deepStrictEqual(stores, ['A', 'B', 'C', 'D', 'E']);
});

// -----------------------------------------------------------------------------
// Test Group 4: Edge Cases
// -----------------------------------------------------------------------------
console.log('\nTest Group 4: Edge Cases');

const edgeMaster = [
  { storeCode: 'OPEN', storeName: 'Open Store', openingDate: '2025-01-01', active: true },
  { storeCode: 'INACTIVE', storeName: 'Inactive Store', openingDate: '2024-01-01', active: false },
  { storeCode: 'FUTURE', storeName: 'Future Store', openingDate: '2026-06-15', active: true },
  { storeCode: 'CLOSED', storeName: 'Closed Store', openingDate: '2024-01-01', closingDate: '2025-12-31', active: true },
];

it('Inactive store is excluded even when document date is after openingDate', () => {
  const stores = getApplicableStores('2026-01-01', edgeMaster).map(s => s.storeCode);
  assert(!stores.includes('INACTIVE'), 'Inactive store must not appear');
});

it('Closed store is excluded after its closingDate', () => {
  const storesBefore = getApplicableStores('2025-06-01', edgeMaster).map(s => s.storeCode);
  assert(storesBefore.includes('CLOSED'), 'Closed store should appear before closing date');

  const storesAfter = getApplicableStores('2026-01-01', edgeMaster).map(s => s.storeCode);
  assert(!storesAfter.includes('CLOSED'), 'Closed store must not appear after closing date');
});

it('Exact 1 day before opening: excluded', () => {
  assert(!isStoreApplicable('FUTURE', '2026-06-14', edgeMaster));
});

it('Exact opening day: included', () => {
  assert(isStoreApplicable('FUTURE', '2026-06-15', edgeMaster));
});

it('Exact 1 day after opening: included', () => {
  assert(isStoreApplicable('FUTURE', '2026-06-16', edgeMaster));
});

// -----------------------------------------------------------------------------
// Test Group 5: Brand Contract Generation with Club 125
// -----------------------------------------------------------------------------
console.log('\nTest Group 5: Brand Contract Generation with Club 125');

const { renderDocx } = require('./lib/template');

it('Generates valid Brand DOCX with Club 125 included in 4 setups', () => {
  const allButLast = "An advance fixed fee of ₹ 5,000 per month for the SWN setup, ₹ 6,000 per month for the KLJ setup, ₹ 7,000 per month for the HQ27 setup";
  const feeClause = `${allButLast}, and ₹ 8,000 per month for the CLUB125 setup, payable for a period of 3 months, amounting to a total of ₹ 78,000 (exclusive of GST); and`;

  const commAllButLast = "A commission of 15% on the sale price of each product sold through the SWN setup, 15% on the sale price of each product sold through the KLJ setup, 12% on the sale price of each product sold through the HQ27 setup";
  const commClause = `${commAllButLast}, and 10% on the sale price of each product sold through the CLUB125 setup, as disclosed in the Proforma Invoice (PI).`;

  const data = {
    LEGAL_NAME: 'Acme Lifestyle Brands Pvt Ltd',
    BRAND_CATEGORY: 'Fashion & Apparel',
    ADDRESS: 'Plot 12, Sector 62, Noida, UP 201301',
    EMAIL: '',
    PHONE: '',
    CONTACT_PERSON: '',
    STAMPING_DATE: '18.09.2026',
    EFFECTIVE_DATE: '18.09.2026',
    LOCATION: 'SWN, KLJ, HQ27 and CLUB125 setups',
    FEE_CLAUSE: feeClause,
    COMMISSION_CLAUSE: commClause,
    PAYMENT_METHOD: '',
  };

  const docxBytes = renderDocx('brand-contract-template.docx', data);
  assert(Buffer.isBuffer(docxBytes), 'Must return a Buffer');
  assert(docxBytes.length > 50000, 'DOCX file must be non-empty');

  // Verify that document.xml contains the expected party name and Club 125
  const PizZip = require('pizzip');
  const zip = new PizZip(docxBytes);
  const xml = zip.file('word/document.xml').asText();
  assert(xml.includes('Acme Lifestyle Brands Pvt Ltd'), 'Document must contain party name');
  assert(xml.includes('CLUB125'), 'Document must contain CLUB125 setup');
});

// -----------------------------------------------------------------------------
// Test Group 6: PI Workbook Generation with Club 125
// -----------------------------------------------------------------------------
console.log('\nTest Group 6: PI Workbook Generation with Club 125');

const { generatePiWorkbook } = require('./lib/piGenerator');
const ExcelJS = require('exceljs');

async function runPiTest() {
  const piInput = {
    piNumber: 'BCPL/NO/TEST-CLUB125',
    date: '2026-09-18',
    buyerName: 'Acme Lifestyle Brands Pvt Ltd',
    deliveryAddress: 'Noida Hub',
    placeOfSupply: 'Delhi',
    items: [
      {
        description: 'Service Charge for advertisement of Products - Club 125',
        billingMode: 'month',
        amount: 8000,
        sku: 1,
        commission: 10,
        uom: 'NOS',
        quantity: 2,
        gstPct: 18,
      },
      {
        description: 'Service Charge for advertisement of Products - Smartworks Noida',
        billingMode: 'month',
        amount: 5000,
        sku: 1,
        commission: 15,
        uom: 'NOS',
        quantity: 2,
        gstPct: 18,
      },
    ],
  };

  const { xlsxBuffer } = await generatePiWorkbook(piInput);
  assert(Buffer.isBuffer(xlsxBuffer), 'xlsxBuffer must be a Buffer');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsxBuffer);
  const sheet = wb.getWorksheet(1);
  assert(sheet, 'Sheet 1 must exist');

  // Validate Buyer & Invoice Header
  assert.strictEqual(sheet.getCell('A10').value, 'Acme Lifestyle Brands Pvt Ltd');
  assert.strictEqual(sheet.getCell('H9').value, 'BCPL/NO/TEST-CLUB125');
  assert.strictEqual(sheet.getCell('H10').value, '18.09.2026');

  // Validate Line Items
  assert.strictEqual(sheet.getCell('B25').value, 'Service Charge for advertisement of Products - Club 125');
  assert.strictEqual(sheet.getCell('E25').value, 2); // 2 months
  assert.strictEqual(sheet.getCell('F25').value, 8000);

  assert.strictEqual(sheet.getCell('B26').value, 'Service Charge for advertisement of Products - Smartworks Noida');
  assert.strictEqual(sheet.getCell('E26').value, 2); // 2 months
  assert.strictEqual(sheet.getCell('F26').value, 5000);

  // Unused rows 27 and 28 cleared
  assert.strictEqual(sheet.getCell('B27').value, null);
  assert.strictEqual(sheet.getCell('B28').value, null);

  // Total Taxable: (8000 * 2) + (5000 * 2) = 16000 + 10000 = 26000
  // GST Amount: 26000 * 18% = 4680
  // Grand Total: 30680
  assert.strictEqual(sheet.getCell('C32').value, 26000);
  assert.strictEqual(sheet.getCell('I30').value.result, 30680);
}

runPiTest().then(() => {
  it('PI Workbook loads successfully with Club 125 item calculations', () => {});
  console.log('\n======================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');
  if (failed > 0) process.exit(1);
}).catch((err) => {
  console.error('PI Test failed:', err);
  process.exit(1);
});
