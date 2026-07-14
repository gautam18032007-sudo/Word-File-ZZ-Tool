# LOR Regression Analysis

**Phase**: 3 — File Impact Validation  
**Scope**: Proof that LOR changes cannot cause regression in Brand, Employee, Certificate, or Dashboard  
**Date**: 2026-07-15  
**Status**: Planning only — no code written

---

## How to Read This Document

Each section below verifies one category of regression risk. For every check:
- ✅ **SAFE** — confirmed no regression risk
- 🟡 **MONITOR** — additive change; low risk, requires post-coding verification
- 🔴 **BLOCKED** — must be resolved before coding

---

## 1. Brand Module Regression

| Check | Verdict | Evidence |
|---|---|---|
| `web/app/brand/page.tsx` touched? | ✅ SAFE | Not in any NEW or MODIFY list |
| `web/app/api/generate/brand/route.ts` touched? | ✅ SAFE | Not in any NEW or MODIFY list |
| `web/app/api/sheets/brand/route.ts` touched? | ✅ SAFE | Not in any NEW or MODIFY list |
| `web/templates/brand-contract-template.docx` touched? | ✅ SAFE | Not in any NEW or MODIFY list |
| Brand sequence counter affected by `LOR` key addition? | ✅ SAFE | `contractNumber.ts` uses independent nested keys: `store['BRAND']` vs `store['LOR']`. No cross-key access. |
| Brand uses `store.ts` → `contracts.json`? | ✅ SAFE | LOR uses `lorStore.ts` → `lor-history.json`. Different file. |
| Brand download via `/api/download?folder=brands` affected? | ✅ SAFE | Download route is generic. Adding `lors` folder creates no conflict. |
| `template.ts` used by Brand touched? | ✅ SAFE | LOR uses `lorGenerator.ts` + `docxtemplater`. `template.ts` is READ-ONLY. |
| `salary.ts` used by Brand affected? | ✅ SAFE | LOR has no salary component. `salary.ts` READ-ONLY. |

**Brand Regression Risk: ZERO**

---

## 2. Employee Module Regression

| Check | Verdict | Evidence |
|---|---|---|
| `web/app/employee/page.tsx` touched? | ✅ SAFE | Not in any NEW or MODIFY list |
| `web/app/api/generate/employee/route.ts` touched? | ✅ SAFE | Not in any NEW or MODIFY list |
| `web/app/api/sheets/employee/route.ts` touched? | ✅ SAFE | Not in any NEW or MODIFY list |
| `web/templates/employee-contract-template.docx` touched? | ✅ SAFE | Not in any NEW or MODIFY list |
| `web/lib/salary.ts` touched? | ✅ SAFE | Not in any NEW or MODIFY list |
| Employee uses `EMP` sequence key — does LOR use it? | ✅ SAFE | LOR uses key `LOR`. `EMP` key is independent. |
| Employee uses `contracts.json` — does LOR write to it? | ✅ SAFE | LOR writes to `lor-history.json` only. Never touches `contracts.json`. |
| Gender pronoun engine in `template.ts` affected? | ✅ SAFE | LOR does not use `template.ts`. No pronoun logic in LOR. |

**Employee Regression Risk: ZERO**

---

## 3. Certificate Module Regression

| Check | Verdict | Evidence |
|---|---|---|
| `web/app/certificate/page.tsx` touched? | ✅ SAFE | Not in any NEW or MODIFY list |
| `web/app/api/generate/certificate/route.ts` touched? | ✅ SAFE | Not in any NEW or MODIFY list |
| `web/app/api/sheets/certificate/route.ts` touched? | ✅ SAFE | Not in any NEW or MODIFY list |
| `web/lib/pdfLibGenerator.ts` touched? | ✅ SAFE | LOR uses LibreOffice CLI, not `pdf-lib`. |
| `web/lib/certStore.ts` touched? | ✅ SAFE | LOR uses `lorStore.ts`. `certStore.ts` is READ-ONLY. |
| `output/certificates.json` touched by LOR? | ✅ SAFE | LOR writes to `lor-history.json`. Never touches `certificates.json`. |
| `CERT` sequence key affected? | ✅ SAFE | LOR uses key `LOR`. `CERT` key is independent. |
| `/api/contracts` — does adding LOR break certificate normalization? | 🟡 MONITOR | Certificate normalization runs first, then LOR is appended. Sort is re-applied. Existing cert records unaffected. Verify certificate count after coding. |

**Certificate Regression Risk: LOW (monitor dashboard only)**

---

## 4. Sequence Numbering Collision Analysis

This is the most critical shared state. Full verification:

