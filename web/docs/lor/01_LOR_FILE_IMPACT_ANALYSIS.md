# 01. LOR File Impact Analysis

**Phase**: Implementation Planning  
**Scope**: Every file in the project, classified by LOR impact  
**Date**: 2026-07-14

---

## Classification Legend

| Tag | Meaning |
|---|---|
| `[NEW]` | Must be created from scratch |
| `[MODIFY]` | Existing file — additive changes only |
| `[READ-ONLY]` | Must NOT be touched by LOR implementation |
| `[CONFIG]` | Configuration file requiring value addition |
| `[AUTO]` | Created automatically at runtime — no manual action |

---

## NEW Files (7 total)

| # | File | Purpose | Reason |
|---|---|---|---|
| 1 | `web/app/api/sheets/lor/route.ts` | Google Sheet CSV fetcher for LOR candidates | LOR needs its own sheet loading endpoint. Cannot reuse `fetchRawRows()` as it does not support `'lor'` type. Standalone fetcher preserves module isolation. |
| 2 | `web/app/api/generate/lor/route.ts` | DOCX + PDF compilation and history saving | Core generation endpoint. Reads template, builds DOCX via docxtemplater, converts to PDF via LibreOffice, saves history record, returns file paths. |
| 3 | `web/app/api/generate/lor/draft/route.ts` | Gemini AI draft generation | Sends structured prompt to Gemini API with employee role/responsibility data. Returns AI-generated recommendation body paragraphs. |
| 4 | `web/lib/lorGenerator.ts` | DOCX template rendering + PDF conversion engine | Encapsulates all file generation logic: template loading, placeholder replacement, date formatting, DOCX writing, LibreOffice PDF conversion. |
| 5 | `web/lib/lorStore.ts` | LOR history file read/write | Mirrors `certStore.ts` pattern. Reads/writes `output/lor-history.json`. Provides `readLorHistory()` and `appendLorHistory()` functions. |
| 6 | `web/templates/lor/lor-template.docx` | DOCX template with company letterhead | Physical Word document with 8 `{{PLACEHOLDER}}` tags. Must be created manually in Microsoft Word or LibreOffice Writer before any DOCX generation can work. |
| 7 | `web/app/api/lor/history/route.ts` | LOR history API | Standalone API route to retrieve generated LOR history from `lor-history.json` for frontend UI integration. |

---

## MODIFIED Files (4 total)

| # | File | Change | Reason | Risk Level |
|---|---|---|---|---|
| 1 | `web/lib/contractNumber.ts` | Add `'LOR'` to type union on line 29 | TypeScript will not compile `nextContractNumber('LOR')` without this. One-line additive change: `'BRAND' \| 'EMP' \| 'CERT'` → `'BRAND' \| 'EMP' \| 'CERT' \| 'LOR'`. No logic change. | 🟢 Minimal |
| 2 | `web/app/api/contracts/route.ts` | Import `lorStore`, normalize LOR records, merge into combined array | Dashboard needs LOR records in the unified `contracts` array. Add import, read `lor-history.json`, normalize to `ContractRecord` shape with `type: 'lor'`, merge and re-sort. | 🟡 Low |
| 3 | `web/app/page.tsx` | Add `lorCount` filter + LOR metric card in dashboard | Dashboard needs a 5th metric card for "LOR Generated". Add one `filter()` call and one `<Card>` component. Grid changes from `grid-cols-4` to `grid-cols-5`. | 🟡 Low |
| 4 | `web/app/lor/page.tsx` | Replace "Coming Soon" stub with full three-panel UI | Currently a 20-line placeholder. Entire file content is replaced. This is the largest single change. | 🟢 None (stub file) |

---

## CONFIG Files (1 total)

| # | File | Change | Reason |
|---|---|---|---|
| 1 | `.env` | Add `GOOGLE_LOR_SHEET_ID`, `GOOGLE_LOR_SHEET_GID`, `GEMINI_API_KEY` | LOR module requires its own Google Sheet ID and a Gemini API key. Existing env vars are untouched. |

---

## AUTO Files (3 total — created at runtime)

