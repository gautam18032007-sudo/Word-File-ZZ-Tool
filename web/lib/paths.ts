/**
 * Writable-directory resolution — local dev vs. serverless (Vercel).
 *
 * Locally, output/logs live one level above web/ (repo root) so they survive
 * `next build` cleans and are shared with the legacy folder layout.
 *
 * On Vercel, the deployed filesystem is read-only except /tmp, and /tmp is
 * wiped between invocations/cold starts — so contract history, sequence
 * counters, and generated files do NOT persist across requests there. This
 * only prevents crashes (ENOENT/EROFS); it does not make history durable in
 * production. Durable storage on Vercel needs an external store (e.g. Vercel
 * Blob/KV/Postgres) wired in separately.
 */
import os from 'os';
import path from 'path';

const isServerless = !!process.env.VERCEL;

export function writableDir(subpath: string): string {
  return isServerless
    ? path.join(os.tmpdir(), 'contract-tool', subpath)
    : path.resolve(process.cwd(), '..', subpath);
}
