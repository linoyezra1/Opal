import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the `server/` directory (this file lives there). */
export const SERVER_DIR = __dirname;

/**
 * Possible project roots: cwd may be repo root (/app) or server (/app/server) locally.
 */
function projectRootCandidates() {
  const cwd = process.cwd();
  return [...new Set([cwd, path.resolve(cwd, '..'), SERVER_DIR, path.resolve(SERVER_DIR, '..')])];
}

/**
 * Candidate absolute paths for `src/assets/<...segments>` (fonts, DOC, etc.).
 */
export function candidateSrcAssetPaths(...segments) {
  const roots = projectRootCandidates();
  return [...new Set(roots.map((root) => path.resolve(root, 'src', 'assets', ...segments)))];
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
 * Writable output dir for generated PDFs (under server/, always writable on Railway).
 */
export function getGeneratedPdfDir() {
  return path.resolve(SERVER_DIR, 'assets', 'generated');
}
