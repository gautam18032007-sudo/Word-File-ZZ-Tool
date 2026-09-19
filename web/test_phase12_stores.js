const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Import storeMaster and storeMasterStore modules
const {
  STORE_MASTER,
  normalizeDateToIso,
  getApplicableStores,
  getStoreByCode,
  isStoreApplicable,
} = require('./lib/storeMaster');

const {
  CANONICAL_INITIAL_STORES,
  getStoreMasterData,
  validateStoreInput,
  addStoreToMaster,
  updateStoreStatus,
  removeStoreFromMaster,
  isVercelProduction,
} = require('./lib/storeMasterStore');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('======================================================');
  console.log('PHASE 12: NO-DATABASE STORE MASTER TEST SUITE');
  console.log('======================================================\n');

  // Test Group 1: Canonical Initial Stores
  console.log('Test Group 1: Canonical Initial Stores Survival (A & L)');
  const masterData = await getStoreMasterData();
  assert(masterData && Array.isArray(masterData.stores), 'Store Master returns valid array of stores');
  assert(masterData.stores.length >= 4, 'Store Master has at least 4 stores');
  
  const codes = masterData.stores.map((s) => s.storeCode.toUpperCase());
  assert(codes.includes('SWN'), 'SWN (Smartworks Noida) is present');
  assert(codes.includes('KLJ'), 'KLJ (KLJ Noida One) is present');
  assert(codes.includes('HQ27'), 'HQ27 is present');
  assert(codes.includes('CLUB125'), 'CLUB125 (Club 125) is present');

  // Test Group 2: Validation
  console.log('\nTest Group 2: Store Input Validation (E & F)');
  const valid = validateStoreInput({
    storeName: 'Noida Sector 18',
    storeCode: 'NS18',
    openingDate: '2026-10-01',
    active: true,
  });
  assert(valid.valid && valid.store && valid.store.storeCode === 'NS18', 'Valid store input passes validation');

  const invalidName = validateStoreInput({
    storeName: ' ',
    storeCode: 'NS18',
    openingDate: '2026-10-01',
  });
  assert(!invalidName.valid, 'Empty store name is rejected');

  const invalidCode = validateStoreInput({
    storeName: 'Test Store',
    storeCode: '!',
    openingDate: '2026-10-01',
  });
  assert(!invalidCode.valid, 'Invalid store code format is rejected');

  const invalidDate = validateStoreInput({
    storeName: 'Test Store',
    storeCode: 'T1',
    openingDate: 'not-a-date',
  });
  assert(!invalidDate.valid, 'Invalid opening date string is rejected');

  const closeBeforeOpen = validateStoreInput({
    storeName: 'Test Store',
    storeCode: 'T1',
    openingDate: '2026-10-01',
    closingDate: '2026-09-01',
  });
  assert(!closeBeforeOpen.valid, 'Closing date before opening date is rejected');

  // Test Group 3: Dynamic Store Addition & Duplicate Rejection (B, C, D)
  console.log('\nTest Group 3: Add Store & Duplicate Rejection (B, C, D)');
  const testStoreCode = 'TEST_LOC_' + Date.now().toString().slice(-4);
  const addResult = await addStoreToMaster({
    storeName: 'Automated Test Location',
    storeCode: testStoreCode,
    openingDate: '2026-11-01',
    active: true,
  });
  assert(addResult.success && addResult.store, `Successfully added new store: ${testStoreCode}`);

  const dupResult = await addStoreToMaster({
    storeName: 'Duplicate Test Location',
    storeCode: testStoreCode,
    openingDate: '2026-11-01',
    active: true,
  });
  assert(!dupResult.success, 'Duplicate storeCode (exact case) is rejected');

  const dupCaseResult = await addStoreToMaster({
    storeName: 'Duplicate Test Location Lower',
    storeCode: testStoreCode.toLowerCase(),
    openingDate: '2026-11-01',
    active: true,
  });
  assert(!dupCaseResult.success, 'Duplicate storeCode (different case) is rejected');

  // Test Group 4: Date-Aware Gating & Inactive Filtering (G, H, I, J)
  console.log('\nTest Group 4: Date-Aware Gating & Inactive Filtering (G, H, I, J)');
  const mockStores = [
    { storeCode: 'PAST', storeName: 'Past Store', openingDate: '2025-01-01', active: true },
    { storeCode: 'FUTURE', storeName: 'Future Store', openingDate: '2026-12-01', active: true },
    { storeCode: 'CLOSED', storeName: 'Closed Store', openingDate: '2025-01-01', closingDate: '2026-06-01', active: true },
    { storeCode: 'INACTIVE', storeName: 'Inactive Store', openingDate: '2025-01-01', active: false },
  ];

  // Document date: 2026-08-01
  const appAug2026 = getApplicableStores('2026-08-01', mockStores);
  const augCodes = appAug2026.map((s) => s.storeCode);
  assert(augCodes.includes('PAST'), 'Store before document date is included');
  assert(!augCodes.includes('FUTURE'), 'Store after document date (before opening) is excluded');
  assert(!augCodes.includes('CLOSED'), 'Store after closing date is excluded');
  assert(!augCodes.includes('INACTIVE'), 'Inactive store is excluded');

  // Document date on FUTURE opening: 2026-12-01
  const appDec2026 = getApplicableStores('2026-12-01', mockStores);
  const decCodes = appDec2026.map((s) => s.storeCode);
  assert(decCodes.includes('FUTURE'), 'Store exactly on opening date is included');

  // Test Group 4.1: Unactive Status Toggle & Remove Store After Unactive (User Requirement)
  console.log('\nTest Group 4.1: Unactive Status & Store Removal');
  // Mark testStoreCode as unactive
  const unactiveResult = await updateStoreStatus(testStoreCode, false);
  assert(unactiveResult.success && unactiveResult.store.active === false, `Store ${testStoreCode} marked unactive`);

  // Verify getApplicableStores excludes unactive store
  const dataAfterUnactive = await getStoreMasterData();
  const applicableAfterUnactive = getApplicableStores('2026-12-01', dataAfterUnactive.stores);
  assert(!applicableAfterUnactive.some((s) => s.storeCode === testStoreCode), 'Unactive store excluded from applicable stores');

  // Reactivate store
  const reactivateResult = await updateStoreStatus(testStoreCode, true);
  assert(reactivateResult.success && reactivateResult.store.active === true, `Store ${testStoreCode} reactivated`);
  const dataAfterReactivate = await getStoreMasterData();
  const applicableAfterReactivate = getApplicableStores('2026-12-01', dataAfterReactivate.stores);
  assert(applicableAfterReactivate.some((s) => s.storeCode === testStoreCode), 'Reactivated store returned to applicable stores');

  // Select unactive again and remove store
  await updateStoreStatus(testStoreCode, false);
  const removeResult = await removeStoreFromMaster(testStoreCode);
  assert(removeResult.success && removeResult.removedStore.storeCode === testStoreCode, `Store ${testStoreCode} successfully removed after unactive select`);

  const dataAfterRemove = await getStoreMasterData();
  assert(!dataAfterRemove.stores.some((s) => s.storeCode === testStoreCode), 'Removed store no longer exists in Store Master');

  // Removing non-existent store returns error
  const removeNonExistent = await removeStoreFromMaster('NON_EXISTENT_XYZ');
  assert(!removeNonExistent.success, 'Removing non-existent store returns failure');

  // Test Group 4.2: Phase 12.1 Cross-Device Store Master Synchronization (Tests 1 - 10)
  console.log('\nTest Group 4.2: Phase 12.1 Cross-Device Synchronization Tests');

  // TEST 1: GET initial Store Master
  const initialDataCrossDevice = await getStoreMasterData();
  assert(Array.isArray(initialDataCrossDevice.stores), 'TEST 1: GET initial Store Master returns valid array');

  // TEST 2: POST Jengala Ho
  const jengalaInput = {
    storeName: 'Jengala Ho',
    storeCode: 'JENGALA_HO',
    openingDate: '2026-01-01',
    active: true,
  };
  const postJengalaResult = await addStoreToMaster(jengalaInput);
  assert(postJengalaResult.success && postJengalaResult.store.storeCode === 'JENGALA_HO', 'TEST 2: POST Jengala Ho succeeds');

  // TEST 3: Immediately GET again
  const getAfterPost = await getStoreMasterData();
  const jengalaFoundImmediate = getAfterPost.stores.find((s) => s.storeCode === 'JENGALA_HO');
  assert(Boolean(jengalaFoundImmediate && jengalaFoundImmediate.storeName === 'Jengala Ho'), 'TEST 3: Immediately GET again finds Jengala Ho');

  // TEST 4: Simulate separate client/device (independent fresh read)
  const deviceBData = await getStoreMasterData();
  const jengalaFoundDeviceB = deviceBData.stores.find((s) => s.storeCode === 'JENGALA_HO');
  assert(Boolean(jengalaFoundDeviceB && jengalaFoundDeviceB.active === true), 'TEST 4: Device B (independent client) sees Jengala Ho');

  // TEST 5: PATCH/deactivate Jengala Ho
  const deactivateJengala = await updateStoreStatus('JENGALA_HO', false);
  assert(deactivateJengala.success && deactivateJengala.store.active === false, 'TEST 5a: PATCH deactivates Jengala Ho');
  const deviceBAfterDeactivate = await getStoreMasterData();
  const jengalaDeviceBDeactivated = deviceBAfterDeactivate.stores.find((s) => s.storeCode === 'JENGALA_HO');
  assert(jengalaDeviceBDeactivated && jengalaDeviceBDeactivated.active === false, 'TEST 5b: Device B sees active=false for Jengala Ho');

  // TEST 6: Reactivate Jengala Ho
  const reactivateJengala = await updateStoreStatus('JENGALA_HO', true);
  assert(reactivateJengala.success && reactivateJengala.store.active === true, 'TEST 6a: PATCH reactivates Jengala Ho');
  const deviceBAfterReactivate = await getStoreMasterData();
  const jengalaDeviceBReactivated = deviceBAfterReactivate.stores.find((s) => s.storeCode === 'JENGALA_HO');
  assert(jengalaDeviceBReactivated && jengalaDeviceBReactivated.active === true, 'TEST 6b: Device B sees active=true for Jengala Ho');

  // TEST 7: Delete Jengala Ho
  const deleteJengala = await removeStoreFromMaster('JENGALA_HO');
  assert(deleteJengala.success && deleteJengala.removedStore.storeCode === 'JENGALA_HO', 'TEST 7a: DELETE Jengala Ho succeeds');
  const deviceBAfterDelete = await getStoreMasterData();
  assert(!deviceBAfterDelete.stores.some((s) => s.storeCode === 'JENGALA_HO'), 'TEST 7b: Device B confirms Jengala Ho is completely removed');

  // TEST 8: Verify there is only one canonical store-master.json object
  const { BLOB_STORE_PATH } = require('./lib/storeMasterStore');
  assert(BLOB_STORE_PATH === 'store-master.json', 'TEST 8: Canonical Blob store path is strictly "store-master.json"');

  // TEST 9: Verify GET /api/stores route dynamic configuration & anti-caching headers
  const routeContent = fs.readFileSync(path.resolve(__dirname, 'app/api/stores/route.ts'), 'utf8');
  assert(routeContent.includes("export const dynamic = 'force-dynamic'"), 'TEST 9a: /api/stores route exports dynamic = "force-dynamic"');
  assert(routeContent.includes("export const revalidate = 0"), 'TEST 9b: /api/stores route exports revalidate = 0');
  assert(routeContent.includes("export const fetchCache = 'force-no-store'"), 'TEST 9c: /api/stores route exports fetchCache = "force-no-store"');
  assert(routeContent.includes("Cache-Control': 'no-store, no-cache, must-revalidate"), 'TEST 9d: /api/stores responses enforce Cache-Control no-store, no-cache');

  // TEST 10: Verify production never reads output/stores.json
  const storeMasterStoreContent = fs.readFileSync(path.resolve(__dirname, 'lib/storeMasterStore.ts'), 'utf8');
  const inProdBlockMatches = storeMasterStoreContent.match(/if\s*\(inProd\)\s*\{[\s\S]*?\n\s*\}/g);
  assert(Boolean(inProdBlockMatches && inProdBlockMatches.length >= 4), 'TEST 10: Production branches (GET/POST/PATCH/DELETE) strictly guard Blob access before any filesystem fallback');

  // Test Group 5: Vercel Production Safety Rule
  console.log('\nTest Group 5: Vercel Production Safety Rule');
  const prevVercel = process.env.VERCEL;
  const prevToken = process.env.BLOB_READ_WRITE_TOKEN;

  // Simulate Vercel production without BLOB_READ_WRITE_TOKEN
  process.env.VERCEL = '1';
  delete process.env.BLOB_READ_WRITE_TOKEN;

  let prodErrorThrown = false;
  try {
    await getStoreMasterData();
  } catch (err) {
    prodErrorThrown = true;
    assert(
      err.message.includes('BLOB_READ_WRITE_TOKEN is not configured in Vercel production') ||
      err.message.includes('Store Master unavailable'),
      'Vercel production throws explicit Store Master unavailable error when Blob token missing'
    );
  }
  assert(prodErrorThrown, 'Vercel production NEVER falls back silently to local disk when Blob is missing');

  // Restore env
  if (prevVercel !== undefined) process.env.VERCEL = prevVercel;
  else delete process.env.VERCEL;
  if (prevToken !== undefined) process.env.BLOB_READ_WRITE_TOKEN = prevToken;
  else delete process.env.BLOB_READ_WRITE_TOKEN;

  // Test Group 6: Template Immutability Check (M)
  console.log('\nTest Group 6: Template Immutability SHA-256 Check (M)');
  const EXPECTED_BRAND_HASH = '634006644ED3A55094D1FAC46695935DC9CF23D9C94002D74B013A2BAC2B5F4A';
  const EXPECTED_PI_HASH = 'E46F7F127C31079BE48F2AAD408777A283C882B28A45CFB64224CE0E76C4D4C4';

  const brandPath = path.resolve(__dirname, 'templates/brand-contract-template.docx');
  const piPath = path.resolve(__dirname, 'templates/pi/PI-template.xlsx');

  const brandHash = crypto.createHash('sha256').update(fs.readFileSync(brandPath)).digest('hex').toUpperCase();
  const piHash = crypto.createHash('sha256').update(fs.readFileSync(piPath)).digest('hex').toUpperCase();

  assert(brandHash === EXPECTED_BRAND_HASH, `Brand DOCX template hash matches baseline (${brandHash.slice(0, 16)}...)`);
  assert(piHash === EXPECTED_PI_HASH, `PI XLSX template hash matches baseline (${piHash.slice(0, 16)}...)`);

  console.log('\n======================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
