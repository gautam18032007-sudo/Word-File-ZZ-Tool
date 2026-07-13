# ZenZebra Contract Generator — Project Report

_Generated: 2026-07-09_

## 1. What this project is

A tool for generating legal contracts (Brand contracts and Employee contracts) by pulling party
data from Google Sheets, filling DOCX templates, converting them to PDF, and keeping a numbered
history of every contract generated. Built for internal use at ZenZebra.

The project has gone through **two implementations**:

1. **Legacy: Python/Tkinter desktop app** — described in [PROJECT_PLAN.md](PROJECT_PLAN.md).
   Single-machine, no server/browser. Code lived in `engines/*.py`, entry point `app.py`.
2. **Current: Next.js web app** (`web/`) — the active implementation, per the latest commit
   ("Migrated to Next.js V1"). Every Python engine has been ported 1:1 to TypeScript, with
   comments in the source explicitly noting "faithful port of engines/X.py".

The repo root holds `.env`, `templates/`, and `output/` alongside the new `web/` Next.js project.
Legacy Python files and manual backups (`Template/`, `BACKUP/`, `__pycache__/`, `legacy-backup.zip`)
have been moved to the `.legacy_trash/` directory at the root and are gitignored.

## 2. Current architecture (web/)

Next.js 16 (App Router) + React 19 + TypeScript, Tailwind v4, shadcn/base-ui components. No
database — state lives in flat JSON files and the filesystem, one level above `web/`:

```
CONTRACT TOOL/
├── .env                     # sheet IDs, header mappings, LibreOffice path (shared by web/)
├── credentials.json         # Google service account key (gitignored, NOT present yet)
├── templates/               # source .docx/.xlsx templates read by the app
├── output/
│   ├── brands/               # generated brand DOCX/PDF
│   ├── employees/            # generated employee DOCX/PDF
│   ├── contracts.json        # generation history (newest first, capped at 500)
│   └── sequence.json         # per-type/year contract number counters
└── web/                      # ← the active Next.js app
    ├── app/
    │   ├── page.tsx                    # landing page
    │   ├── brand/page.tsx              # brand contract workflow UI (429 lines)
    │   ├── employee/page.tsx           # employee contract workflow UI (397 lines)
    │   ├── certificate/page.tsx        # certificate workflow UI (new)
    │   ├── history/page.tsx            # contract history browser (152 lines)
    │   └── api/
    │       ├── sheets/brand, sheets/employee, sheets/certificate   # GET: fetch rows from Google Sheet
    │       ├── generate/brand, generate/employee, generate/certificate # POST: render, PDF, log, return filenames
    │       ├── templates/certificate    # GET: get registry / POST: upload custom template
    │       ├── contracts                # GET: full history list
    │       └── download                 # GET: stream a generated file by folder+filename
    ├── lib/
    │   ├── sheets.ts        # Google Sheets reader (3 types: brand, employee, certificate)
    │   ├── salary.ts        # PF/CTC salary-breakup calculator
    │   ├── template.ts      # DOCX placeholder + pronoun engine (PizZip, string-level XML ops)
    │   ├── pdf.ts            # DOCX → PDF via LibreOffice headless subprocess
    │   ├── pdfLibGenerator.ts # PDF overlay generator for certificates using pdf-lib
    │   ├── contractNumber.ts # sequential numbering (never reused/reset, supports CERT)
    │   ├── store.ts          # contracts.json history read/append
    │   ├── certStore.ts      # certificates.json history read/append for certificates
    │   ├── formatting.ts     # formatINR, numberToWords (Indian numbering), formatDate
    │   └── types.ts          # shared domain types
    └── components/           # shadcn-style UI primitives + Sidebar, SheetLoader
```

## 3. Core workflows

### Brand contract
1. User pastes a Google Sheet URL → `GET /api/sheets/brand` loads rows.
2. User selects a brand row (auto-fills Legal Name, Brand Category, Address, Email, Phone,
   Contact Person).
