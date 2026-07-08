# Contract Generator — Desktop Tool — Project Plan

Single-machine Python desktop app (Tkinter). No server, no browser, no database.
Run with `python app.py`.

## Folder Structure

```
CONTRACT TOOL/
├── PROJECT_PLAN.md
├── app.py                         # Tkinter GUI entry point
├── requirements.txt
├── .env                           # sheet IDs, header mappings, LibreOffice path
├── credentials.json               # Google service account key (user-supplied, gitignored)
├── engines/
│   ├── sheets.py                  # Google Sheets reader, header-based column mapping
│   ├── pf.py                      # Salary calculation (verified against PF.xlsx)
│   ├── template.py                # DOCX placeholder engine + pronoun engine
│   ├── pdf.py                     # DOCX → PDF via LibreOffice headless
│   ├── contract_number.py         # Sequential numbering (sequence.json)
│   ├── store.py                   # Contract history (contracts.json)
│   └── utils.py                   # formatINR, numberToWords, formatDate
├── templates/
│   ├── brand-contract-template.docx
│   ├── employee-contract-template.docx
│   └── PF.xlsx                    # reference only — formulas are ported into pf.py
├── output/
│   ├── brands/
│   ├── employees/
│   ├── contracts.json             # generation history index
│   └── sequence.json              # per-type/year counters
└── BACKUP/                        # dated snapshots of templates/ (manual, do this after any template edit)
```

## Brand Workflow

```
Paste Brand Sheet URL → Load Records → Select Brand
        ↓
Enter: Location, Contract Type, Amount(s), Months/SKU, Commission %, Effective Date, Stamping Date
        ↓
Live clause preview
        ↓
Generate → DOCX written to output/brands/ → LibreOffice → PDF written to output/brands/
        ↓
Record appended to output/contracts.json
```

**Auto-loaded from sheet:** Legal Name, Brand Category, Address, Email, Phone, Contact Person

**Location options:** `SWN`, `KLJ`, `BOTH`
**Contract Type options:** `MONTH`, `SKU`

**Totals:**
- MONTH: `Total = Amount × Months`
- SKU: `Total = Amount × SKU Count × Months`
- BOTH: `Total = (SWN Amount + KLJ Amount) × Months` (MONTH) or `× SKU × Months` (SKU)

**Commission clause:** `A commission of {{COMMISSION_PCT}}% on the sale price of each product sold.`

## Employee Workflow

```
Paste Employee Sheet URL → Load Records → Select Employee (Gender auto-loaded)
        ↓
Enter: Annual CTC, Joining Date, PF Yes/No
        ↓
Live salary preview (Annexure-A)
        ↓
Generate → DOCX → LibreOffice → PDF
        ↓
Record appended to output/contracts.json
```

**Auto-loaded from sheet:** Full Name, Father's Name, Address, Email, Phone, PAN, Aadhar, Designation, Department, Gender

### Gender / Pronoun Engine

The employee template has pronouns hardcoded in prose ("his heirs", "terminate him", etc). The template
engine preprocesses `word/document.xml`, swapping bare `his/him/he` (and capitalized sentence-start
variants `His/Him/He`) for tags, scoped only to text inside `<w:t>` nodes so XML structure is untouched:

| Literal in template | Tag inserted            |
|---|---|
| `his` / `His`        | `{{PRONOUN_POSSESSIVE}}` / `{{PRONOUN_POSSESSIVE_CAP}}` |
| `him` / `Him`         | `{{PRONOUN_OBJECT}}` / `{{PRONOUN_OBJECT_CAP}}` |
| `he` / `He`           | `{{PRONOUN_SUBJECT}}` / `{{PRONOUN_SUBJECT_CAP}}` |

| Gender | SUBJECT | OBJECT | POSSESSIVE |
|---|---|---|---|
| Male   | he / He   | him / Him | his / His |
| Female | she / She | her / Her | her / Her |

### PF Salary Engine (verified against `templates/PF.xlsx`)

