# Gotenberg Deployment Guide

Gotenberg is an open-source Docker microservice that wraps LibreOffice.
It converts DOCX/XLSX → PDF with the same fidelity as local LibreOffice,
solving the "layout-stripped PDF" problem that occurs when running on Vercel.

---

## How it fits in

```
Vercel (Next.js)
      │
      │  POST /forms/libreoffice/convert
      ▼
Gotenberg container  ←── LibreOffice inside Docker
      │
      │  PDF bytes
      ▼
Vercel route → Blob store → client
```

Your code in `web/lib/gotenbergConvert.ts` and `web/lib/pdfProvider.ts` already
implements this flow perfectly. The only missing piece is a running Gotenberg
instance and the `GOTENBERG_URL` env var.

---

## Option A — Railway (recommended, ~5 min setup)

Railway is the fastest path: push a Docker image, get a public HTTPS URL.

### Steps

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from Docker Image**
2. Image: `gotenberg/gotenberg:8`
3. Click **Deploy**
4. Railway assigns a public URL like `https://your-app.up.railway.app`
5. That's it. No config files needed.

### Verify it's working

```bash
curl -X POST https://your-app.up.railway.app/forms/libreoffice/convert \
  -F "files=@/path/to/any.docx" \
  --output test.pdf
```

If `test.pdf` opens correctly, Gotenberg is healthy.

### Cost

Free tier: 500 hours/month (enough for light use).
Paid: $5/mo for always-on.

---

## Option B — Render

1. [render.com](https://render.com) → **New** → **Web Service**
2. **Deploy from Docker image**
3. Image: `gotenberg/gotenberg:8`
4. Port: `3000`
5. Click **Create Web Service**
6. Render assigns a URL like `https://your-app.onrender.com`

> ⚠️ Free tier on Render spins down after 15 min of inactivity (cold start ~30 s).
> The `pdfProvider.ts` retry logic (3 attempts, exponential backoff) handles this,
> but the first PDF after a cold start may take 30–40 s.
> Upgrade to Starter ($7/mo) for always-on.

---

## Option C — Local Docker (for testing before deploying)

```bash
docker run --rm -p 3001:3000 gotenberg/gotenberg:8
```

Then set in your `.env`:

```env
GOTENBERG_URL=http://localhost:3001
```

Generate a contract and verify the PDF matches the DOCX.

---

## Setting GOTENBERG_URL on Vercel

1. Vercel dashboard → your project → **Settings** → **Environment Variables**
2. Add:
   - Name: `GOTENBERG_URL`
   - Value: `https://your-gotenberg.railway.app` *(no trailing slash)*
   - Environment: **Production** (and Preview if you use it)
3. **Save**
4. Go to **Deployments** → latest → **⋯** → **Redeploy**
   (env var changes require a redeploy to take effect)

---

## Verifying end-to-end on Vercel

After redeploy, generate one employee contract from the live app.
Check Vercel function logs (Functions tab → `/api/generate/employee`).

You should see:

```
[PdfProvider v1.0] Using Gotenberg Docker Service for "ZZ-EMP-..."
[PdfProvider v1.0] Gotenberg conversion attempt 1/3 for "ZZ-EMP-..."
[PdfProvider v1.0] Gotenberg conversion succeeded for "ZZ-EMP-..." in 3200ms (142840 bytes).
```

If you see instead:

```
[PdfProvider v1.0] Neither LibreOffice nor Gotenberg configured.
```

→ `GOTENBERG_URL` is not set or the redeploy hasn't happened yet.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Gotenberg conversion failed with HTTP 400` | Corrupt or password-protected DOCX | Check the template renders correctly locally first |
| `Gotenberg conversion timed out after 45s` | Cold start on Render free tier | Retry or upgrade to always-on plan |
| `GOTENBERG_URL environment variable is not configured` | Env var missing on Vercel | Add it in dashboard + redeploy |
| PDF still looks broken | Using cached pre-Gotenberg deployment | Force redeploy |

---

## Security note

Gotenberg has no authentication by default. Your URL is effectively public.
For a private deployment, Railway and Render both support:
- **Private networking** (Gotenberg reachable only from Vercel via private IP — not applicable for Vercel serverless)
- **Basic auth** via Gotenberg's `--api-enable-basic-auth` flag + `GOTENBERG_API_BASIC_AUTH_USERNAME` / `GOTENBERG_API_BASIC_AUTH_PASSWORD` env vars

For the typical ZenZebra use case (internal tooling, low traffic), the default
open endpoint is acceptable. Add basic auth if the instance is ever exposed
to untrusted networks.
