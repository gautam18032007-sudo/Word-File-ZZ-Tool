# Deploying to Vercel — exact steps

The Next.js app lives in `web/`, **not** the repo root. Vercel cannot discover that on its
own — it must be told once via a dashboard setting. Every failed build so far
(`Error: No Next.js version detected...`) has been this one setting.

## 1. One-time project setting (fixes the build error)

1. [vercel.com](https://vercel.com) → open the project → **Settings** → **General**
2. Find **Root Directory** → click **Edit**
3. Type: `web`
4. Leave "Include files outside of the Root Directory" **ON** (default)
5. **Save**

> Why: the repo root's `package.json` is only a local-dev convenience (proxy scripts).
> It has no `next` dependency, so when Root Directory is blank Vercel installs the root
> package, finds no Next.js, and aborts with *"No Next.js version detected. Make sure your
> package.json has 'next' ... check your Root Directory setting."* Setting Root Directory
> to `web` makes Vercel read `web/package.json` (which has `next: 16.2.10`) — zero-config
> from there.

## 2. Environment variables

Settings → **Environment Variables** → add for **Production** (and Preview if you use it):

| Name | Value | Required? |
|---|---|---|
| `GOOGLE_BRAND_SHEET_ID` | `1Gxw2YSeTHNvOsAyYzK13Z_SeZbatlktNoXyzRjTF-yI` | Yes |
| `GOOGLE_EMPLOYEE_SHEET_ID` | `1wyfsP44k3hM3PWMqxeKsaTt7TwuwM4VkPuuauTI9gto` | Yes |
| `CONTRACT_PREFIX` | `ZZ` | No (defaults to `ZZ`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | — | No — **skip it.** Both sheets are shared "Anyone with the link (Viewer)", so the public-CSV path is used and no Google credentials are needed. Only add this if a sheet is ever made private again. |
| `LIBREOFFICE_PATH` | — | **Never set on Vercel.** There is no LibreOffice binary there. |

Full local-dev reference lives in `.env.example`.

## 3. Deploy

- Any `git push` to `main` auto-deploys, **or**
- Deployments tab → latest → **⋯** → **Redeploy** (after changing settings, redeploy is
  required — settings changes alone don't rebuild).

## 4. What works on Vercel vs. locally

| Feature | Local | Vercel |
|---|---|---|
| Load brands/employees from Google Sheets | ✅ | ✅ (public CSV, auto-loads on page open) |
| Generate DOCX | ✅ | ✅ (templates ship inside `web/templates/`) |
| Convert to PDF | ✅ (LibreOffice) | ❌ — `pdfName` returns `null`; download the DOCX. This is by design, not an error. |
| Contract history + sequence numbers | ✅ persistent (`output/`) | ⚠️ **ephemeral** — writes go to the function's temp dir and vanish between cold starts. Numbering can repeat. Needs Vercel Blob/KV if production-grade history is ever required. |

Because of the last two rows, the recommended workflow is: **generate on Vercel, download
the DOCX immediately.** Treat the local machine as the system of record (its `output/`
folder keeps the real history and sequence).

## 5. Data hygiene (important)

This repo is **public** on GitHub. `.env`, `output/` (contract history — employee names,
CTC), and `logs/` are gitignored and have been untracked, but **they exist in old commits'
history**. If that data matters, either make the repo **Private** (GitHub → repo Settings →
General → Danger Zone → Change visibility) or ask for a history purge. Never commit
`output/`, `logs/`, `.env`, or `credentials.json` again — `.gitignore` already blocks them.
