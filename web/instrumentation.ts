/**
 * Next.js Instrumentation Hook — runs once on server startup.
 * Loads the project root .env (one directory above web/) so all
 * API routes can read GOOGLE_BRAND_SHEET_ID, LIBREOFFICE_PATH, etc.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ default: dotenv }, { default: path }] = await Promise.all([
      import("dotenv"),
      import("path"),
    ]);
    dotenv.config({ path: path.resolve(process.cwd(), "../.env"), override: false });
  }
}
