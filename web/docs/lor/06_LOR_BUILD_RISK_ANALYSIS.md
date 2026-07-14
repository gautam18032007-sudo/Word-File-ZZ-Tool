# 06. LOR Build Risk Analysis

**Phase**: Implementation Planning  
**Scope**: All technical risks, categorized by subsystem, with mitigations  
**Date**: 2026-07-14

---

## Risk Legend

| Level | Meaning |
|---|---|
| 🔴 **Critical** | Will break the build or cause data loss. Must be resolved before implementation. |
| 🟡 **Medium** | May cause partial failures. Should be addressed during implementation. |
| 🟢 **Low** | Minor inconvenience or edge case. Can be addressed post-MVP. |

---

## 1. TypeScript Risks

### TS-1: `contractNumber.ts` type union (🔴 Critical)

| Property | Details |
|---|---|
| **Risk** | `nextContractNumber('LOR')` will not compile — `'LOR'` is not in the type union |
| **Current state** | `type: 'BRAND' \| 'EMP' \| 'CERT'` |
| **Required state** | `type: 'BRAND' \| 'EMP' \| 'CERT' \| 'LOR'` |
| **Impact** | `npm run build` fails immediately |
| **Mitigation** | One-line change on line 29 of `contractNumber.ts`. Must be done FIRST. |
| **Regression risk** | None — additive type union change. Existing calls still valid. |

### TS-2: Missing `@types` for new packages (🟢 Low)

| Property | Details |
|---|---|
| **Risk** | `docxtemplater` and `@google/generative-ai` may not have TypeScript types |
| **Impact** | Implicit `any` types or compile warnings |
| **Mitigation** | `@google/generative-ai` ships with built-in types. `docxtemplater` has `@types/docxtemplater` available. If types are missing, use `// @ts-expect-error` or create a minimal `.d.ts` declaration. |

### TS-3: `LorHistoryRecord` type definition (🟢 Low)

| Property | Details |
|---|---|
| **Risk** | New type must be defined in `lorStore.ts`, not in shared `types.ts` |
| **Impact** | If defined in `types.ts`, it couples LOR to shared type system |
| **Mitigation** | Define `LorHistoryRecord` interface inside `lorStore.ts` (same pattern as `CertificateRecord` in `certStore.ts`) |

---

## 2. Next.js Risks

### NX-1: App Router file conventions (🟡 Medium)

| Property | Details |
|---|---|
| **Risk** | Next.js 16 App Router has specific file naming rules. `route.ts` files in `app/api/` must export named HTTP method functions (`GET`, `POST`). |
| **Impact** | Misnamed exports will silently return 405 Method Not Allowed |
| **Mitigation** | Follow exact pattern from existing routes (e.g., `app/api/sheets/brand/route.ts`). Export `async function GET(req)` or `async function POST(req)`. |

### NX-2: Server/client component boundary (🟡 Medium)

| Property | Details |
|---|---|
| **Risk** | `lor/page.tsx` must be a client component (`"use client"`) for React state management. Server-only imports (`fs`, `path`) must NOT leak into client components. |
| **Impact** | Build fails with "Module not found: Can't resolve 'fs'" |
| **Mitigation** | Keep `"use client"` directive on `page.tsx`. All `fs`/`path` operations stay in `lib/` files which are only imported by API routes (server-side). |

### NX-3: Dynamic route nesting depth (🟢 Low)

| Property | Details |
|---|---|
| **Risk** | `/api/generate/lor/draft/route.ts` is 4 levels deep. Some Next.js versions have issues with deeply nested routes. |
| **Impact** | Route may not register |
| **Mitigation** | This depth is supported in Next.js 16 App Router. Existing `/api/templates/certificate/route.ts` proves the pattern works. |

---

## 3. DOCX Risks

### DX-1: Template file missing (🔴 Critical)

| Property | Details |
|---|---|
| **Risk** | `web/templates/lor/lor-template.docx` does not exist yet. It must be manually created. |
| **Impact** | Every DOCX generation attempt returns 500 |
| **Mitigation** | Create template before any coding. Use Microsoft Word or LibreOffice Writer. Include all 8 placeholder tags. Test that the file opens correctly. |

### DX-2: Placeholder tag typo (🟡 Medium)

