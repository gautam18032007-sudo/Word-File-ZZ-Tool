# AI AGENT RULES V2
## LOR Module — Updated Behavioral Rules for AI Coding Assistants

**Version**: 2.0 (Post-Audit)  
**Supersedes**: `17_AI_AGENT_RULES.md` (original rules still apply; this document adds corrections and clarifications)  
**Last Updated**: 2026-07-14

---

## 0. Pre-Implementation Gate

> [!CAUTION]
> Before writing ANY LOR code, verify ALL of the following are true:
>
> 1. `.env` contains `GOOGLE_LOR_SHEET_ID`, `GOOGLE_LOR_SHEET_GID`, and `GEMINI_API_KEY`
> 2. `docxtemplater` is in `package.json` (run `npm install docxtemplater` if not)
> 3. `@google/generative-ai` is in `package.json` (run `npm install @google/generative-ai` if not)
> 4. `web/templates/lor/lor-template.docx` exists with all 8 placeholders
> 5. `npm run build` passes with zero errors
>
> If any of the above is missing, resolve it FIRST before proceeding.

---

## 1. Module Isolation Rules (Unchanged + Reinforced)

### ❌ NEVER Modify These Modules
| Module | Protected Paths |
|---|---|
| **Brand** | `web/app/brand/`, `web/app/api/generate/brand/`, `web/app/api/sheets/brand/`, `web/templates/brand-contract-template.docx` |
| **Employee** | `web/app/employee/`, `web/app/api/generate/employee/`, `web/app/api/sheets/employee/`, `web/templates/employee-contract-template.docx`, `web/lib/salary.ts` |
| **Certificate** | `web/app/certificate/`, `web/app/api/generate/certificate/`, `web/app/api/templates/certificate/`, `web/lib/pdfLibGenerator.ts`, `web/lib/certStore.ts` |

### ✅ LOR Module Allowed Paths
```text
web/app/lor/
web/app/api/sheets/lor/
web/app/api/generate/lor/
web/lib/lorGenerator.ts
web/lib/lorStore.ts
web/templates/lor/
web/docs/lor/
output/lors/
output/lor-history.json
```

### ⚠️ Shared Files (Modify With Care — Additive ONLY)

| File | Allowed Change | Critical Rule |
|---|---|---|
| `web/lib/contractNumber.ts` | Add `'LOR'` to the type union | One-line change. Do NOT alter existing logic. |
| `web/app/api/contracts/route.ts` | Import `lorStore`, normalize LOR records, merge into combined array | Do NOT change how Brand/Employee/Certificate records are processed. |
| `web/app/page.tsx` | Add `lorCount` filter + LOR metric card | Do NOT modify existing metric cards or activity table logic. |
| `.env` | Add `GOOGLE_LOR_SHEET_ID`, `GOOGLE_LOR_SHEET_GID`, `GEMINI_API_KEY` | Do NOT modify existing env vars. |

### 🚫 DO NOT MODIFY These Shared Files
| File | Reason |
|---|---|
| `web/lib/sheets.ts` | Use a standalone sheet fetcher in the LOR route instead |
| `web/lib/store.ts` | LOR has its own `lorStore.ts` |
| `web/lib/template.ts` | LOR uses `docxtemplater`, not the XML string replacement engine |
| `web/lib/types.ts` | LOR types are defined in `lorStore.ts` |
| `web/components/layout/Sidebar.tsx` | Already has `/lor` link — do NOT duplicate |

---

## 2. Sequence Numbering Rules (CORRECTED)

> [!WARNING]
> The following rules were corrected in the audit. The original docs had incorrect schema assumptions.

| Rule | Details |
|---|---|
| **Format** | `ZZ-LOR-YYYY-XXXX` (e.g., `ZZ-LOR-2026-0001`) |
| **Schema** | `sequence.json` uses nested `{ "LOR": { "2026": n } }` — NOT flat `{ "lor": n }` |
| **Key** | UPPERCASE `LOR` — NOT lowercase `lor` |
| **Generator** | Call `nextContractNumber('LOR')` from `web/lib/contractNumber.ts` |
| **Auto-create** | The `LOR` key is created automatically on first call — do NOT manually edit `sequence.json` |
| **Never reuse** | Numbers are monotonically increasing, never reset, never skipped |
| **Never share** | `LOR` counter is completely independent of `BRAND`, `EMP`, `CERT` |

---

## 3. Dashboard Integration Rules (CORRECTED)

> [!WARNING]
> The following rules were corrected in the audit. The original docs assumed a different API response format.

| Rule | Details |
|---|---|
| **API response** | `/api/contracts` returns `{ contracts: [...combined array...] }` — NOT separate count fields |
| **LOR records** | Must be normalized into `ContractRecord` shape with `type: 'lor'` |
| **Counting** | Dashboard computes `lorCount` **client-side**: `contracts.filter(c => c.type === "lor").length` |
| **Merging** | LOR records are merged with Brand/Employee/Certificate records and sorted newest-first |
| **No separate field** | Do NOT add a `lor: n` field to the API response — this is NOT how the project works |

