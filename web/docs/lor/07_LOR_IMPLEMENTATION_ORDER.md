# 07. LOR Implementation Order

**Phase**: Implementation Planning  
**Scope**: Exact step-by-step order of implementation  
**Date**: 2026-07-14

---

## Guiding Principles

1. **Dependencies first** — install packages and create config before writing code
2. **Shared changes first** — modify shared files early so all subsequent work builds on a stable base
3. **Backend before frontend** — API routes must exist before the UI can call them
4. **Libraries before routes** — utility files must exist before API routes import them
5. **Build-check after every step** — `npm run build` must pass after each step
6. **No Big Bang** — each step produces a testable increment

---

## Step 01: Environment Setup

**Files**: `.env`  
**Action**: Add 3 new environment variables  
**Details**:
- Add `GOOGLE_LOR_SHEET_ID=<your-sheet-id>`
- Add `GOOGLE_LOR_SHEET_GID=<your-gid>`
- Add `GEMINI_API_KEY=<your-api-key>`

**Verification**: Check `.env` file contains all 3 new vars. Existing vars unchanged.

---

## Step 02: Install Dependencies

**Files**: `package.json`, `package-lock.json`  
**Action**: Install 2 new npm packages  
**Command**: `npm install docxtemplater @google/generative-ai`

**Verification**:
- `docxtemplater` appears in `package.json` dependencies
- `@google/generative-ai` appears in `package.json` dependencies
- `npm run build` passes (no new imports yet — just installed)

---

## Step 03: Create DOCX Template

**Files**: `web/templates/lor/lor-template.docx`  
**Action**: Create the physical Word document template  
**Details**:
- Create `web/templates/lor/` directory
- Design professional letter in Microsoft Word or LibreOffice Writer
- Add ZenZebra company letterhead/logo in header
- Insert all 8 placeholder tags:
  - `{{NAME}}`, `{{DESIGNATION}}`, `{{DEPARTMENT}}`
  - `{{JOINING_DATE}}`, `{{LAST_WORKING_DATE}}`
  - `{{AI_LOR_CONTENT}}`
  - `{{SIGNATORY_NAME}}`, `{{SIGNATORY_ROLE}}`

**Verification**: Open template in Word/LibreOffice. All 8 tags visible. Layout looks professional.

---

## Step 04: Extend Contract Number Generator

**Files**: `web/lib/contractNumber.ts`  
**Action**: Add `'LOR'` to the type union (line 29)  
**Change**: `type: 'BRAND' | 'EMP' | 'CERT'` → `type: 'BRAND' | 'EMP' | 'CERT' | 'LOR'`

**Verification**:
- `npm run build` passes
- Navigate to `/brand` — still works
- Navigate to `/employee` — still works

---

## Step 05: Create LOR History Store

**Files**: `web/lib/lorStore.ts` (NEW)  
**Action**: Create the LOR history read/write module  
**Details**:
- Define `LorHistoryRecord` interface
- Implement `readLorHistory(): LorHistoryRecord[]`
- Implement `appendLorHistory(record: LorHistoryRecord): void`
- Pattern: mirror `web/lib/certStore.ts` exactly

**Verification**: `npm run build` passes.

---

## Step 06: Create LOR Generator Library

**Files**: `web/lib/lorGenerator.ts` (NEW)  
**Action**: Create the DOCX rendering + PDF conversion engine  
**Details**:
- Import `PizZip`, `Docxtemplater`
- Read template from `web/templates/lor/lor-template.docx`
- Implement date formatting (ordinal suffixes)
- Implement placeholder rendering with `linebreaks: true`
- Write DOCX to `output/lors/`
- PDF conversion via LibreOffice CLI (with graceful fallback)
- Return `{ docxPath, pdfPath }`

**Verification**: `npm run build` passes.

---

## Step 07: Create Sheet Loader API

**Files**: `web/app/api/sheets/lor/route.ts` (NEW)  
**Action**: Create GET endpoint for loading Google Sheet data  
**Details**:
- Standalone CSV fetcher (do NOT import from `sheets.ts`)
- Accept `sheet` and `refresh` query params
- Fall back to `GOOGLE_LOR_SHEET_ID` env var
- Parse CSV and return `{ headers, rows }`

**Verification**:
- `npm run build` passes
- Manual test: `curl http://localhost:3000/api/sheets/lor` returns sheet data
- Brand/Employee sheet APIs still work

---

## Step 08: Create AI Draft API

**Files**: `web/app/api/generate/lor/draft/route.ts` (NEW)  
**Action**: Create POST endpoint for Gemini AI draft generation  
**Details**:
- Import `@google/generative-ai`
- Validate required fields
- Build prompt from template
- Set generation config (temperature: 0.4, topP: 0.9)
- Strip markdown from response
- Validate word count (50-500)