3. User enters: Location (`SWN` / `KLJ` / `BOTH`), Contract Type (`MONTH` / `SKU`), amount(s),
   months/SKU count, commission %. (Effective Date and Stamping Date are no longer manual inputs,
   and are automatically set to the current system date in IST during generation).
4. Total is computed client/server-side:
   - `MONTH`: `Amount × Months`
   - `SKU`: `Amount × SKUs × Months`
   - `BOTH`: sums SWN + KLJ amounts first, then applies the same MONTH/SKU formula.
5. `POST /api/generate/brand` → renders `templates/brand-contract-template.docx`, converts to
   PDF via LibreOffice, writes both to `output/brands/`, appends a record to `contracts.json`.

### Employee contract
1. Paste Employee Sheet URL → `GET /api/sheets/employee` loads rows.
2. Select employee (auto-fills Full Name, Father's Name, Address, Email, Phone, PAN, Aadhar,
   Designation, Department, Gender).
3. Enter Annual CTC, Joining Date, PF Yes/No.
4. Live salary breakup preview (Annexure-A) computed by `calcSalary()`.
5. `POST /api/generate/employee` → renders `templates/employee-contract-template.docx` (with
   gender-driven pronoun substitution), PDF, writes to `output/employees/`, logs to history.

### Certificate module
1. Sourced automatically from the environment-configured Google Sheet (`GOOGLE_CERTIFICATE_SHEET_ID`) on mount via `GET /api/sheets/certificate`.
2. Candidates are displayed in a list with a searchable text filter (by Full Name and Designation).
3. Selecting a candidate auto-populates editable form fields (Full Name, Designation, Joining Date, LWD).
4. Custom templates can be registered via `POST /api/templates/certificate`, saving metadata to `templates/certificates/registry.json`.
5. Dynamic signatory details (Signatory Name, Signatory Role) and base64 signature graphic files can be configured.
6. A debounced live preview card overlays form values using absolute positioning on the template graphic.
7. `POST /api/generate/certificate` overlays text on PNG template files using `pdf-lib` at exact center-aligned coordinates, saves generated PDF to `output/certificates/` with sequential series `ZZ-CERT-YYYY-XXXX`, and logs history to `output/certificates.json`.
8. Includes built-in duplicate detection checking candidate name, dates, and certificate type before generating, preventing redundant sequence number consumption.

### Gender / pronoun engine
The employee template has pronouns hardcoded in prose (`his heirs`, `terminate him`, etc).
`template.ts` scans `<w:t>` text nodes only (XML structure untouched) and swaps bare
`his/him/he` (+ capitalized) for `{{PRONOUN_*}}` tags, later filled from Male/Female maps.

### PF salary engine (`lib/salary.ts`)
Verified line-by-line against `templates/PF.xlsx`, rupee-exact on both the `YES` (₹5,12,000 CTC)
and `NO` (₹2,76,000 CTC) PF examples:

```
Monthly CTC = Annual CTC / 12                              (g3 = unrounded)
Basic       = if g3 < 42000: min(21500, g3)  else: g3 / 2
PF Employer = if pfEnabled:  (1800 if Basic > 15000 else Basic × 12%)  else: 0
Conveyance  = if g3 < 42000: 0  else: g3 × 10%
HRA         = if g3 < 42000: g3 − Basic − PF Employer  else: Basic / 2
Special     = Monthly CTC − (Basic + HRA + Conveyance + PF Employer)   [balancing figure]
PF Employee = PF Employer (if PF enabled, else 0)
Salary In Hand = Monthly CTC − PF Employer − PF Employee
```
Rounding uses round-half-up (`Math.floor(x + 0.5)`) to match the original Python.

## 4. Google Sheets integration

