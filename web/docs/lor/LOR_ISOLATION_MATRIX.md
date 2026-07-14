# LOR Isolation Matrix

**Phase**: 3 — File Impact Validation  
**Scope**: Complete isolation proof — every dimension where LOR could theoretically share state with other modules  
**Date**: 2026-07-15  
**Status**: Planning only — no code written

---

## Reading Guide

Each cell shows whether the LOR module **touches** that dimension of another module's resources.

- `✅ ISOLATED` — Zero contact. LOR has its own equivalent.
- `🟡 SHARED (read)` — LOR reads from a shared resource but never writes.
- `🔴 SHARED (write)` — LOR writes to a shared resource (requires careful implementation).
- `N/A` — Dimension does not apply to that module.

---

## 1. Storage Isolation Matrix

| Resource | Brand | Employee | Certificate | LOR | Risk |
|---|---|---|---|---|---|
| **History file** | `contracts.json` | `contracts.json` | `certificates.json` | `lor-history.json` | ✅ ISOLATED |
| **Output folder** | `output/brands/` | `output/employees/` | `output/certificates/` | `output/lors/` | ✅ ISOLATED |
| **Sequence file** | `sequence.json` | `sequence.json` | `sequence.json` | `sequence.json` | 🟡 SHARED (read+write — but independent keys) |
| **Sequence key** | `BRAND` | `EMP` | `CERT` | `LOR` | ✅ ISOLATED |
| **Download folder param** | `brands` | `employees` | `certificates` | `lors` | ✅ ISOLATED |

**Sequence file is the only shared write target.** It is safe because each module has its own namespace key and the file structure is `{ TYPE: { YEAR: count } }` — reads and writes to different keys never interfere.

---

## 2. Code / Library Isolation Matrix

| Library File | Brand | Employee | Certificate | LOR |
|---|---|---|---|---|
| `lib/store.ts` | ✅ Uses | ✅ Uses | ❌ | ❌ LOR has `lorStore.ts` |
| `lib/certStore.ts` | ❌ | ❌ | ✅ Uses | ❌ LOR has `lorStore.ts` |
| `lib/lorStore.ts` | ❌ | ❌ | ❌ | ✅ Only owner |
| `lib/template.ts` | ✅ Uses | ✅ Uses | ❌ | ❌ LOR has `lorGenerator.ts` |
| `lib/lorGenerator.ts` | ❌ | ❌ | ❌ | ✅ Only owner |
| `lib/pdfLibGenerator.ts` | ❌ | ❌ | ✅ Uses | ❌ |
| `lib/pdf.ts` | ✅ Uses | ✅ Uses | ❌ | ❌ LOR reimplements LibreOffice CLI in `lorGenerator.ts` |
| `lib/salary.ts` | ❌ | ✅ Uses | ❌ | ❌ |
| `lib/sheets.ts` | ✅ Uses | ✅ Uses | ✅ Uses | ❌ LOR has standalone sheet fetcher |
| `lib/contractNumber.ts` | ✅ Uses | ✅ Uses | ✅ Uses | 🔴 MODIFY (add `'LOR'` to type union) |
| `lib/paths.ts` | ✅ Uses | ✅ Uses | ✅ Uses | 🟡 SHARED (read-only — `writableDir()` call, no modification) |
| `lib/formatting.ts` | ✅ Uses | ✅ Uses | ❌ | ❌ LOR has inline date formatting |
| `lib/logger.ts` | ✅ Uses | ✅ Uses | ✅ Uses | 🟡 SHARED (optional — may use for error logging, no modification) |
| `lib/types.ts` | ✅ Uses | ✅ Uses | ✅ Uses | ❌ LOR defines `LorHistoryRecord` in `lorStore.ts` |
| `lib/utils.ts` | ✅ Uses | ✅ Uses | ✅ Uses | 🟡 SHARED (class merge utility, no modification) |

**`contractNumber.ts` is the only library file that is MODIFIED.** The change is a one-line additive type union extension. No logic changes.

---

## 3. API Route Isolation Matrix

| Route Path | Brand | Employee | Certificate | LOR |
|---|---|---|---|---|
| `/api/sheets/brand` | ✅ Owner | — | — | ❌ Not used |
| `/api/sheets/employee` | — | ✅ Owner | — | ❌ Not used |
| `/api/sheets/certificate` | — | — | ✅ Owner | ❌ Not used |
| `/api/sheets/lor` | — | — | — | ✅ Owner (NEW) |
| `/api/generate/brand` | ✅ Owner | — | — | ❌ Not used |
| `/api/generate/employee` | — | ✅ Owner | — | ❌ Not used |
| `/api/generate/certificate` | — | — | ✅ Owner | ❌ Not used |
| `/api/generate/lor` | — | — | — | ✅ Owner (NEW) |
| `/api/generate/lor/draft` | — | — | — | ✅ Owner (NEW) |
| `/api/lor/history` | — | — | — | ✅ Owner (NEW) |
| `/api/contracts` | 🟡 Consumer | 🟡 Consumer | 🟡 Consumer | 🟡 Consumer (additive) |
| `/api/download` | 🟡 Consumer | 🟡 Consumer | 🟡 Consumer | 🟡 Consumer (no change) |

