# 16. Implementation Guide — LOR Module

This document provides a step-by-step technical implementation path for building the LOR module from scratch.

## Phase 1: Environment & Configuration

### Step 1.1 — Add Environment Variables
Edit the root `.env` file and add:
```env
# LOR Module
GOOGLE_LOR_SHEET_ID=your-sheet-id-here
GOOGLE_LOR_SHEET_GID=your-gid-here
GEMINI_API_KEY=your-gemini-api-key-here
```

### Step 1.1b — Install Missing Dependencies
```bash
npm install docxtemplater @google/generative-ai
```
- `docxtemplater` — DOCX placeholder rendering (not used by existing modules)
- `@google/generative-ai` — Gemini API SDK for AI draft generation

### Step 1.2 — Create Output Directories
The system creates these automatically, but verify they are gitignored:
```text
output/lors/          ← Generated files
output/lor-history.json  ← History records
```

### Step 1.3 — Verify Sequence Counter
The `output/sequence.json` file uses a **nested** `{ TYPE: { YEAR: count } }` structure. The `LOR` key is created automatically by `nextContractNumber('LOR')` on first generation. Current structure:
```json
{
  "BRAND": { "2026": 30 },
  "EMP": { "2026": 44 },
  "CERT": { "2026": 0 }
}
```
After first LOR generation, it will become:
```json
{
  "BRAND": { "2026": 30 },
  "EMP": { "2026": 44 },
  "CERT": { "2026": 0 },
  "LOR": { "2026": 1 }
}
```

### Step 1.4 — Extend `contractNumber.ts` Type Union
**File**: `web/lib/contractNumber.ts`

Add `'LOR'` to the type parameter union:
```typescript
// Before:
export function nextContractNumber(type: 'BRAND' | 'EMP' | 'CERT'): string {
// After:
export function nextContractNumber(type: 'BRAND' | 'EMP' | 'CERT' | 'LOR'): string {
```
This is a **one-line additive change**. No other modifications to this file are needed.

---

## Phase 2: Backend API Routes

### Step 2.1 — Create Sheet Loader API
**File**: `web/app/api/sheets/lor/route.ts`

> [!IMPORTANT]
> The existing `fetchRawRows()` in `web/lib/sheets.ts` only supports types `'brand' | 'employee' | 'certificate'`. Two options:
> - **Option A (Preferred)**: Create a standalone LOR sheet fetcher directly in the route file, using the same public CSV export pattern. This preserves full module isolation.
> - **Option B**: Extend `fetchRawRows` to accept `'lor'` and add `GOOGLE_LOR_SHEET_ID` to the env var lookup chain. This modifies a shared file.

- Accept `sheet` and `refresh` query parameters.
- Fetch the Google Sheet via CSV export URL (same technique as `sheets.ts`).
- Parse rows and return `{ headers, rows }` JSON.
- Fall back to `GOOGLE_LOR_SHEET_ID` env var when no sheet URL is provided.
- Handle errors with appropriate status codes.

### Step 2.2 — Create AI Draft API
**File**: `web/app/api/generate/lor/draft/route.ts`

- Import `@google/generative-ai` (install if not present).
- Read `GEMINI_API_KEY` from `process.env`.
- Validate required fields: `responsibilities`, `projects`, `strengths`.
- Build prompt from the template defined in `05_AI_GENERATION_ENGINE.md`.
- Call `model.generateContent(prompt)`.
- Strip markdown artifacts from response.
- Return `{ draft: "..." }`.

### Step 2.3 — Create LOR Generator Library
**File**: `web/lib/lorGenerator.ts`

- Read `web/templates/lor/lor-template.docx`.
- Use `PizZip` + `Docxtemplater` to replace placeholders.
- Format dates with ordinal suffixes (`15th June, 2026`).
- Write DOCX to `output/lors/`.
- Convert to PDF using LibreOffice CLI (if available).
- Return file paths.

### Step 2.4 — Create Generation API
**File**: `web/app/api/generate/lor/route.ts`