Two auth modes, tried in order (`lib/sheets.ts`):
1. **Public CSV export** — `https://docs.google.com/spreadsheets/d/<id>/export?format=csv` — works
   if sheet sharing is "Anyone with the link". No credentials needed, fast path. Supports a
   pasted `gid=` fragment for a specific tab.
2. **Service account fallback** — used only if the CSV fetch fails. Requires
   `credentials.json` in the repo root with `spreadsheets.readonly` scope. **Not present in this
   repo currently** — Sheets loading will fail unless the target sheet is public or the file is
   added.

Columns are matched by **header name** (case-insensitive), not position, configured via `.env`
(`BRAND_HEADER_*`, `EMPLOYEE_HEADER_*`). Sheet IDs can be overridden per-request or fall back to
`GOOGLE_BRAND_SHEET_ID` / `GOOGLE_EMPLOYEE_SHEET_ID` in `.env`.

**Current `.env` state:** `GOOGLE_BRAND_SHEET_ID` is set; `GOOGLE_EMPLOYEE_SHEET_ID` is **empty**
— the Employee workflow needs a sheet URL pasted manually until this is filled in.

## 5. Output naming & numbering

```
{PREFIX}-{TYPE}-{YEAR}-{SEQ:04d}_{PARTY_NAME_SLUG}.docx / .pdf
```
e.g. `ZZ-BRAND-2026-0005_NIKE_INDIA.docx` or `ZZ-CERT-2026-0001_PALAK_KANKHERIA.pdf`. Counters live in `output/sequence.json`, keyed by
`{type}.{year}`, incremented atomically per generation, **never reused or auto-reset** (except when regenerating a certificate in force mode which reuses the existing certificate number).

**Current counters** (`output/sequence.json`): `EMP.2026 = 14`, `BRAND.2026 = 6` — i.e. 14
employee contracts and 6 brand contracts have been generated so far this year. Generated certificates are saved to `output/certificates/` with history stored in `output/certificates.json`. Note: the
`output/brands/` and `output/employees/` folders on disk are currently **empty** even though the
counters are at 14/6 and `contracts.json`-driven history would list them — meaning either the
files were generated on a different machine/session and never synced here, or they were manually
cleared. Worth checking `output/contracts.json` if historical files are expected to exist.

## 6. PDF generation

`lib/pdf.ts` shells out to LibreOffice headless (`soffice --headless --convert-to pdf`) via
`execFileSync`, using `LIBREOFFICE_PATH` from `.env` (currently
`C:\Program Files\LibreOffice\program\soffice.exe`). PDF conversion is **best-effort** — if it
fails, the DOCX is still saved and the API returns `pdfName: null` rather than erroring the whole
request. Requires LibreOffice installed at that path on whatever machine runs the app.

## 7. Security notes observed

- `/api/download` has explicit path-traversal guarding (rejects `..` in `folder`/`filename`) —
  good practice already in place.
- `credentials.json` and `.env` are correctly gitignored; `output/` (generated business data) is
  also gitignored, so contract history/PDFs never get committed.
- No authentication/authorization layer on any API route — anyone who can reach the Next.js
  server can list sheets data, generate contracts, and download any file in `output/`. Acceptable
  only if this is run strictly on a trusted local machine / private network, which seems to be
  the intent given the "single-machine" origin in `PROJECT_PLAN.md`.

## 8. Notable inconsistencies / things to verify

- **`PROJECT_PLAN.md` is stale** — it documents the Python/Tkinter architecture as if it's still
  current, but the actual working app is the Next.js port in `web/`. Worth updating or replacing
  it so future readers (or Claude sessions) aren't misled into thinking `app.py` is the entry
  point.
- **`GOOGLE_EMPLOYEE_SHEET_ID` is blank** in `.env` — confirm whether that's intentional (sheet
  URL always pasted per-session) or a leftover TODO.
- **`credentials.json` absent** — the service-account fallback path will always fail; the app
  currently depends entirely on the target Sheets being shared as "Anyone with the link".
