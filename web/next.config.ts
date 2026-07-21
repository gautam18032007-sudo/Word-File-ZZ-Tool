import type { NextConfig } from "next";
import path from "path";

// Load .env from project root (one level above web/)
// We use a startup check in lib files via process.env directly after dotenv.config
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  env: {
    // These are read from the parent .env at build/dev time via the instrumentation hook
  },
  serverExternalPackages: ["pizzip", "googleapis", "puppeteer-core", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
