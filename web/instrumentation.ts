/**
 * Next.js Instrumentation Hook — runs once on server startup.
 * Loads the project root .env (one directory above web/) so all
 * API routes can read GOOGLE_BRAND_SHEET_ID, LIBREOFFICE_PATH, etc.
 */
import dotenv from "dotenv";
import path from "path";

export async function register() {
  dotenv.config({ path: path.resolve(process.cwd(), "../.env"), override: false });
}
