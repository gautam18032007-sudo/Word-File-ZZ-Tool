import type { NextConfig } from "next";
import path from "path";

// Load .env from project root (one level above web/)
// We use a startup check in lib files via process.env directly after dotenv.config
const nextConfig: NextConfig = {
  env: {
    // These are read from the parent .env at build/dev time via the instrumentation hook
  },
  serverExternalPackages: ["pizzip", "googleapis"],
};

export default nextConfig;