| # | File | Created By | Trigger |
|---|---|---|---|
| 1 | `output/lors/` | `fs.mkdirSync()` in `lorGenerator.ts` | First DOCX generation |
| 2 | `output/lor-history.json` | `fs.writeFileSync()` in `lorStore.ts` | First history record append |
| 3 | `sequence.json["LOR"]` | `nextContractNumber('LOR')` in `contractNumber.ts` | First contract number assignment |

---

## READ-ONLY Files — Brand Module

| File | Reason |
|---|---|
| `web/app/brand/page.tsx` | Brand UI — completely independent from LOR |
| `web/app/api/generate/brand/route.ts` | Brand generation — no shared logic with LOR |
| `web/app/api/sheets/brand/route.ts` | Brand sheet loader — no shared logic with LOR |
| `web/templates/brand-contract-template.docx` | Brand template — LOR has its own template |

## READ-ONLY Files — Employee Module

| File | Reason |
|---|---|
| `web/app/employee/page.tsx` | Employee UI — completely independent from LOR |
| `web/app/api/generate/employee/route.ts` | Employee generation — no shared logic with LOR |
| `web/app/api/sheets/employee/route.ts` | Employee sheet loader — no shared logic with LOR |
| `web/templates/employee-contract-template.docx` | Employee template — LOR has its own template |
| `web/lib/salary.ts` | PF/CTC salary engine — LOR has no salary component |

## READ-ONLY Files — Certificate Module

| File | Reason |
|---|---|
| `web/app/certificate/page.tsx` | Certificate UI — independent from LOR |
| `web/app/api/generate/certificate/route.ts` | Certificate generation — different engine |
| `web/app/api/sheets/certificate/route.ts` | Certificate sheet loader — independent |
| `web/app/api/templates/certificate/route.ts` | Certificate template API — not used by LOR |
| `web/lib/pdfLibGenerator.ts` | Certificate PDF engine (pdf-lib) — LOR uses docxtemplater + LibreOffice |
| `web/lib/certStore.ts` | Certificate history — LOR has its own `lorStore.ts` |

## READ-ONLY Files — Shared Infrastructure

| File | Reason |
|---|---|
| `web/lib/sheets.ts` | LOR uses a standalone fetcher instead of extending this file |
| `web/lib/store.ts` | Brand/Employee history — LOR has its own `lorStore.ts` |
| `web/lib/template.ts` | XML string replacement engine — LOR uses docxtemplater |
| `web/lib/pdf.ts` | LibreOffice subprocess — LOR reimplements this in `lorGenerator.ts` |
| `web/lib/paths.ts` | `writableDir()` helper — used by LOR but not modified |
| `web/lib/formatting.ts` | `formatINR`, `numberToWords` — not used by LOR |
| `web/lib/logger.ts` | File logger — optionally used by LOR, not modified |
| `web/lib/types.ts` | Brand/Employee types — LOR defines its own types |
| `web/lib/utils.ts` | Class merge utility — used but not modified |
| `web/app/api/download/route.ts` | File download — works with any `folder` + `file` combo, no changes needed |
| `web/app/layout.tsx` | Root layout — no changes needed |
| `web/app/globals.css` | Global styles — no changes needed |
| `web/components/layout/Sidebar.tsx` | Already has `/lor` link — do NOT duplicate |
| `web/components/ui/*` | Shared UI components — used but not modified |
| `web/templates/PF.xlsx` | Salary calculation reference — not used by LOR |

---

## Impact Summary

```text
┌──────────────────────────────────────────┐
│  LOR FILE IMPACT SUMMARY                 │
│                                          │
│  New files .............. 7              │
│  Modified files ......... 4              │
│  Config files ........... 1              │
│  Auto-created files ..... 3              │
│  Read-only files ........ 25+            │
│                                          │
│  Total code changes ..... 11 files       │
│  Risk: BRAND ............ Zero           │
│  Risk: EMPLOYEE ......... Zero           │
│  Risk: CERTIFICATE ...... Zero           │
│  Risk: SHARED ........... Low (additive) │
└──────────────────────────────────────────┘
```