**No route conflict exists.** Every LOR API path is in a unique namespace. The two shared routes (`/api/contracts`, `/api/download`) are generic aggregators — adding LOR support is additive.

---

## 4. Template Isolation Matrix

| Template File | Owned By | LOR Reads? | LOR Modifies? |
|---|---|---|---|
| `web/templates/brand-contract-template.docx` | Brand | ❌ | ❌ |
| `web/templates/employee-contract-template.docx` | Employee | ❌ | ❌ |
| `web/templates/PF.xlsx` | Employee | ❌ | ❌ |
| `web/templates/lor/lor-v1.docx` | LOR | ✅ (read at generation time) | ❌ (templates never written by app) |

> [!NOTE]
> Per Correction #5, the LOR template directory uses versioned file names (`lor-v1.docx`, `lor-v2.docx`, etc.) rather than a single flat `lor-template.docx`. The `lorGenerator.ts` will read the active version from a registry or env variable. This provides future template changes without code changes.

---

## 5. Environment Variable Isolation Matrix

| Variable | Brand | Employee | Certificate | LOR |
|---|---|---|---|---|
| `GOOGLE_BRAND_SHEET_ID` | ✅ Uses | ❌ | ❌ | ❌ |
| `GOOGLE_EMPLOYEE_SHEET_ID` | ❌ | ✅ Uses | ❌ | ❌ |
| `GOOGLE_LOR_SHEET_ID` | ❌ | ❌ | ❌ | ✅ Uses (NEW) |
| `GOOGLE_LOR_SHEET_GID` | ❌ | ❌ | ❌ | ✅ Uses (NEW) |
| `GEMINI_API_KEY` | ❌ | ❌ | ❌ | ✅ Uses (NEW) |
| `LIBREOFFICE_PATH` | ✅ Uses | ✅ Uses | ❌ | 🟡 SHARED (reads same var — no conflict) |
| `CONTRACT_PREFIX` | ✅ Uses | ✅ Uses | ✅ Uses | 🟡 SHARED (reads same var — no conflict) |
| `VERCEL` | ✅ (paths.ts) | ✅ (paths.ts) | ✅ (paths.ts) | 🟡 SHARED (reads via paths.ts — no conflict) |

**Three new env vars are LOR-exclusive.** All others are read-only shared — no LOR code sets or modifies any existing env var.

---

## 6. Dashboard UI Isolation Matrix

| UI Element | Current State | After LOR (Phase 4F) | Risk |
|---|---|---|---|
| "Total Documents" metric card | `brandCount + employeeCount + certificateCount` | `+ lorCount` | 🟡 Additive change |
| "Brand Contracts" metric card | `filter(type === 'brand')` | Unchanged | ✅ SAFE |
| "Employee Contracts" metric card | `filter(type === 'employee')` | Unchanged | ✅ SAFE |
| "Certificates" metric card | `filter(type === 'certificate')` | Unchanged | ✅ SAFE |
| New "LOR Generated" metric card | Absent | Added (5th card) | ✅ New — no regression |
| `grid-cols-4` metric grid | 4 columns | `grid-cols-5` (5 columns) | 🟡 Layout change — visual only |
| Activity table — badge for `type: 'lor'` | `lor` falls to `outline` variant (default else) | Explicit `lor` variant needed | 🟡 Minor code addition |
| Certificate analytics section | Conditional render `certificateCount > 0` | Unchanged | ✅ SAFE |
| Download buttons for LOR files | Not present | Added in LOR rows | ✅ SAFE |
| Dashboard footnote text | "contracts.json and certificates.json" | Add "lor-history.json" | 🟡 Text update |

---

## 7. Next.js Page Isolation Matrix

| Page Route | Status | LOR Phase That Touches It |
|---|---|---|
| `/` (Dashboard) | 🟡 Modified in Phase 4F | Phase 4F only |
| `/brand` | ✅ READ-ONLY | Never |
| `/employee` | ✅ READ-ONLY | Never |
| `/certificate` | ✅ READ-ONLY | Never |
| `/lor` | 🟡 Stub preserved through 4A–4D | Phase 4E replaces stub with full UI |

> [!IMPORTANT]
> Per Correction #1: `/lor/page.tsx` is **NOT modified** until Phase 4E (UI). During Phases 4A through 4D (storage, sheets, AI, and DOCX), the existing "Coming Soon" stub remains live. This means a broken API cannot cause a broken page.

---

## 8. Isolation Summary Scorecard

| Isolation Dimension | Fully Isolated? | Notes |
|---|---|---|
| Storage files | ✅ Yes | Completely separate files |
| Output folders | ✅ Yes | Completely separate directories |
| Sequence keys | ✅ Yes | Independent nested keys |
| Library code | ✅ Yes (1 shared modify) | `contractNumber.ts` type union only |
| API routes | ✅ Yes | No path conflicts |
| Templates | ✅ Yes | Versioned, separate directory |
| Environment vars | ✅ Yes | 3 new LOR-only vars |
| Dashboard | 🟡 Additive | Phase 4F changes are additive |
| Pages | ✅ Yes | Stub preserved until Phase 4E |
| TypeScript types | ✅ Yes | `LorHistoryRecord` self-contained in `lorStore.ts` |

**Isolation Grade: A** — One shared library file is modified (additive, one line). All storage, routing, and template resources are fully isolated.
