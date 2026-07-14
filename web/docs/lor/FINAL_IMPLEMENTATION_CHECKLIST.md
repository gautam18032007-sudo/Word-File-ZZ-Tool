# FINAL IMPLEMENTATION CHECKLIST
## LOR Module — Pre-Implementation Verification

**Purpose**: Every item on this list must be ✅ before any LOR code is written.  
**Last Updated**: 2026-07-14

---

## Phase 0: Prerequisites (Before Any Code)

### Environment
- [ ] `GOOGLE_LOR_SHEET_ID` added to `.env` with a valid Google Sheet ID
- [ ] `GOOGLE_LOR_SHEET_GID` added to `.env` with the correct tab GID
- [ ] `GEMINI_API_KEY` added to `.env` with a valid Gemini API key
- [ ] Google Sheet shared as "Anyone with the link — Viewer"
- [ ] Google Sheet contains at least one test row with all 14 fields populated

### Dependencies
- [ ] Run `npm install docxtemplater` — verify in `package.json`
- [ ] Run `npm install @google/generative-ai` — verify in `package.json`
- [ ] Run `npm run build` — verify zero new TypeScript errors

### Template
- [ ] Create `web/templates/lor/` directory
- [ ] Create `lor-template.docx` with all 8 placeholders:
  - `{{NAME}}`
  - `{{DESIGNATION}}`
  - `{{DEPARTMENT}}`
  - `{{JOINING_DATE}}`
  - `{{LAST_WORKING_DATE}}`
  - `{{AI_LOR_CONTENT}}`
  - `{{SIGNATORY_NAME}}`
  - `{{SIGNATORY_ROLE}}`
- [ ] Verify template opens correctly in LibreOffice Writer
- [ ] Verify ZenZebra letterhead/logo is embedded in the header

---

## Phase 1: Backend Implementation