---

## 4. Download API Rules (CORRECTED)

> [!WARNING]
> The following rules were corrected in the audit. The original docs used incorrect query parameters.

| Rule | Details |
|---|---|
| **Endpoint** | `GET /api/download` (shared across all modules) |
| **Query params** | `folder=lors` + `file=<filename>` (two separate params) |
| **NOT** | `file=output/lors/<filename>` (full path — this is WRONG and will fail) |
| **Example** | `/api/download?folder=lors&file=ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.docx` |

---

## 5. Sheet Loader Rules (NEW)

| Rule | Details |
|---|---|
| **Do NOT modify `sheets.ts`** | The existing `fetchRawRows()` does not support `'lor'` type. Do NOT add it. |
| **Standalone fetcher** | Create a self-contained CSV fetcher in `web/app/api/sheets/lor/route.ts` |
| **Pattern** | Use the same public CSV export technique: `https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}` |
| **Env fallback** | If no `sheet` query param, fall back to `GOOGLE_LOR_SHEET_ID` + `GOOGLE_LOR_SHEET_GID` |
| **Header mapping** | Use the alias table from `04_GOOGLE_SHEET_MAPPING.md` |

---

## 6. AI Draft Rules

| Rule | Details |
|---|---|
| **Never send PII to AI** | Name, email, phone, dates are NOT sent to Gemini — only role/responsibility data |
| **Prompt** | Use the exact template from `05_AI_GENERATION_ENGINE.md` |
| **Config** | `temperature: 0.4`, `topP: 0.9`, `maxOutputTokens: 1024` |
| **Strip markdown** | Remove `**bold**`, `# heading`, and other markdown artifacts from AI output |
| **Validate length** | Reject responses under 50 words or over 500 words |

---

## 7. History Rules

| Rule | Details |
|---|---|
| **File** | Write to `output/lor-history.json`. NEVER write to `contracts.json` or `certificates.json`. |
| **Store pattern** | Mirror `certStore.ts`: `readLorHistory()` + `appendLorHistory()` |
| **Schema** | Use the record schema from `10_HISTORY_ARCHITECTURE.md` |
| **Newest first** | `unshift()` new records, cap at 500 |
| **Duplicate check** | Exact `employeeName` match. Show confirmation modal if duplicate found. |

---

## 8. Code Style Rules (Unchanged)

| Rule | Details |
|---|---|
| **Language** | TypeScript (strict mode) |
| **Framework** | Next.js 16 App Router |
| **Components** | React functional components with hooks |
| **Styling** | CSS variables from `globals.css`, existing Tailwind v4 config |
| **Imports** | Use `@/` path aliases (e.g., `@/components/ui/button`) |
| **Comments** | Preserve all existing comments. Add comments for non-obvious logic. |
| **Error handling** | Always return structured JSON errors with appropriate HTTP status codes |
| **File naming** | `camelCase` for TypeScript files, `kebab-case` for templates |

---

## 9. Testing Rules

| Rule | Details |
|---|---|
| **Build check** | Run `npm run build` after EVERY change and verify zero errors |
| **No regressions** | Verify `/brand`, `/employee`, `/certificate` pages still load correctly |
| **Manual testing** | Test the full LOR flow end-to-end before marking complete |
| **Regression test** | Generate one Brand + one Employee contract after LOR implementation to verify isolation |

---

## 10. Documentation Rules

| Rule | Details |
|---|---|
| **Update docs** | If any architecture decision changes, update the relevant doc in `web/docs/lor/` |
| **Walkthrough** | After completing implementation, create a walkthrough artifact summarizing all changes |
| **Read order** | Always read `FINAL_LOR_ARCHITECTURE.md` FIRST before any coding |
| **Checklist** | Use `FINAL_IMPLEMENTATION_CHECKLIST.md` to track progress |

---

## Quick Reference Card

```text
┌─────────────────────────────────────────────────────┐
│  LOR MODULE — QUICK REFERENCE                       │
│                                                     │
│  Prefix:     ZZ-LOR-YYYY-XXXX                      │
│  Seq Key:    LOR (uppercase, nested year schema)    │
│  History:    output/lor-history.json                 │
│  Output:     output/lors/                            │
│  Template:   web/templates/lor/lor-template.docx     │
│  Generator:  web/lib/lorGenerator.ts                 │
│  Store:      web/lib/lorStore.ts                     │
│  Page:       web/app/lor/page.tsx                    │
│  API Sheet:  /api/sheets/lor                         │
│  API Draft:  /api/generate/lor/draft                 │
│  API Gen:    /api/generate/lor                       │
│  Download:   /api/download?folder=lors&file=...      │
│  Dashboard:  type === "lor" in contracts array       │
│                                                     │
│  Dependencies to install:                            │
│    npm install docxtemplater @google/generative-ai   │
│                                                     │
│  Env vars to add:                                    │
│    GOOGLE_LOR_SHEET_ID                               │
│    GOOGLE_LOR_SHEET_GID                              │
│    GEMINI_API_KEY                                    │
└─────────────────────────────────────────────────────┘
```
