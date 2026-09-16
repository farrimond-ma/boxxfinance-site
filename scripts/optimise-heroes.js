/**
 * Boxx Finance — hero image optimiser
 *
 * Hero images are the LCP element on every page type, and they were shipping
 * at 1600px wide / 295-376KB each: mobile LCP 6.4s on Slow 4G. This does two
 * things, both idempotent — re-run it after adding any hero:
 *
 *   1. Caps each hero at 1400px wide, webp q68 (only rewrites if smaller).
 *   2. Writes a <name>-800.webp phone variant next to it (~51KB vs ~146KB),
 *      which the mobile CSS loads via --hero-image-mobile.
 *
 * Run: node scripts/optimise-heroes.js [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HERO_DIR = path.resolve(__dirname, '../public/images/hero');
const FULL_WIDTH = 1400;
const MOBILE_WIDTH = 800;
const DRY = process.argv.includes('--dry-run');
const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

const isVariant = (f) => f.endsWith(`-${MOBILE_WIDTH}.webp`);

async function main() {
  const files = fs.readdirSync(HERO_DIR).filter((f) => f.endsWith('.webp') && !isVariant(f));
  let shrunk = 0, variants = 0, before = 0, after = 0;

  for (const file of files) {
    const full = path.join(HERO_DIR, file);
    // Read to a buffer first: sharp holds the source file open, so writing
    // back to the same path mid-pipeline fails on Windows.
    const input = fs.readFileSync(full);
    before += input.length;

    const meta = await sharp(input).metadata();
    // Only touch oversized files. Re-encoding an already-optimised webp saves
    // a few percent every run by throwing away a little more quality each
    // time, so "already 1400px or less" means leave it alone.
    const resized = meta.width > FULL_WIDTH
      ? await sharp(input).resize({ width: FULL_WIDTH }).webp({ quality: 68 }).toBuffer()
      : input;

    if (resized !== input && resized.length < input.length) {
      if (!DRY) fs.writeFileSync(full, resized);
      console.log(`  ${file}: ${kb(input.length)} -> ${kb(resized.length)}`);
      shrunk++;
      after += resized.length;
    } else {
      after += input.length;
    }

    const mobilePath = path.join(HERO_DIR, file.replace(/\.webp$/i, `-${MOBILE_WIDTH}.webp`));
    if (!fs.existsSync(mobilePath)) {
      const mobile = await sharp(input)
        .resize({ width: MOBILE_WIDTH, withoutEnlargement: true })
        .webp({ quality: 66 })
        .toBuffer();
      if (!DRY) fs.writeFileSync(mobilePath, mobile);
      console.log(`  + ${path.basename(mobilePath)} (${kb(mobile.length)})`);
      variants++;
    }
  }

  console.log(`\n${files.length} heroes | ${shrunk} shrunk (${kb(before)} -> ${kb(after)}) | ${variants} mobile variants created`);
  if (DRY) console.log('(dry run — nothing written)');
}

main().catch((err) => { console.error('Failed:', err.message); process.exit(1); });