### Step 1.1 — Extend Contract Number Generator
- [ ] Open `web/lib/contractNumber.ts`
- [ ] Change type union from `'BRAND' | 'EMP' | 'CERT'` to `'BRAND' | 'EMP' | 'CERT' | 'LOR'`
- [ ] Run `npm run build` — verify zero errors
- [ ] Verify no changes to `buildFilename()` function (it's generic, works as-is)

### Step 1.2 — Create LOR History Store
- [ ] Create `web/lib/lorStore.ts` (mirror `certStore.ts` pattern)
- [ ] Implement `readLorHistory(): LorHistoryRecord[]`
- [ ] Implement `appendLorHistory(record: LorHistoryRecord): void`
- [ ] Define `LorHistoryRecord` interface matching doc 10 schema
- [ ] Verify reads from `output/lor-history.json`
- [ ] Verify returns `[]` if file doesn't exist
- [ ] Verify unshift (newest first) + 500-record cap

### Step 1.3 — Create Sheet Loader API
- [ ] Create `web/app/api/sheets/lor/route.ts`
- [ ] Implement standalone CSV fetcher (do NOT modify `sheets.ts`)
- [ ] Accept `sheet` query param (optional override)
- [ ] Accept `refresh` query param (boolean)
- [ ] Fall back to `GOOGLE_LOR_SHEET_ID` env var
- [ ] Return `{ headers, rows }` on success
- [ ] Return 400 if no sheet ID available
- [ ] Return 401 if sheet not public
- [ ] Test with actual Google Sheet URL

### Step 1.4 — Create AI Draft API
- [ ] Create `web/app/api/generate/lor/draft/route.ts`
- [ ] Import `@google/generative-ai`
- [ ] Read `GEMINI_API_KEY` from `process.env`
- [ ] Validate required fields: `responsibilities`, `projects`, `strengths`
- [ ] Build prompt from doc 05 template
- [ ] Set generation config: `temperature: 0.4`, `topP: 0.9`, `maxOutputTokens: 1024`
- [ ] Strip markdown artifacts from response
- [ ] Return `{ draft: "..." }` on success
- [ ] Handle: missing API key (500), rate limit (429), empty response (500), timeout (504)
- [ ] Test with real Gemini API call

### Step 1.5 — Create LOR Generator Library
- [ ] Create `web/lib/lorGenerator.ts`
- [ ] Implement template reading from `web/templates/lor/lor-template.docx`
- [ ] Implement date formatting with ordinal suffixes (1st, 2nd, 3rd, etc.)
- [ ] Implement PizZip + Docxtemplater rendering with `linebreaks: true`
- [ ] Implement file writing to `output/lors/`
- [ ] Implement LibreOffice PDF conversion (with graceful fallback)
- [ ] Return `{ docxPath, pdfPath }` (pdfPath may be null)
- [ ] Test DOCX output with all 8 placeholders replaced
- [ ] Test PDF conversion (if LibreOffice installed)
- [ ] Test with multi-paragraph AI content (newlines preserved)

### Step 1.6 — Create Document Generation API
- [ ] Create `web/app/api/generate/lor/route.ts`
- [ ] Validate required fields: `employeeName`, `designation`, `joiningDate`, `lastWorkingDate`, `aiDraft`
- [ ] Validate date range (joining ≤ last working)
- [ ] Check for duplicates in `lor-history.json` by `employeeName`
- [ ] If duplicate and `forceDuplicate: false`, return `{ existing: true }`
- [ ] Call `nextContractNumber('LOR')` for sequential ID
- [ ] Call `lorGenerator.ts` to compile files
- [ ] Call `appendLorHistory()` to save record
- [ ] Return `{ id, docxPath, pdfPath, existing: false }` on success
- [ ] Handle: missing template (500), disk full (500), invalid dates (400)

---

## Phase 2: Frontend Implementation

### Step 2.1 — Replace LOR Page Stub
- [ ] Open `web/app/lor/page.tsx` (currently "Coming Soon")
- [ ] Implement three-panel layout (Left: 340px, Center: flexible, Right: flexible)
- [ ] Follow existing dark mode design system (HSL CSS variables)

### Step 2.2 — Left Panel
- [ ] SheetLoader component with `storageKey="lor_sheet_url"`
- [ ] Candidate search input with live filtering
- [ ] Scrollable candidate list
- [ ] Editable form fields: name, email, phone, department, designation, joining date, last working date, employment type
- [ ] AI input fields: responsibilities, projects, strengths, additional info (textareas)
- [ ] Declaration verification indicator
- [ ] Signatory name + role fields (default: Tanmay Jain / Co-Founder)

### Step 2.3 — Center Panel
- [ ] Large textarea for AI draft body
- [ ] "Generate AI Draft" button
- [ ] "Regenerate" button (highlighted when AI inputs change post-draft)
- [ ] Visual indicator: "Inputs changed since last draft"
- [ ] Full manual override supported

### Step 2.4 — Right Panel
- [ ] Live preview rendering the full letter layout
- [ ] 300ms debounce on preview updates
- [ ] "Generate DOCX + PDF" button
- [ ] Download links (DOCX + PDF, after generation)
- [ ] History list of previously generated LORs
- [ ] Duplicate detection confirmation modal

### Step 2.5 — State Management
- [ ] `generationState`: idle → loading_sheet → selected → generating_ai → draft_ready → compiling → success → error
- [ ] Spinners during loading_sheet, generating_ai, compiling
- [ ] Button disabled during processing
- [ ] Error display with user-friendly messages

---

## Phase 3: Dashboard Integration

### Step 3.1 — Update Contracts API
- [ ] Open `web/app/api/contracts/route.ts`
- [ ] Import `readLorHistory` from `@/lib/lorStore`
- [ ] Normalize LOR records to match `ContractRecord` structure
- [ ] Merge into combined array, sort newest-first
- [ ] Verify existing Brand/Employee/Certificate data unaffected
- [ ] Test API response includes LOR records with `type: "lor"`

### Step 3.2 — Update Dashboard Page
- [ ] Open `web/app/page.tsx`
- [ ] Add `lorCount` computed from `contracts.filter(c => c.type === "lor")`
- [ ] Update `totalDocuments` to include `lorCount`
- [ ] Add 5th metric card (LOR Generated) with `ScrollText` icon
- [ ] Add `type === "lor"` badge variant in activity table
- [ ] Verify Brand/Employee/Certificate cards still display correctly

---

## Phase 4: Verification

### Build
- [ ] `npm run build` — zero TypeScript errors
- [ ] All routes compile successfully
- [ ] No console warnings about missing dependencies

### Integration Testing
- [ ] Load Google Sheet → candidates appear in list
- [ ] Select candidate → all fields auto-fill correctly
- [ ] Edit any field → changes reflected
- [ ] Generate AI Draft → professional recommendation text appears
- [ ] Edit AI draft manually → preview updates
- [ ] Regenerate AI draft after changing inputs → new draft generated
- [ ] Generate DOCX → file created in `output/lors/`
- [ ] Generate PDF → file created (or graceful skip if no LibreOffice)
- [ ] Download DOCX → file downloads correctly
- [ ] Download PDF → file downloads correctly
- [ ] History record → appears in `lor-history.json`
- [ ] Dashboard count → LOR count displayed correctly
- [ ] Activity table → LOR records appear with correct badge

### Regression Testing
- [ ] Navigate to `/brand` → page loads, no errors
- [ ] Navigate to `/employee` → page loads, no errors
- [ ] Navigate to `/certificate` → page loads, no errors
- [ ] Generate a Brand contract → succeeds, numbering unaffected
- [ ] Generate an Employee contract → succeeds, numbering unaffected
- [ ] Dashboard shows all 4 module counts correctly

### Edge Cases
- [ ] Duplicate LOR for same employee → confirmation modal shown
- [ ] Missing required fields → validation error displayed
- [ ] Invalid date range (joining > exit) → error displayed
- [ ] Empty Google Sheet → error message shown
- [ ] Gemini API key missing → appropriate error
- [ ] Very long AI draft (500+ words) → DOCX handles multi-page
