# Gotenberg Deployment Guide (Vercel PDF Conversion Layer)

Gotenberg is an open-source Docker microservice that provides a REST API for converting Office documents (`.docx`, `.xlsx`) to PDF using headless LibreOffice.

Deploying Gotenberg to a cloud provider (Render, Railway, Fly.io, or Docker) enables **100% exact LibreOffice PDF conversion on Vercel** without needing local software or custom HTML templates.

---

## Option 1: Deploy on Render.com (Recommended Free/Easy Option)

1. Sign up or log in at **[render.com](https://render.com)**.
2. Click **New +** $\rightarrow$ Select **Web Service**.
3. Select **Deploy an existing image from a registry**.
4. Enter Image URL: `gotenberg/gotenberg:8`
5. Click **Next**.
6. Set the service details:
   - **Name**: `gotenberg-pdf-service`
   - **Region**: Choose closest to your Vercel deployment region (e.g. Singapore, Frankfurt, Oregon)
   - **Instance Type**: Free tier or Starter ($7/mo)
7. Under **Advanced** $\rightarrow$ **Environment Variables**:
   - Port is automatically set by Gotenberg (8000).
8. Click **Create Web Service**.
9. Once deployed, Render will provide a public URL:
   `https://gotenberg-pdf-service.onrender.com`

---

## Option 2: Deploy on Railway.app

1. Sign up or log in at **[railway.app](https://railway.app)**.
2. Click **New Project** $\rightarrow$ Select **Deploy from Docker Image**.
3. Enter Docker Image: `gotenberg/gotenberg:8`
4. Click **Deploy**.
5. Once created, click on the service $\rightarrow$ **Settings** $\rightarrow$ **Networking** $\rightarrow$ **Generate Domain**.
6. Railway will provide a public URL:
   `https://gotenberg-production-xxxx.up.railway.app`

---

## Option 3: Deploy on Fly.io

1. Install Fly CLI and log in: `flyctl auth login`
2. Launch app: `fly launch --image gotenberg/gotenberg:8`
3. Set port in `fly.toml` to 8000:
   ```toml
   [http_service]
     internal_port = 8000
     force_https = true
   ```
4. Deploy: `fly deploy`
5. Your Gotenberg URL will be: `https://your-app-name.fly.dev`

---

## Setting the Environment Variable on Vercel

Once your Gotenberg service is live, copy the URL and set it in Vercel:

1. Go to **Vercel Dashboard** $\rightarrow$ Your Project $\rightarrow$ **Settings** $\rightarrow$ **Environment Variables**.
2. Key: `GOTENBERG_URL`
3. Value: `https://your-gotenberg-instance.onrender.com` (do not include trailing slash `/`).
4. Click **Save** and redeploy the project.
