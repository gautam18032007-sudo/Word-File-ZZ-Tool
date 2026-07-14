# 17. AI Agent Rules — LOR Module

This document defines strict behavioral rules for any AI coding assistant (Gemini, Copilot, Claude, etc.) working on the LOR module.

## 1. Module Isolation Rules

### ❌ NEVER Modify These Modules
The following paths are **read-only**. No AI agent may write to, delete, rename, or modify any file under these directories:

| Module | Protected Paths |
|---|---|
| **Brand** | `web/app/brand/`, `web/app/api/generate/brand/`, `web/app/api/sheets/brand/`, `web/templates/brand-contract-template.docx` |
| **Employee** | `web/app/employee/`, `web/app/api/generate/employee/`, `web/app/api/sheets/employee/`, `web/templates/employee-contract-template.docx`, `web/lib/salary.ts` |
| **Certificate** | `web/app/certificate/`, `web/app/api/generate/certificate/`, `web/app/api/sheets/certificate/`, `web/app/api/templates/certificate/`, `web/lib/pdfLibGenerator.ts` |

### ✅ LOR Module Allowed Paths
AI agents may create and modify files in:
```text
web/app/lor/
web/app/api/sheets/lor/
web/app/api/generate/lor/
web/lib/lorGenerator.ts
web/templates/lor/
web/docs/lor/
output/lors/
output/lor-history.json
```

### ⚠️ Shared Files (Modify With Care)
These files are shared across modules. Modifications must be additive only (append, never delete existing logic):

| File | Allowed Change |
|---|---|
| `web/app/page.tsx` | Add LOR metric card to the dashboard |
| `web/app/api/contracts/route.ts` | Add `lor` count to the response |
| `web/components/layout/Sidebar.tsx` | Already has LOR link — do not duplicate |
| `output/sequence.json` | The `LOR` key is auto-created by `nextContractNumber('LOR')` — do NOT manually edit |
| `.env` | Add `GOOGLE_LOR_SHEET_ID`, `GOOGLE_LOR_SHEET_GID`, `GEMINI_API_KEY` |

## 2. Code Style Rules

| Rule | Details |
|---|---|
| **Language** | TypeScript (strict mode) |
| **Framework** | Next.js 16 App Router |
| **Components** | React functional components with hooks |
| **Styling** | CSS variables from `index.css`, no TailwindCSS utilities beyond what's already configured |
| **Imports** | Use `@/` path aliases (e.g., `@/components/ui/button`) |
| **Comments** | Preserve all existing comments. Add comments for non-obvious logic. |
| **Error handling** | Always return structured JSON errors with appropriate HTTP status codes |
| **File naming** | `camelCase` for TypeScript files, `kebab-case` for templates |

## 3. Generation Rules

| Rule | Details |
|---|---|
| **Numbering** | Use `ZZ-LOR-YYYY-XXXX` format. Never use `ZZ-EMP`, `ZZ-BRAND`, or `ZZ-CERT` prefixes. |
| **History** | Write to `output/lor-history.json`. Never write to `contracts.json` or `certificates.json`. |
| **Output** | Write files to `output/lors/`. Never write to `output/contracts/` or `output/certificates/`. |
| **Templates** | Read from `web/templates/lor/`. Never read from `web/templates/brand-*` or `web/templates/employee-*`. |

## 4. Testing Rules

| Rule | Details |
|---|---|
| **Build check** | Run `npm run build` after every change and verify zero errors. |
| **No regressions** | Verify `/brand`, `/employee`, and `/certificate` pages still load correctly. |
| **Manual testing** | Test the full LOR flow end-to-end before marking complete. |

## 5. Documentation Rules

| Rule | Details |
|---|---|
| **Update docs** | If any architecture decision changes, update the relevant doc in `web/docs/lor/`. |
| **Walkthrough** | After completing implementation, create a walkthrough artifact summarizing all changes. |