| Property | Details |
|---|---|
| **Risk** | If `{{NAME}}` is typed as `{{ NAME }}` (with spaces) or `{NAME}` (single braces), docxtemplater will not match |
| **Impact** | Placeholder appears literally in final document |
| **Mitigation** | Exact tag syntax: `{{NAME}}`, `{{DESIGNATION}}`, `{{DEPARTMENT}}`, `{{JOINING_DATE}}`, `{{LAST_WORKING_DATE}}`, `{{AI_LOR_CONTENT}}`, `{{SIGNATORY_NAME}}`, `{{SIGNATORY_ROLE}}`. Test template with sample data before integrating. |

### DX-3: Multi-paragraph AI content rendering (🟡 Medium)

| Property | Details |
|---|---|
| **Risk** | AI draft contains `\n` characters for paragraph breaks. Without `linebreaks: true`, these appear as literal `\n` in the DOCX. |
| **Impact** | Letter body is a single unbroken paragraph |
| **Mitigation** | Set `linebreaks: true` in docxtemplater options. This converts `\n` to Word paragraph breaks (`<w:br/>`). Verify with a multi-paragraph test draft. |

### DX-4: Unicode character handling (🟢 Low)

| Property | Details |
|---|---|
| **Risk** | Employee names with accents (`é`, `ñ`), apostrophes (`O'Brien`), or non-Latin characters |
| **Impact** | Corrupted characters in DOCX |
| **Mitigation** | `docxtemplater` handles Unicode natively. PizZip preserves byte-level encoding. No special handling needed. |

---

## 4. PDF Risks

### PD-1: LibreOffice not installed (🟡 Medium)

| Property | Details |
|---|---|
| **Risk** | `LIBREOFFICE_PATH` not set or binary not found |
| **Impact** | PDF is not generated. Only DOCX is produced. |
| **Mitigation** | Graceful fallback: `pdfPath = null`. UI shows warning. This is the same behavior as existing modules. |

### PD-2: LibreOffice process hang (🟡 Medium)

| Property | Details |
|---|---|
| **Risk** | LibreOffice subprocess does not complete within expected time |
| **Impact** | API request hangs indefinitely |
| **Mitigation** | 60-second timeout. Kill the process if exceeded. Return DOCX only with `pdfPath: null`. |

### PD-3: PDF formatting differences (🟢 Low)

| Property | Details |
|---|---|
| **Risk** | LibreOffice renders fonts/spacing differently than Microsoft Word |
| **Impact** | PDF layout may not exactly match DOCX |
| **Mitigation** | Use standard fonts (Arial, Times New Roman) in template. Test PDF output visually. |

---

## 5. Gemini API Risks

### AI-1: API key invalid or expired (🟡 Medium)

| Property | Details |
|---|---|
| **Risk** | `GEMINI_API_KEY` is invalid, expired, or revoked |
| **Impact** | All AI draft requests fail |
| **Mitigation** | Return 500 with clear message: "AI service authentication failed. Check GEMINI_API_KEY." |

### AI-2: Rate limiting (🟡 Medium)

| Property | Details |
|---|---|
| **Risk** | Gemini free tier has rate limits. Rapid generation requests may hit the limit. |
| **Impact** | 429 errors during peak usage |
| **Mitigation** | Catch 429, return user-friendly message. Disable button during processing. The LOR module generates drafts one at a time — rate limiting is unlikely for normal usage. |

### AI-3: Irrelevant AI output (🟢 Low)

| Property | Details |
|---|---|
| **Risk** | Gemini ignores prompt structure and produces off-topic content |
| **Impact** | Draft quality is poor |
| **Mitigation** | HR can manually edit or regenerate. The `temperature: 0.4` setting reduces variability. Word count validation catches degenerate outputs. |

### AI-4: Model deprecation (🟢 Low)

| Property | Details |
|---|---|
| **Risk** | `gemini-2.0-flash` model is deprecated or replaced |
| **Impact** | API calls fail or produce different output quality |
| **Mitigation** | Update model string in the draft route. The prompt is model-agnostic. |

---

## 6. Google Sheet Risks

### GS-1: Sheet not publicly accessible (🟡 Medium)

| Property | Details |
|---|---|
| **Risk** | Google Sheet sharing is not set to "Anyone with the link — Viewer" |
| **Impact** | CSV export returns HTML error page, not CSV data |
| **Mitigation** | Detect non-CSV content-type in response. Return 401 with sharing instructions. |

