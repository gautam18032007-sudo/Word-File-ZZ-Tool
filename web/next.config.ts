import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  env: {
    // Read from .env at build/dev time
  },
  serverExternalPackages: ["pizzip", "googleapis"],
};

export default nextConfig;
