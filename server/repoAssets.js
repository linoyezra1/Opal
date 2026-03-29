import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the `server/` directory (this file lives there). */
export const SERVER_DIR = __dirname;

/**
 * Candidate paths under `server/assets/<...segments>`.
 * - `path.join(process.cwd(), 'server', 'assets', ...)` — Railway when cwd is repo root (/app)
 * - `path.join(process.cwd(), 'assets', ...)` — when cwd is already `server/`
 * - `path.join(SERVER_DIR, 'assets', ...)` — always relative to this file (robust)
 */
export function candidateServerAssetPaths(...segments) {
  const cwd = process.cwd();
  return [
    ...new Set([
      path.join(cwd, 'server', 'assets', ...segments),
      path.join(cwd, 'assets', ...segments),
      path.join(SERVER_DIR, 'assets', ...segments),
    ]),
  ];
}

/**
 * Static legal PDFs may live in `assets/docs/` or `assets/DOC/` (Windows vs naming).
 */
export function candidateDocPdfPaths(filename) {
  return [
    ...new Set([
      ...candidateServerAssetPaths('docs', filename),
      ...candidateServerAssetPaths('DOC', filename),
    ]),
  ];
}

/**
 * Read the first path that exists. Throws with a helpful message if none match.
 */
export async function readFirstExistingFile(candidates, label = 'asset') {
  const errors = [];
  for (const p of candidates) {
    try {
      const buffer = await fs.readFile(p);
      return { path: p, buffer };
    } catch (e) {
      errors.push(`${p}: ${e?.code || e?.message || e}`);
    }
  }
  throw new Error(`${label} not found. Tried:\n${errors.join('\n')}`);
}

/**
 * Writable output dir for generated PDFs (under server/assets/generated).
 */
export function getGeneratedPdfDir() {
  return path.join(SERVER_DIR, 'assets', 'generated');
}