### GS-2: Header format changes (🟡 Medium)

| Property | Details |
|---|---|
| **Risk** | Google Form question text changes, causing header mismatch |
| **Impact** | Fields map to wrong columns or return empty |
| **Mitigation** | Use alias-based matching (doc 04). Multiple aliases per field. Normalize headers before matching. |

### GS-3: Empty or malformed rows (🟢 Low)

| Property | Details |
|---|---|
| **Risk** | Sheet contains blank rows, partial submissions, or test data |
| **Impact** | Empty candidates appear in list |
| **Mitigation** | Filter rows where `employeeName` (Full Name column) is empty. |

---

## 7. Vercel Risks

### VR-1: No filesystem persistence (🟡 Medium)

| Property | Details |
|---|---|
| **Risk** | `output/` is ephemeral on Vercel. Files don't persist across deployments. |
| **Impact** | History resets, sequence numbers may reset, generated files disappear |
| **Mitigation** | Known limitation shared by all modules. No LOR-specific fix needed. Project is designed for local deployment. |

### VR-2: No LibreOffice binary (🟡 Medium)

| Property | Details |
|---|---|
| **Risk** | Vercel serverless runtime has no LibreOffice installation |
| **Impact** | PDF conversion always skipped on Vercel |
| **Mitigation** | Graceful skip — DOCX generated, `pdfPath: null`. Same as existing modules. |

### VR-3: Serverless function timeout (🟢 Low)

| Property | Details |
|---|---|
| **Risk** | Gemini API call + DOCX generation + PDF conversion may exceed Vercel's 10-second function limit (free tier) |
| **Impact** | 504 timeout on Vercel |
| **Mitigation** | Draft generation and document generation are separate API calls. Each should complete within 10 seconds individually. LibreOffice is skipped on Vercel. |

---

## 8. Regression Risks

### RG-1: Brand module regression (🟢 Low)

| Property | Details |
|---|---|
| **Risk** | LOR changes break Brand contract generation |
| **Verification** | Navigate to `/brand`, load sheet, generate a contract. Verify numbering uses `BRAND` key. |
| **Mitigation** | Zero code overlap. Only shared change is adding `'LOR'` to `contractNumber.ts` type union — this does not affect `'BRAND'` calls. |

### RG-2: Employee module regression (🟢 Low)

| Property | Details |
|---|---|
| **Risk** | LOR changes break Employee contract generation |
| **Verification** | Navigate to `/employee`, load sheet, generate a contract. Verify numbering uses `EMP` key. |
| **Mitigation** | Zero code overlap. `salary.ts`, `template.ts` are not modified. |

### RG-3: Certificate module regression (🟢 Low)

| Property | Details |
|---|---|
| **Risk** | LOR changes break Certificate generation |
| **Verification** | Navigate to `/certificate`, generate a certificate. Verify `certificates.json` unchanged. |
| **Mitigation** | Zero code overlap. `certStore.ts`, `pdfLibGenerator.ts` are not modified. |

### RG-4: Dashboard regression (🟡 Medium)

| Property | Details |
|---|---|
| **Risk** | Adding LOR normalization to `/api/contracts` breaks existing dashboard |
| **Verification** | Dashboard loads. Brand, Employee, Certificate counts are unchanged. Activity table shows all types. |
| **Mitigation** | LOR records are appended to the combined array. Existing normalization logic is untouched. Sort is re-applied. |

---

## 9. Risk Summary

| Category | Critical | Medium | Low | Total |
|---|---|---|---|---|
| TypeScript | 1 | 0 | 2 | 3 |
| Next.js | 0 | 2 | 1 | 3 |
| DOCX | 1 | 2 | 1 | 4 |
| PDF | 0 | 2 | 1 | 3 |
| Gemini API | 0 | 2 | 2 | 4 |
| Google Sheet | 0 | 2 | 1 | 3 |
| Vercel | 0 | 2 | 1 | 3 |
| Regression | 0 | 1 | 3 | 4 |
| **Total** | **2** | **13** | **12** | **27** |

**Critical blockers**: TS-1 (`contractNumber.ts` type union) and DX-1 (missing template DOCX). Both must be resolved before coding begins.
