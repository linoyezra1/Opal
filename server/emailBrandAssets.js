import { candidateServerAssetPaths, readFirstExistingFile } from './repoAssets.js';

/** Mirrors `src/NEW/components/email/*` brand tokens */
export const OPAL_BLUE = '#1A365D';
export const OPAL_GOLD = '#C5A059';

/**
 * Logo for inline email `<img src="...">` — read from `server/assets/branding/opal-logo.jpeg`
 * (deployed with the API on Railway). Falls back to empty string if missing.
 */
export async function getOpalLogoDataUriForEmail() {
  const candidates = candidateServerAssetPaths('branding', 'opal-logo.jpeg');
  try {
    const { buffer } = await readFirstExistingFile(candidates, 'opal-logo.jpeg');
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch {
    return '';
  }
}