### Current `sequence.json` structure (as-built):
```json
{
  "BRAND": { "2026": 30 },
  "EMP":   { "2026": 42 }
}
```

### After first LOR generation:
```json
{
  "BRAND": { "2026": 30 },
  "EMP":   { "2026": 42 },
  "CERT":  { "2026": 12 },
  "LOR":   { "2026": 1  }
}
```

### Collision verification:

| Scenario | Risk | Explanation |
|---|---|---|
| `nextContractNumber('BRAND')` called while `LOR` key exists | ✅ SAFE | Accesses `store['BRAND']` only. `store['LOR']` is never read. |
| `nextContractNumber('LOR')` increments `BRAND` counter | ✅ SAFE | Accesses `store['LOR']` only. `store['BRAND']` is never touched. |
| Two simultaneous LOR generations | ✅ SAFE (local) | `writeFileSync` is synchronous in Node.js. Single-process local server. |
| Year rollover (2026→2027) | ✅ SAFE | Each year gets a new sub-key: `store['LOR']['2027'] = 0`. No collision. |
| LOR sequence accidentally reset | ✅ SAFE | `nextContractNumber` increments; it never resets unless the file is manually edited. |

### Mandatory post-coding verification:
After first LOR generation, inspect `sequence.json` and confirm:
- `BRAND` counter value unchanged from pre-LOR baseline
- `EMP` counter value unchanged from pre-LOR baseline
- `CERT` counter value unchanged from pre-LOR baseline
- `LOR` key present with value `1`

**Numbering Collision Risk: ZERO** (by design — independent nested keys)

---

## 5. History File Collision Analysis

| History File | Owner | LOR Writes? | Verdict |
|---|---|---|---|
| `output/contracts.json` | Brand + Employee | ❌ Never | ✅ SAFE |
| `output/certificates.json` | Certificate | ❌ Never | ✅ SAFE |
| `output/lor-history.json` | LOR | ✅ Only owner | ✅ SAFE |

The `/api/contracts` dashboard route **reads** from `contracts.json` and `certificates.json` and now will also read `lor-history.json`. None of these reads can corrupt any history file.

**History Collision Risk: ZERO**

---

## 6. Output Folder Collision Analysis

| Folder | Owner | LOR Writes? | Verdict |
|---|---|---|---|
| `output/brands/` | Brand | ❌ Never | ✅ SAFE |
| `output/employees/` | Employee | ❌ Never | ✅ SAFE |
| `output/certificates/` | Certificate | ❌ Never | ✅ SAFE |
| `output/lors/` | LOR | ✅ Only owner | ✅ SAFE |

**Output Folder Collision Risk: ZERO**

---

## 7. API Route Collision Analysis

### Existing routes (current file system):
```
/api/contracts/route.ts        ← MODIFY (additive only)
/api/download/route.ts         ← READ-ONLY (no change)
/api/generate/brand/route.ts   ← READ-ONLY
/api/generate/employee/route.ts ← READ-ONLY
/api/generate/certificate/route.ts ← READ-ONLY
/api/sheets/brand/route.ts     ← READ-ONLY
/api/sheets/employee/route.ts  ← READ-ONLY
/api/sheets/certificate/route.ts ← READ-ONLY
```

### New LOR routes (no path conflicts):
```
/api/sheets/lor/route.ts            ← NEW (unique path)
/api/generate/lor/route.ts          ← NEW (unique path)
/api/generate/lor/draft/route.ts    ← NEW (unique path)
/api/lor/history/route.ts           ← NEW (unique path)
```

| Conflict check | Verdict |
|---|---|
| `/api/sheets/lor` vs `/api/sheets/brand` | ✅ SAFE — different leaf segments |
| `/api/generate/lor` vs `/api/generate/brand` | ✅ SAFE — different leaf segments |
| `/api/generate/lor/draft` — does this shadow `/api/generate/lor`? | ✅ SAFE — Next.js App Router resolves `/api/generate/lor` and `/api/generate/lor/draft` independently |
| `/api/lor/history` — new top-level namespace collision? | ✅ SAFE — `api/lor/` directory does not exist yet; creates new namespace |
| `/api/download` used by LOR — route modification required? | ✅ SAFE — no modification; download route already accepts any `folder` param |

**API Route Collision Risk: ZERO**

---

## 8. TypeScript Import Cycle Analysis