**Verification**:
- `npm run build` passes
- Manual test: POST with sample data returns AI draft
- Draft is professional, 150-250 words

---

## Step 09: Create Document Generation API

**Files**: `web/app/api/generate/lor/route.ts` (NEW)  
**Action**: Create POST endpoint for DOCX + PDF compilation  
**Details**:
- Validate all required fields
- Check for duplicates in `lor-history.json`
- Call `nextContractNumber('LOR')`
- Call `lorGenerator.ts` to compile files
- Call `appendLorHistory()` to save record
- Return `{ id, docxPath, pdfPath, existing }`

**Verification**:
- `npm run build` passes
- Manual test: POST with sample data creates DOCX in `output/lors/`
- `lor-history.json` contains one record
- `sequence.json` has `LOR` key with count `1`
- Brand/Employee sequence numbers unchanged

---

## Step 10: Create LOR History API

**Files**: `web/app/api/lor/history/route.ts` (NEW)  
**Action**: Create GET endpoint for retrieving LOR history records  
**Details**:
- Import `readLorHistory` from `lorStore`
- Accept optional `limit` and `offset` query parameters
- Validate query parameters (limit must be a positive integer, offset must be a non-negative integer)
- Read, paginate (if needed), and return LOR records list as JSON

**Verification**:
- `npm run build` passes
- Manual test: `curl http://localhost:3000/api/lor/history` returns LOR records list (or `[]` if no LOR generated yet)

---

## Step 11: Build Frontend UI

**Files**: `web/app/lor/page.tsx` (MODIFY — replace stub)  
**Action**: Replace "Coming Soon" with full three-panel layout  
**Details**:
- Left Panel (340px): Sheet loader, candidate list, editable form fields
- Center Panel: AI draft textarea, generate/regenerate buttons
- Right Panel: Live preview, generate document button, download links, history
- State management with `generationState` variable
- 300ms debounce on preview updates

**Verification**:
- `npm run build` passes
- Navigate to `/lor` — page renders with three panels
- Load sheet — candidates appear
- Select candidate — form auto-fills
- Generate AI draft — text appears in center panel
- Edit draft — preview updates
- Generate document — DOCX + PDF created
- Download links work

---

## Step 12: Dashboard Integration

**Files**: `web/app/api/contracts/route.ts` (MODIFY), `web/app/page.tsx` (MODIFY)  
**Action**: Add LOR records to dashboard  
**Details**:
- Backend: Import `lorStore`, normalize LOR records, merge into combined array
- Frontend: Add `lorCount` filter, add LOR metric card, add "lor" badge variant

**Verification**:
- `npm run build` passes
- Dashboard shows LOR count
- Activity table shows LOR entries with correct badge
- Brand/Employee/Certificate counts unchanged
- Clicking LOR DOCX/PDF download buttons works

---

## Step 13: Final Verification

**Action**: Complete end-to-end testing and regression check

### LOR Flow
- [ ] Load Google Sheet with real LOR responses
- [ ] Search and select a candidate
- [ ] Verify all fields auto-fill correctly
- [ ] Generate AI draft — verify professional quality
- [ ] Edit the AI draft manually
- [ ] Generate DOCX — verify all placeholders replaced
- [ ] Generate PDF — verify formatting (or graceful skip)
- [ ] Verify history record saved to `lor-history.json`
- [ ] Verify dashboard count updates
- [ ] Test duplicate detection (generate for same employee twice)
- [ ] Test validation errors (missing fields, bad dates)

### Regression Check
- [ ] Navigate to `/brand` — page loads, no errors
- [ ] Navigate to `/employee` — page loads, no errors
- [ ] Navigate to `/certificate` — page loads, no errors
- [ ] Generate a Brand contract — succeeds, numbering unaffected
- [ ] Dashboard shows all 4 module counts correctly
- [ ] Download files from all modules work

### Build
- [ ] `npm run build` — zero TypeScript errors
- [ ] All API routes respond correctly

---

## Implementation Timeline Estimate

| Step | Estimated Effort | Cumulative |
|---|---|---|
| Steps 01-03 (Setup) | 30 minutes | 30 min |
| Step 04 (contractNumber) | 5 minutes | 35 min |
| Steps 05-06 (Libraries) | 1 hour | 1h 35m |
| Steps 07-10 (API Routes) | 2.5 hours | 4h 05m |
| Step 11 (Frontend UI) | 3 hours | 7h 05m |
| Step 12 (Dashboard) | 30 minutes | 7h 35m |
| Step 13 (Verification) | 1 hour | **~8.5 hours** |
