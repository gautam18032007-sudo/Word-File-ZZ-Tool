import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import chromium from "@sparticuz/chromium";

export const maxDuration = 60;

export async function GET() {
  // @sparticuz/chromium is ESM-only, so we can't require.resolve() its package.json
  // from this CJS-compiled route. Guess the conventional node_modules location instead
  // (matches how the package's own getBinPath() resolves at runtime) purely for the
  // fs listing below; the executablePath() call is the authoritative check.
  const guessedBinDir = path.join(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin");

  let binDirExists = false;
  let binDirFiles: string[] = [];
  try {
    binDirExists = fs.existsSync(guessedBinDir);
    if (binDirExists) binDirFiles = fs.readdirSync(guessedBinDir);
  } catch {
    // ignore, reported via binDirExists/binDirFiles staying empty
  }

  let executablePath: string | null = null;
  let launchError: string | null = null;
  try {
    executablePath = await chromium.executablePath();
  } catch (err) {
    launchError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    cwd: process.cwd(),
    guessedBinDir,
    binDirExists,
    binDirFiles,
    executablePath,
    launchError,
  });
}
