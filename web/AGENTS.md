<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ZenZebra Contract Generator — web/

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/base-ui. Generates
Employee and Brand contracts (DOCX + PDF) from Google Sheets data, with a JSON-file history —
no database, no auth, no login.

**Docs, read in this order:**
1. [`CONTRACT_GENERATOR_LOGIC.md`](../CONTRACT_GENERATOR_LOGIC.md) — source-of-truth business
   workflow (what the app *should* do).
2. [`PROJECT_REPORT.md`](../PROJECT_REPORT.md) — as-built state of this codebase (what it
   *actually* does today, plus known gaps).
3. [`PROJECT_PLAN.md`](../PROJECT_PLAN.md) — architecture/folder-structure reference, superseded
   for business logic by doc #1.

These three root-level docs are the working spec. When behavior changes, update them —
especially `PROJECT_REPORT.md`, which should always reflect the current implementation.

## Run it

```bash
npm run dev   # http://localhost:3000
```

Needs, at the repo root (one level up from `web/`): `.env`, and LibreOffice installed at the path
in `LIBREOFFICE_PATH` (PDF conversion is best-effort — DOCX generation still succeeds if
LibreOffice is missing/fails). Templates live in `web/templates/` (see below) so they ship with a
Vercel deployment — keep the repo-root `templates/` copy in sync if you edit one.

## Where things live

All engines are 1:1 ports of an earlier Python desktop app — keep that fidelity in mind when
changing math or string logic (e.g. `salary.ts` rounding must stay round-half-up to match
`PF.xlsx`).

| File | Responsibility |
|---|---|
| `lib/sheets.ts` | Reads Google Sheets — public CSV export first, service-account fallback second (`GOOGLE_SERVICE_ACCOUNT_JSON` env var, or local `credentials.json`) |
| `lib/salary.ts` | PF/CTC salary breakup — verified rupee-exact against `templates/PF.xlsx` |
| `lib/template.ts` | DOCX placeholder + gender pronoun engine (string ops scoped to `<w:t>` XML nodes, via PizZip); templates read from `web/templates/` |
| `lib/pdf.ts` | DOCX → PDF via LibreOffice headless subprocess — skipped gracefully where LibreOffice is unavailable (e.g. Vercel) |
| `lib/paths.ts` | `writableDir()` — resolves output/log dirs to a repo-root-relative path locally, or the OS temp dir when `process.env.VERCEL` is set |
| `lib/contractNumber.ts` | Sequential contract numbering (`output/sequence.json`) — never reused, never auto-reset |
| `lib/store.ts` | Contract history read/append (`output/contracts.json`, capped at 500, newest first) |
| `lib/logger.ts` | File logger (`logs/{sheets,generation,errors}.log`) via `writableDir()` |
| `lib/formatting.ts` | `formatINR`, `numberToWords` (Indian numbering), `formatDate` |
| `app/api/sheets/{brand,employee}` | GET — fetch rows from a Google Sheet |
| `app/api/generate/{brand,employee}` | POST — render DOCX, convert PDF, log to history |
| `app/api/contracts` | GET — full history list |
| `app/api/download` | GET — stream a generated file by `folder`+`file` (already guards path traversal) |
| `app/brand/page.tsx`, `app/employee/page.tsx` | The two contract workflows — sheets auto-load on mount from the env-configured sheet ID; the URL field is an optional override |

## Known gaps vs. the source-of-truth spec (`CONTRACT_GENERATOR_LOGIC.md`)

Not yet implemented — confirm with the user before assuming these are done:
- No explicit "Gender override" control on the employee page (gender is currently sheet-driven
  only).
- `GOOGLE_EMPLOYEE_SHEET_ID` is blank in `.env` — the Employee page will error on load until it's
  filled in (Brand auto-loads fine since its sheet ID is set).
- **Output/log persistence is not durable on Vercel** — `writableDir()` only prevents crashes
  there (writes go to the ephemeral OS temp dir); contract history and sequence numbering will not
  reliably survive across requests/deployments in production without an external store. See
  `PROJECT_REPORT.md` § Vercel deployment before relying on this in production.

## Conventions

- No comments beyond what's already there unless documenting a genuinely non-obvious constraint
  (e.g. the round-half-up note in `salary.ts`).
- Do not add a database, auth layer, or feature flags — the project's stated goal is zero
  infrastructure beyond flat files + a public Google Sheet.
- Template edits: back up `templates/*.docx` to `BACKUP/<date>/` before changing them (per the
  original project plan) — template structure is fragile against the XML-level string
  replacements in `lib/template.ts`.