### New LOR import chain:
```
/api/generate/lor/route.ts
  → lib/lorGenerator.ts        (docxtemplater, pizzip, path, fs)
  → lib/lorStore.ts            (fs, path, writableDir)
  → lib/contractNumber.ts      (fs, path, writableDir)
  → lib/paths.ts               (os, path)

/api/generate/lor/draft/route.ts
  → @google/generative-ai      (external package — no project imports)

/api/sheets/lor/route.ts
  → (no project lib imports — standalone fetcher)

/api/lor/history/route.ts
  → lib/lorStore.ts
```

### Cycle check:
- `lorStore.ts` imports only `fs`, `path`, `writableDir` (from `paths.ts`) — no cycle
- `lorGenerator.ts` imports `lorStore.ts` (optional), `contractNumber.ts`, `paths.ts` — no cycle
- No LOR file imports `store.ts`, `types.ts`, `template.ts`, `salary.ts`, or any Brand/Employee lib
- `paths.ts` has zero project-level imports — it is the leaf node of the dependency tree

**TypeScript Import Cycle Risk: ZERO**

---

## 9. Next.js App Router Conflict Analysis

| Risk | Verdict | Details |
|---|---|---|
| `app/lor/page.tsx` stub preserved during Phase A-C? | ✅ SAFE | Correction #1 accepted: stub is NOT replaced until APIs are verified |
| New routes under `app/api/generate/lor/` nested 4 levels deep | ✅ SAFE | Next.js 16 App Router supports unlimited nesting. Pattern confirmed by existing `app/api/templates/certificate/route.ts` |
| New `app/api/lor/` namespace valid? | ✅ SAFE | Any directory under `app/api/` with a `route.ts` is a valid App Router route |
| LOR page imports `fs` or `path`? | ✅ SAFE | `page.tsx` is `"use client"`. All `fs`/`path` operations are server-only in lib files and API routes |
| API routes missing `"use client"` directive? | ✅ SAFE | API `route.ts` files are always server-side; they do NOT need nor should have `"use client"` |

**Next.js App Router Conflict Risk: ZERO**

---

## 10. Dashboard Regression Analysis

The only shared code change is the `/api/contracts/route.ts` modification. Current state:

```typescript
// Current (existing):
const contracts = readContracts();    // contracts.json
const certs = readCertificates();     // certificates.json
const combined = [...contracts, ...normalizedCerts].sort(...)
```

Planned modification (additive only):
```text
const lors = readLorHistory();        // lor-history.json (NEW)
const normalizedLors = lors.map(...)  // normalize to ContractRecord shape (NEW)
const combined = [...contracts, ...normalizedCerts, ...normalizedLors].sort(...)
```

| Dashboard check | Verdict |
|---|---|
| `brandCount` filter (`c.type === 'brand'`) | ✅ SAFE — LOR records have `type: 'lor'`; not counted as brand |
| `employeeCount` filter (`c.type === 'employee'`) | ✅ SAFE — LOR records have `type: 'lor'`; not counted as employee |
| `certificateCount` filter (`c.type === 'certificate'`) | ✅ SAFE — LOR records have `type: 'lor'`; not counted as certificate |
| `totalDocuments` calculation (currently sum of 3 types) | 🟡 MONITOR — Must update to include `lorCount` in sum |
| Activity table badge variant for `type: 'lor'` | 🟡 MONITOR — Currently `brand`→default, `employee`→secondary, `certificate`→outline, `lor`→needs new variant |
| Sort order of combined list | ✅ SAFE — All records have `generated_at` ISO timestamps; sort is deterministic |
| Download buttons for LOR files | ✅ SAFE — Uses same `downloadFile(filename, 'lors')` pattern as other modules |
| `output/contracts.json` footnote on dashboard | 🟡 MONITOR — Currently says "Stored in contracts.json and certificates.json". Update to include `lor-history.json`. |

**Dashboard Regression Risk: LOW** — 3 items need updating when `page.tsx` is modified in Phase 4F.

---

## 11. Regression Risk Summary

| Module | Risk Level | Action Required |
|---|---|---|
| Brand | ✅ Zero | None |
| Employee | ✅ Zero | None |
| Certificate | 🟡 Low | Verify dashboard cert count unchanged after coding |
| Sequence Numbering | ✅ Zero | Inspect `sequence.json` after first LOR generation |
| History Files | ✅ Zero | None |
| Output Folders | ✅ Zero | None |
| API Routes | ✅ Zero | None |
| TypeScript Imports | ✅ Zero | None |
| Next.js App Router | ✅ Zero | None |
| Dashboard | 🟡 Low | Update `totalDocuments`, badge variant, and footnote in Phase 4F |

**Overall Regression Risk: LOW** — no critical blockers. Two 🟡 items are handled in Phase 4F (Dashboard) and do not affect any production module.