- Validate all required fields (name, designation, dates, AI draft).
- Check for duplicates in `lor-history.json`.
- If duplicate found and `forceDuplicate` is false, return `{ existing: true }`.
- Generate sequential number: `ZZ-LOR-YYYY-XXXX`.
- Call `lorGenerator.ts` to compile files.
- Append record to `lor-history.json`.
- Return file paths and ID.

---

## Phase 3: DOCX Template

### Step 3.1 — Create Template
**File**: `web/templates/lor/lor-template.docx`

- Open Microsoft Word or LibreOffice Writer.
- Design a professional letter with the ZenZebra letterhead.
- Insert placeholder tags: `{{NAME}}`, `{{DESIGNATION}}`, `{{DEPARTMENT}}`, `{{JOINING_DATE}}`, `{{LAST_WORKING_DATE}}`, `{{AI_LOR_CONTENT}}`, `{{SIGNATORY_NAME}}`, `{{SIGNATORY_ROLE}}`.
- Save as `.docx`.

---

## Phase 4: Frontend UI

### Step 4.1 — Replace Static Page
**File**: `web/app/lor/page.tsx`

Replace the "Coming Soon" stub with the full three-panel layout:

**Left Panel (340px)**:
- `SheetLoader` component with `storageKey="lor_sheet_url"`.
- Candidate search input with live filtering.
- Scrollable candidate list.
- Editable form fields (name, designation, department, dates, employment type).
- AI input fields (responsibilities, projects, strengths, additional info).

**Center Panel (flexible)**:
- Large `<textarea>` for the AI-generated draft body.
- "Generate AI Draft" button.
- "Regenerate" button (highlighted when inputs change after initial generation).

**Right Panel (flexible)**:
- Live preview rendering the full letter layout.
- "Generate DOCX + PDF" button.
- Download links (after generation).
- History list of previously generated LORs.

### Step 4.2 — Wire State Management
- Use `useState` hooks for all form fields.
- Use `useCallback` for the sheet load handler.
- Debounce preview updates at 300ms.
- Manage `generationState` for UI stage transitions.

---

## Phase 5: Dashboard Integration

### Step 5.1 — Create LOR History Store
**File**: `web/lib/lorStore.ts`

Create a dedicated LOR history store (mirroring `web/lib/certStore.ts` pattern):
- `readLorHistory()` — reads `output/lor-history.json`, returns `[]` if missing.
- `appendLorHistory(record)` — appends a record, writes back to disk.

### Step 5.2 — Update Contracts API
**File**: `web/app/api/contracts/route.ts`

The API returns a **single combined `contracts` array**. Normalize LOR records and merge:
```typescript
import { readLorHistory } from '@/lib/lorStore';

const lorHistory = readLorHistory();
const normalizedLors = lorHistory.map(l => ({
  contract_no: l.id,
  type: 'lor',
  party_name: l.employeeName,
  generated_at: l.generatedAt,
  docx: l.docxPath?.split('/').pop() ?? '',
  pdf: l.pdfPath?.split('/').pop() ?? '',
  folder: 'lors',
}));

const combined = [...contracts, ...normalizedCerts, ...normalizedLors]
  .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
```

### Step 5.3 — Update Dashboard Page
**File**: `web/app/page.tsx`

The dashboard computes counts **client-side** by filtering the `contracts` array:
```typescript
const lorCount = contracts.filter((c) => c.type === "lor").length;
const totalDocuments = brandCount + employeeCount + certificateCount + lorCount;
```
Add a new metric card with icon `ScrollText` and label "LOR Generated".

---

## Phase 6: Testing & Verification

### Step 6.1 — Build Check
```bash
npm run build
```
Verify zero TypeScript errors and all 18 routes compile.

### Step 6.2 — Manual Testing Checklist
- [ ] Load Google Sheet with LOR responses.
- [ ] Search and select an employee.
- [ ] Verify all fields auto-fill correctly.
- [ ] Generate AI draft and verify professional quality.
- [ ] Edit the AI draft manually.
- [ ] Generate DOCX and verify placeholders are replaced.
- [ ] Generate PDF and verify formatting.
- [ ] Verify history record is saved.
- [ ] Verify dashboard count updates.
- [ ] Test duplicate detection.
- [ ] Test validation errors (missing fields, bad dates).