- **`output/brands/` and `output/employees/` are empty** despite non-zero sequence counters —
  confirm whether generated files are expected to exist here or live elsewhere (e.g. a different
  machine, or manually cleaned up after this snapshot).
- **`web/tsconfig.tsbuildinfo`, `web/.next/`** present — normal build artifacts, already
  gitignored.
- **Legacy templates/backups archived**: The duplicate `Template/` (capital T, root) and `BACKUP/`
  directories have been safely archived to `.legacy_trash/` to avoid confusion with the active
  `templates/` directory.

## 9. How to run

```bash
cd web
npm install     # if node_modules not already present
npm run dev      # http://localhost:3000
```
Requires, at the repo root: `.env` (present), `credentials.json` (only if any target sheet is
private), `templates/*.docx` + `PF.xlsx` (present), and LibreOffice installed at the path in
`LIBREOFFICE_PATH` for PDF conversion.

## 10. Vercel deployment

The app now deploys to Vercel without crashing, with these adjustments already made:

- **Vercel Project Settings → Root Directory must be `web`** — this is required for Vercel's
  zero-config Next.js detection to find `next.config.ts`. The leftover root-level `package.json`
  (`build`/`dev`/`start` scripts that shell out with `--prefix web`) is a local-dev convenience
  only; it is not used by Vercel when Root Directory is set correctly.
- **Templates moved into `web/templates/`** (copied from the repo-root `templates/`) so they ship
  as part of the deployment bundle — `lib/template.ts` now resolves them relative to `web/`
  instead of one directory up, which wouldn't exist on Vercel. The repo-root `templates/` copy is
  left in place for the local Python-era layout; keep both in sync if you edit a template.
- **Env vars**: copy every value from `.env.example` (repo root) into Vercel's dashboard. Vercel
  injects them into `process.env` directly — no `.env` file is read at runtime there (the
  `web/instrumentation.ts` dotenv loader is a local-dev-only convenience and no-ops harmlessly on
  Vercel since `../env` won't exist in the deployment).
- **Google auth for private sheets**: added `GOOGLE_SERVICE_ACCOUNT_JSON` (`lib/sheets.ts`) —
  accepts the service-account key as raw JSON or base64 in a single env var, since a gitignored
  `credentials.json` file is never part of a Vercel deployment. Local dev can still use the file;
  the env var takes priority if both are present.
- **PDF conversion is skipped gracefully in production** — Vercel's serverless runtime has no
  LibreOffice binary, so `docxToPdf()` throws `PdfError`, which both generate routes already catch
  (best-effort design, unchanged). DOCX generation is unaffected; `pdfName` just comes back `null`.
  Do not set `LIBREOFFICE_PATH` on Vercel.
- **Output/log persistence is NOT durable on Vercel** — added `lib/paths.ts` (`writableDir()`),
  used by `contractNumber.ts`, `store.ts`, `logger.ts`, and both generate routes. When
  `process.env.VERCEL` is set, writes go to the OS temp dir instead of a repo-relative path (which
  is read-only there) — this only prevents crashes. Vercel's filesystem is ephemeral per
  invocation/cold start, so **contract history, sequence numbering, and generated files will not
  reliably persist in production** as currently built. True persistence needs an external store
  (e.g. Vercel Blob for generated files, Vercel KV/Postgres for `contracts.json`/`sequence.json`) —
  not yet implemented; flag before relying on this in production.
- **Frontend auto-load**: `SheetLoader` now auto-fetches on page mount using the env-configured
  `GOOGLE_BRAND_SHEET_ID` / `GOOGLE_EMPLOYEE_SHEET_ID` (no paste required); the URL field is now an
  optional override, not a gate. `GOOGLE_EMPLOYEE_SHEET_ID` is still blank in `.env` (§4) — the
  Employee page will show an error on first load until it's filled in.
