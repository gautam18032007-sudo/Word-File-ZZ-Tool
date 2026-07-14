# LOR Final Coding Checklist

**Phase**: 3 → 4 Gate  
**Scope**: Every item that must be verified BEFORE coding begins, organized by sub-phase  
**Date**: 2026-07-15  
**Status**: Planning gate — no code written

---

## Gate Rule

> [!CAUTION]
> Do NOT begin any sub-phase until ALL items in that sub-phase's gate section are ✅.
> Complete each sub-phase fully before starting the next.
> Run `npm run build` after every sub-phase. A failing build is a hard stop.

---

## Pre-Phase Gate (Must Be True Before Any Code)

### Environment
- [ ] `GOOGLE_LOR_SHEET_ID` added to `.env` with real value (not placeholder)
- [ ] `GOOGLE_LOR_SHEET_GID` added to `.env` with real value (not placeholder)
- [ ] `GEMINI_API_KEY` added to `.env` — obtained from [Google AI Studio](https://aistudio.google.com/apikey)
- [ ] `LIBREOFFICE_PATH` confirmed correct in `.env` (existing — no change needed)
- [ ] `CONTRACT_PREFIX` confirmed as `ZZ` in `.env` (existing — no change needed)

### Google Sheet
- [ ] LOR Google Form created with all 13 required fields (see `08_LOR_PRE_CODING_CHECKLIST.md` §2)
- [ ] Form responses appear in a linked Google Spreadsheet
- [ ] Sheet shared as "Anyone with the link — Viewer" (public)
- [ ] At least 1 test submission present in the sheet
- [ ] Sheet ID matches `GOOGLE_LOR_SHEET_ID` in `.env`

### Dependencies
- [ ] `npm install docxtemplater @google/generative-ai` has been run in `web/`
- [ ] `docxtemplater` appears in `web/package.json` dependencies
- [ ] `@google/generative-ai` appears in `web/package.json` dependencies
- [ ] `npm run build` passes after dependency install (zero TypeScript errors)

### DOCX Template (Correction #5 — Template Versioning)
- [ ] `web/templates/lor/` directory created
- [ ] `lor-v1.docx` created in Microsoft Word or LibreOffice Writer
- [ ] Company letterhead / ZenZebra branding present in document header
- [ ] All 8 placeholder tags inserted with exact spelling (no spaces inside braces):
  - [ ] `{{NAME}}`
  - [ ] `{{DESIGNATION}}`
  - [ ] `{{DEPARTMENT}}`
  - [ ] `{{JOINING_DATE}}`
  - [ ] `{{LAST_WORKING_DATE}}`
  - [ ] `{{AI_LOR_CONTENT}}`
  - [ ] `{{SIGNATORY_NAME}}`
  - [ ] `{{SIGNATORY_ROLE}}`
- [ ] File opens correctly in Word/LibreOffice with no corruption
- [ ] File is `.docx` format (not `.doc` or `.odt`)

### Template Registry (Correction #5)
- [ ] `web/templates/lor/templates.json` created with initial registry:
  ```json
  [
    {
      "id": "LOR_V1",
      "name": "Standard LOR",
      "file": "lor-v1.docx",
      "active": true
    }
  ]
  ```

### Baseline Verification
- [ ] `npm run build` passes (zero errors) — this is the pre-LOR baseline
- [ ] Dev server starts: `npm run dev`
- [ ] Dashboard loads at `http://localhost:3000`
- [ ] `/brand` page loads — no errors
- [ ] `/employee` page loads — no errors
- [ ] `/certificate` page loads — no errors
- [ ] `/lor` stub page loads with "Coming Soon" message
- [ ] Record the current `sequence.json` counter values as baseline:
  ```text
  BRAND: ___
  EMP:   ___
  CERT:  ___
  LOR:   (not present yet — confirm)
  ```

**Pre-Phase Gate Status: ❌ NOT READY** (pending environment and template setup)

---

## Phase 4A Gate: Storage + Numbering

### Files to create/modify:
1. `web/lib/lorStore.ts` — NEW
2. `web/lib/contractNumber.ts` — MODIFY (one line: add `'LOR'` to type union)

### Checklist before starting Phase 4A:
- [ ] Pre-Phase Gate is fully ✅
- [ ] You have read `certStore.ts` as the pattern reference for `lorStore.ts`
- [ ] You have read the updated `04_LOR_STORAGE_ARCHITECTURE.md` (includes AI draft fields)

### Checklist after completing Phase 4A:
- [ ] `lorStore.ts` compiles without TypeScript errors
- [ ] `LorHistoryRecord` interface includes all fields from `04_LOR_STORAGE_ARCHITECTURE.md` schema (including `draftGeneratedByAI`, `aiDraft`, `finalDraft`, `edited`)
- [ ] `readLorHistory()` returns `[]` when `lor-history.json` does not exist
- [ ] `appendLorHistory()` creates `lor-history.json` if it does not exist
- [ ] `contractNumber.ts` type union now reads: `'BRAND' | 'EMP' | 'CERT' | 'LOR'`
- [ ] `npm run build` passes after Phase 4A
- [ ] Existing Brand/Employee/Certificate builds unaffected (no new errors)

### Regression check for Phase 4A:
- [ ] `nextContractNumber('BRAND')` still compiles — ✅ (type union is additive)
- [ ] `nextContractNumber('EMP')` still compiles — ✅ (type union is additive)
- [ ] `nextContractNumber('CERT')` still compiles — ✅ (type union is additive)

---

## Phase 4B Gate: Sheet Loader

### Files to create:
1. `web/app/api/sheets/lor/route.ts` — NEW (standalone, does NOT import `sheets.ts`)

### Checklist before starting Phase 4B:
- [ ] Phase 4A Gate is fully ✅
- [ ] Google Sheet is publicly accessible (test by opening the CSV export URL in a browser)
- [ ] You have read `03_LOR_API_BLUEPRINT.md` §API 1 for exact request/response schema

### Checklist after completing Phase 4B:
- [ ] `npm run build` passes
- [ ] `GET /api/sheets/lor` returns `{ headers: [...], rows: [...] }` for a valid sheet
- [ ] `GET /api/sheets/lor` returns 400 when no sheet URL and no env var
- [ ] `GET /api/sheets/lor` returns 401-level error when sheet is not public
- [ ] Existing `/api/sheets/brand` and `/api/sheets/employee` still respond correctly

---

## Phase 4C Gate: Gemini Draft API

### Files to create:
1. `web/app/api/generate/lor/draft/route.ts` — NEW

### Checklist before starting Phase 4C:
- [ ] Phase 4B Gate is fully ✅
- [ ] `GEMINI_API_KEY` is valid — test at [aistudio.google.com](https://aistudio.google.com/)
- [ ] `@google/generative-ai` is confirmed in `node_modules`
- [ ] You have read `03_LOR_API_BLUEPRINT.md` §API 2 for validation rules and AI config
- [ ] You have read `05_LOR_AI_GENERATION_FLOW.md` §Stage 4b (AI Failure Fallback)

### Checklist after completing Phase 4C:
- [ ] `npm run build` passes
- [ ] `POST /api/generate/lor/draft` with valid payload returns `{ draft: "..." }` (150+ words, professional)
- [ ] `POST /api/generate/lor/draft` with missing `responsibilities` returns 400
- [ ] `POST /api/generate/lor/draft` with `GEMINI_API_KEY` removed from env returns 500 with clear message
- [ ] AI draft does NOT contain `**bold**`, `# headings`, or `* bullets` (markdown stripped)
- [ ] AI draft is in third person ("the candidate", "they")
- [ ] Name, email, phone, dates were NOT sent to Gemini (verify prompt builder)

---

## Phase 4D Gate: DOCX/PDF Engine

### Files to create:
1. `web/lib/lorGenerator.ts` — NEW
2. `web/app/api/generate/lor/route.ts` — NEW
3. `web/app/api/lor/history/route.ts` — NEW

### Checklist before starting Phase 4D:
- [ ] Phase 4C Gate is fully ✅
- [ ] `lor-v1.docx` template has been verified to open correctly (pre-phase gate)
- [ ] You have read `03_LOR_API_BLUEPRINT.md` §API 3 (generate) and §API 6 (history)
- [ ] You have read `05_LOR_AI_GENERATION_FLOW.md` §Stage 6 (DOCX Generation)
- [ ] You have read `06_LOR_BUILD_RISK_ANALYSIS.md` §DX-3 (linebreaks: true is required)

### Checklist after completing Phase 4D:
- [ ] `npm run build` passes
- [ ] `POST /api/generate/lor` with valid payload creates `.docx` file in `output/lors/`
- [ ] Filename follows convention: `ZZ-LOR-2026-XXXX_NAME_SLUG.docx`
- [ ] All 8 placeholders are replaced in the DOCX (open file to verify)
- [ ] Dates are formatted as ordinals: `15th June, 2026` (not `2026-06-15`)
- [ ] `{{AI_LOR_CONTENT}}` renders multi-paragraph (not a single block — `linebreaks: true` set)
- [ ] PDF generated in `output/lors/` (if LibreOffice is configured)
- [ ] `output/lor-history.json` created with one record after first generation
- [ ] `output/sequence.json` has `LOR` key with value `1`
- [ ] Sequence counter verification: BRAND, EMP, CERT counters are unchanged from baseline

### Sequence Collision Verification (mandatory):
Run a Brand contract generation, then check `sequence.json`:
- [ ] `BRAND` counter incremented by exactly 1 — ✅ (not affected by LOR)
- [ ] `LOR` counter unchanged — ✅ (only increments on LOR generation)

### AI draft storage verification:
Open `lor-history.json` and confirm the record has:
- [ ] `draftGeneratedByAI: true` (when AI was used) or `false` (when manual)
- [ ] `aiDraft`: the raw Gemini text (or `null` if AI was skipped)
- [ ] `finalDraft`: the text that was submitted to DOCX compilation
- [ ] `edited`: `true` if HR changed the AI text before generating

### Duplicate detection verification:
- [ ] Generating LOR for the same employee twice returns `{ existing: true, ... }` on second attempt
- [ ] Generating with `forceDuplicate: true` creates a new file and new history record

### GET /api/lor/history verification:
- [ ] Returns `[]` before any LOR is generated
- [ ] Returns the full list of LOR records after generation
- [ ] Records are newest-first

---

## Phase 4E Gate: LOR Frontend UI

### Files to modify:
1. `web/app/lor/page.tsx` — MODIFY (replace stub — this is the ONLY phase where the stub changes)

### Checklist before starting Phase 4E:
- [ ] Phase 4D Gate is fully ✅
- [ ] All 3 API routes from Phase 4D return correct responses (verified manually)
- [ ] You have read `05_LOR_AI_GENERATION_FLOW.md` §Stage 4b (AI Failure Fallback)
- [ ] You understand the 3-panel layout from `07_LOR_IMPLEMENTATION_ORDER.md` §Step 11

### UI Panel Requirements:
- [ ] **Left Panel** — Sheet URL input + Load button + Candidate list + Editable form fields
- [ ] **Center Panel** — AI input fields + "Generate Draft" button + Draft textarea (editable) + "Regenerate" button
- [ ] **Right Panel** — Live LOR preview + "Generate Document" button + Download links + History list

### AI Failure Fallback (mandatory — Correction #4):
- [ ] If Gemini API returns any error, UI shows informational banner (not a blocking error dialog)
- [ ] Center Panel textarea is editable regardless of AI success or failure
- [ ] "Generate Document" button is NEVER disabled due to AI failure
- [ ] HR can write draft entirely manually and still generate DOCX

### After completing Phase 4E:
- [ ] `npm run build` passes
- [ ] `/lor` page loads and renders three panels
- [ ] Selecting a candidate auto-fills all form fields
- [ ] "Generate AI Draft" populates the center panel (or shows graceful fallback)
- [ ] Editing the draft updates the right-panel preview
- [ ] "Generate Document" creates DOCX + PDF and shows download links
- [ ] History section shows previously generated LORs

---

## Phase 4F Gate: Dashboard Integration

### Files to modify:
1. `web/app/api/contracts/route.ts` — MODIFY (add LOR normalization)
2. `web/app/page.tsx` — MODIFY (add LOR metric card, update total, update footnote)

### Checklist before starting Phase 4F:
- [ ] Phase 4E Gate is fully ✅
- [ ] At least 2 LOR records exist in `lor-history.json` for realistic testing

### Checklist after completing Phase 4F:
- [ ] `npm run build` passes
- [ ] Dashboard shows a 5th metric card: "LOR Generated"
- [ ] "Total Documents" count includes LOR records
- [ ] Activity table shows LOR rows with `lor` badge variant
- [ ] Brand count unchanged from pre-LOR baseline
- [ ] Employee count unchanged from pre-LOR baseline
- [ ] Certificate count unchanged from pre-LOR baseline
- [ ] Clicking DOCX download for LOR record works
- [ ] Clicking PDF download for LOR record works (if PDF was generated)
- [ ] Dashboard footnote updated to include `lor-history.json`

---

## Phase 4G Gate: Final Testing

### Full End-to-End Verification:
- [ ] Load real LOR Google Sheet with at least 2 candidate rows
- [ ] Search and select a candidate
- [ ] Verify all form fields auto-fill correctly from sheet data
- [ ] Generate AI draft — verify professional quality (no markdown artifacts)
- [ ] Make manual edits to the draft
- [ ] Generate Document — verify DOCX created in `output/lors/`
- [ ] Open DOCX — verify all 8 placeholders replaced, no literal `{{TAG}}` visible
- [ ] Verify dates formatted as `15th June, 2026` style
- [ ] Verify `lor-history.json` record has all fields including audit trail fields
- [ ] Verify PDF generated (or graceful skip message shown)
- [ ] Download DOCX via dashboard — file opens correctly
- [ ] Download PDF via dashboard — file opens correctly

### AI Failure Test:
- [ ] Temporarily comment out `GEMINI_API_KEY` from `.env`
- [ ] Navigate to `/lor`, select a candidate, click "Generate AI Draft"
- [ ] Verify: banner appears, draft is empty, textarea is editable
- [ ] Manually type draft text, click "Generate Document"
- [ ] Verify: DOCX generated successfully with manual draft
- [ ] Restore `GEMINI_API_KEY` to `.env`

### Sequence Numbering Final Verification:
- [ ] Note LOR counter value
- [ ] Generate a Brand contract — verify Brand counter incremented, LOR unchanged
- [ ] Generate a LOR — verify LOR counter incremented, Brand unchanged
- [ ] `sequence.json` structure matches expected format with all 4 keys

### Full Regression Verification:
- [ ] `/brand` — page loads, sheet loads, contract generation works
- [ ] `/employee` — page loads, sheet loads (if employee sheet configured)
- [ ] `/certificate` — page loads, certificate generation works
- [ ] Dashboard — shows all 4 module counts correctly, all downloads work
- [ ] `npm run build` — zero TypeScript errors

---

## Final Sign-Off

All phases complete when:
- [ ] Every item in Phase 4G is checked
- [ ] `npm run build` shows zero errors
- [ ] No regression in Brand, Employee, or Certificate modules
- [ ] `sequence.json` shows independent counters for all 4 module types
- [ ] `lor-history.json` contains complete audit trail records
- [ ] LOR documents are downloadable from both the LOR page and the Dashboard

**Status when all items above are ✅: LOR module is production-ready.**
