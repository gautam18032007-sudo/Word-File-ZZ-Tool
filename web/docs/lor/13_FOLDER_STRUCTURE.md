# 13. Folder Structure — LOR Module

This document defines the complete isolated directory and file layout for the LOR module.

## 1. Source Code Structure

```text
web/
├── app/
│   ├── lor/
│   │   └── page.tsx                    ← LOR UI page (three-panel layout)
│   └── api/
│       ├── sheets/
│       │   └── lor/
│       │       └── route.ts            ← GET: Load Google Sheet rows
│       └── generate/
│           └── lor/
│               ├── route.ts            ← POST: Compile DOCX + PDF
│               └── draft/
│                   └── route.ts        ← POST: Generate AI draft
├── lib/
│   └── lorGenerator.ts                 ← DOCX template rendering + PDF conversion
├── templates/
│   └── lor/
│       └── lor-template.docx           ← DOCX template with placeholders
└── docs/
    └── lor/
        ├── 01_PROJECT_OVERVIEW.md
        ├── 02_BUSINESS_REQUIREMENTS.md
        ├── ...
        └── 18_ROOKIE_DEVELOPER_GUIDE.md
```

## 2. Output Structure

```text
output/
├── lors/                               ← Generated LOR files
│   ├── ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.docx
│   ├── ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.pdf
│   ├── ZZ-LOR-2026-0002_PRIYA_SHARMA.docx
│   └── ZZ-LOR-2026-0002_PRIYA_SHARMA.pdf
├── lor-history.json                    ← LOR generation history
└── sequence.json                       ← Shared numbering (contains "lor" key)
```

## 3. Sequence Counter (`sequence.json`)

The existing `output/sequence.json` file tracks numbering for all modules using a **nested** `{ TYPE: { YEAR: count } }` structure:

```json
{
  "BRAND": {
    "2026": 30
  },
  "EMP": {
    "2026": 44
  },
  "CERT": {
    "2026": 0
  },
  "LOR": {
    "2026": 2
  }
}
```

> [!IMPORTANT]
> - Keys are **UPPERCASE** type prefixes (`LOR`, not `lor`).
> - Each type contains a year-keyed sub-object (allowing per-year numbering).
> - This matches the schema used by `web/lib/contractNumber.ts`.
> - The `LOR` key is created automatically on first generation via `nextContractNumber('LOR')`.
> - It is **never** shared with `BRAND`, `EMP`, or `CERT` counters.

### Required Code Change
The existing `nextContractNumber()` function in [contractNumber.ts](file:///c:/Users/pc/Documents/CONTRACT%20TOOL/web/lib/contractNumber.ts) constrains its `type` parameter to:
```typescript
type: 'BRAND' | 'EMP' | 'CERT'
```
This union **must be extended** to include `'LOR'`:
```typescript
type: 'BRAND' | 'EMP' | 'CERT' | 'LOR'
```
This is a **one-line additive change** that does not affect existing module behavior.

## 4. Environment Configuration (`.env`)

Add the following variables to the root `.env` file:

```env
# LOR Module
GOOGLE_LOR_SHEET_ID=1_T1FNjR07-t03vgo138ZI-QJCEu9vbsqbOZQkkf_tYA
GOOGLE_LOR_SHEET_GID=1843964171
GEMINI_API_KEY=your-gemini-api-key-here
```

## 5. Gitignore Rules

The following paths are gitignored (already covered by existing patterns):

```text
output/lors/
output/lor-history.json
```

## 6. Isolation Verification Checklist

| Check | Status |
|---|---|
| LOR has its own `/app/lor/page.tsx` | ✅ |
| LOR has its own `/api/sheets/lor/route.ts` | ✅ |
| LOR has its own `/api/generate/lor/route.ts` | ✅ |
| LOR has its own `/api/generate/lor/draft/route.ts` | ✅ |
| LOR has its own `lib/lorGenerator.ts` | ✅ |
| LOR has its own template in `templates/lor/` | ✅ |
| LOR writes to `output/lors/` (not `output/contracts/`) | ✅ |
| LOR uses `lor-history.json` (not `contracts.json`) | ✅ |
| LOR uses `sequence.json["lor"]` key | ✅ |
| LOR does not import from Brand/Employee/Certificate modules | ✅ |
