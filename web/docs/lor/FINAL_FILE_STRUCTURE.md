# FINAL FILE STRUCTURE
## LOR Module — Complete File Map with Change Classification

**Last Updated**: 2026-07-14

---

## Legend

| Tag | Meaning |
|---|---|
| `[NEW]` | File must be created from scratch |
| `[MODIFY]` | Existing file requires additive changes only |
| `[READ-ONLY]` | Existing file — DO NOT TOUCH |
| `[CONFIG]` | Configuration file requiring value addition |

---

## Project Root

```
CONTRACT TOOL/
│
├── .env                                    [CONFIG] Add 3 LOR env vars
│
├── output/
│   ├── brands/                             [READ-ONLY]
│   ├── employees/                          [READ-ONLY]
│   ├── certificates/                       [READ-ONLY]
│   ├── lors/                               [NEW] Created automatically at runtime
│   ├── contracts.json                      [READ-ONLY]
│   ├── certificates.json                   [READ-ONLY] (if exists)
│   ├── lor-history.json                    [NEW] Created automatically at runtime
│   └── sequence.json                       [MODIFY] LOR key auto-added by code
```

---

## Web Application

```
web/
│
├── package.json                            [MODIFY] Add docxtemplater, @google/generative-ai
│
├── app/
│   ├── page.tsx                            [MODIFY] Add LOR metric card + lorCount
│   ├── layout.tsx                          [READ-ONLY]
│   ├── globals.css                         [READ-ONLY]
│   │
│   ├── brand/
│   │   └── page.tsx                        [READ-ONLY]
│   ├── employee/
│   │   └── page.tsx                        [READ-ONLY]
│   ├── certificate/
│   │   └── page.tsx                        [READ-ONLY]
│   ├── lor/
│   │   └── page.tsx                        [MODIFY] Replace "Coming Soon" with full UI
│   │
│   └── api/
│       ├── contracts/
│       │   └── route.ts                    [MODIFY] Add LOR normalization + merge
│       ├── download/
│       │   └── route.ts                    [READ-ONLY]
│       ├── sheets/
│       │   ├── brand/
│       │   │   └── route.ts                [READ-ONLY]
│       │   ├── employee/
│       │   │   └── route.ts                [READ-ONLY]
│       │   ├── certificate/
│       │   │   └── route.ts                [READ-ONLY]
│       │   └── lor/
│       │       └── route.ts                [NEW] Google Sheet loader for LOR
│       ├── generate/
│       │   ├── brand/
│       │   │   └── route.ts                [READ-ONLY]
│       │   ├── employee/
│       │   │   └── route.ts                [READ-ONLY]
│       │   ├── certificate/
│       │   │   └── route.ts                [READ-ONLY]
│       │   └── lor/
│       │       ├── route.ts                [NEW] DOCX + PDF generation endpoint
│       │       └── draft/
│       │           └── route.ts            [NEW] Gemini AI draft endpoint
│       └── templates/
│           └── certificate/
│               └── route.ts                [READ-ONLY]
│
├── lib/
│   ├── contractNumber.ts                   [MODIFY] Add 'LOR' to type union (1 line)
│   ├── lorGenerator.ts                     [NEW] DOCX rendering + PDF conversion
│   ├── lorStore.ts                         [NEW] lor-history.json read/write
│   ├── sheets.ts                           [READ-ONLY] (NOT modified — LOR uses standalone fetcher)
│   ├── store.ts                            [READ-ONLY]
│   ├── certStore.ts                        [READ-ONLY]
│   ├── template.ts                         [READ-ONLY]
│   ├── salary.ts                           [READ-ONLY]
│   ├── pdf.ts                              [READ-ONLY]
│   ├── pdfLibGenerator.ts                  [READ-ONLY]
│   ├── paths.ts                            [READ-ONLY]
│   ├── formatting.ts                       [READ-ONLY]
│   ├── logger.ts                           [READ-ONLY]
│   ├── types.ts                            [READ-ONLY]
│   └── utils.ts                            [READ-ONLY]
│
├── templates/
│   ├── brand-contract-template.docx        [READ-ONLY]
│   ├── employee-contract-template.docx     [READ-ONLY]
│   ├── PF.xlsx                             [READ-ONLY]
│   ├── certificates/                       [READ-ONLY]
│   └── lor/
│       └── lor-template.docx               [NEW] DOCX template with 8 placeholders
│
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx                     [READ-ONLY] (already has /lor link)
│   └── ui/                                 [READ-ONLY]
│
└── docs/
    └── lor/
        ├── 01–18 docs                      [READ-ONLY] (already corrected)
        ├── FINAL_LOR_ARCHITECTURE.md        Post-audit architecture reference
        ├── FINAL_IMPLEMENTATION_CHECKLIST.md Pre-implementation verification list
        ├── FINAL_FILE_STRUCTURE.md           This file
        └── AI_AGENT_RULES_V2.md             Updated agent behavioral rules
```

---

## Change Impact Summary

### New Files (6)
| File | Purpose |
|---|---|
| `web/app/api/sheets/lor/route.ts` | Google Sheet loader for LOR candidates |
| `web/app/api/generate/lor/route.ts` | DOCX + PDF compilation endpoint |
| `web/app/api/generate/lor/draft/route.ts` | Gemini AI draft endpoint |
| `web/lib/lorGenerator.ts` | DOCX template rendering + PDF conversion engine |
| `web/lib/lorStore.ts` | LOR history file read/write operations |
| `web/templates/lor/lor-template.docx` | DOCX template with company letterhead |

### Modified Files (4)
| File | Change | Risk |
|---|---|---|
| `web/lib/contractNumber.ts` | Add `'LOR'` to type union | 🟢 Minimal — 1 line, additive only |
| `web/app/api/contracts/route.ts` | Import lorStore, normalize + merge LOR records | 🟡 Low — additive, existing logic untouched |
| `web/app/page.tsx` | Add `lorCount` filter + metric card | 🟡 Low — additive, existing cards untouched |
| `web/app/lor/page.tsx` | Replace "Coming Soon" stub with full UI | 🟢 None — file was a placeholder |

### Read-Only Files (all others)
All Brand, Employee, Certificate, and shared utility files remain untouched.

---

## Auto-Created at Runtime
| Path | Created By | Trigger |
|---|---|---|
| `output/lors/` | `fs.mkdirSync` in `lorGenerator.ts` | First DOCX generation |
| `output/lor-history.json` | `fs.writeFileSync` in `lorStore.ts` | First history record |
| `sequence.json["LOR"]` | `nextContractNumber('LOR')` | First contract number assignment |