```
Monthly CTC = Annual CTC / 12                              (g3 = unrounded float)

Basic       = if g3 < 42000: min(21500, g3)  else: g3 / 2
PF Employer = if pfEnabled:  (1800 if Basic > 15000 else Basic × 12%)  else: 0
Conveyance  = if g3 < 42000: 0  else: g3 × 10%
HRA         = if g3 < 42000: g3 − Basic − PF Employer  else: Basic / 2
Special     = Monthly CTC − (Basic + HRA + Conveyance + PF Employer)   [balancing figure]
PF Employee = PF Employer (if PF enabled, else 0)
Salary In Hand = Monthly CTC − PF Employer − PF Employee
```

Cross-checked line-by-line against `PF.xlsx`'s own `YES` (₹5,12,000 CTC) and `NO` (₹2,76,000 CTC)
example sheets — exact rupee match on every component.

## Template Tags

**Brand contract** (`brand-contract-template.docx`), phrase → tag (longest-match-first, exact `<w:t>` match):
`{{LEGAL_NAME}}` `{{BRAND_CATEGORY}}` `{{ADDRESS}}` `{{AMOUNT}}` `{{NO_OF_SKUS}}` `{{NO_OF_MONTHS}}`
`{{TOTAL_AMOUNT}}` `{{LOCATION_TEXT}}` `{{COMMISSION_PCT}}` `{{STAMPING_DATE}}` `{{EFFECTIVE_DATE}}`

**Employee contract** (`employee-contract-template.docx`):
`{{EMPLOYEE_NAME}}` `{{EMPLOYEE_ADDRESS}}` `{{DESIGNATION}}` `{{JOINING_DATE}}`
`{{MONTHLY_CTC}}` `{{MONTHLY_CTC_WORDS}}` `{{ANNUAL_CTC}}` `{{ANNUAL_CTC_WORDS}}`
`{{PRONOUN_SUBJECT}}` `{{PRONOUN_SUBJECT_CAP}}` `{{PRONOUN_OBJECT}}` `{{PRONOUN_OBJECT_CAP}}`
`{{PRONOUN_POSSESSIVE}}` `{{PRONOUN_POSSESSIVE_CAP}}`

**Annexure-A table tags** (both Monthly + `_ANNUAL` suffix variants):
`{{ANN_BASIC}}` `{{ANN_HRA}}` `{{ANN_CONVEYANCE}}` `{{ANN_PF_EMPLOYER}}` `{{ANN_SPECIAL_ALLOWANCE}}`
`{{ANN_TOTAL_CTC}}` `{{ANN_PF_EMPLOYEE}}` `{{ANN_SALARY_IN_HAND}}`

**Processing rule:** exact match inside `<w:t>` nodes only, longest phrase first (e.g. `MONTHLY CTC IN WORDS`
before `MONTHLY CTC`) to avoid partial-match collisions.

## Google Sheet Mapping

Columns are matched by **header name**, not position — configured via `.env`:
`BRAND_HEADER_*`, `EMPLOYEE_HEADER_*` (see `.env` for current values). Sheet ID is extracted from
a pasted URL (`/d/<ID>/`) or accepted as a raw ID.

Auth: service account `credentials.json` in project root, scope `spreadsheets.readonly`.

## Output Naming & Contract Numbers

```
{PREFIX}-{TYPE}-{YEAR}-{SEQ:04d}_{PARTY_NAME_SLUG}.docx
{PREFIX}-{TYPE}-{YEAR}-{SEQ:04d}_{PARTY_NAME_SLUG}.pdf
```
e.g. `ZZ-BRAND-2026-0005_NIKE_INDIA.docx`, `ZZ-EMP-2026-0010_JOHN_DOE.docx`

Counters live in `output/sequence.json`, keyed by `{type}.{year}`. **Never reused, never reset**
automatically — a reset is a manual, deliberate action only.

## Build Order

1. Tkinter window shell — tabs, forms, dropdowns (no logic yet)
2. `engines/sheets.py` — Google Sheet reader
3. `engines/pf.py` — salary engine
4. `engines/template.py` — DOCX placeholder + pronoun engine
5. `engines/pdf.py` — LibreOffice PDF conversion
6. `engines/contract_number.py` + `engines/store.py` — numbering + history
7. Wire GUI → engines end-to-end, verify both modules with real generation
