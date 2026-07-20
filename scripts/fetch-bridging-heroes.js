// Fetches a curated pool of UK-property hero images from Pexels for bridging
// pages (bridging = short-term PROPERTY finance, so residential/renovation/
// auction imagery, not generic office scenes). Saves them as webp to
// public/images/hero/bridging-N.webp.
//
// 2026-07: expanded from an 8-image pool to ~23. The existing curated images
// (bridging-1..11) are PRESERVED — new images are appended from index 12 up —
// and this script rewrites the HERO_POOL array in heroPool.js to match exactly
// what exists, so the pool can never reference a missing file. The Fetch Hero
// Images workflow commits both the images and heroPool.js together.
//
// Run via the fetch-hero-images workflow (PEXELS_API_KEY secret).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'images', 'hero');
const POOL_FILE = path.resolve(__dirname, '..', 'src', 'components', 'resource', 'heroPool.js');
const API_KEY = process.env.PEXELS_API_KEY;

// Existing curated images to keep (2 and 8 are close-ups, deliberately excluded).
const BASE_INDICES = [1, 3, 4, 5, 6, 7, 9, 10, 11];
const START_INDEX = 12;   // first NEW image index (never overwrites 1..11)
const TARGET_NEW = 14;     // new images to add → ~23 total in the pool
const PER_QUERY = 2;       // how many to take from each search

// Deliberately diverse UK-property searches so the pool doesn't read as samey.
const QUERIES = [
    'Victorian terraced houses UK street',
    'Georgian townhouse London',
    'English countryside cottage',
    'modern new build house UK',
    'semi detached house suburban UK',
    'residential apartment building modern',
    'house renovation scaffolding exterior',
    'coastal houses seaside UK',
    'red brick houses england',
    'detached family home driveway',
    'period property exterior UK',
    'new housing development homes',
    'converted warehouse apartments',
    'country house england',
    'mews houses london',
    'suburban houses street UK',
];

if (!API_KEY) {
    console.error('PEXELS_API_KEY not set — cannot fetch. Run via the fetch-hero-images workflow.');
    process.exit(1);
}

async function search(query) {
    const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape&size=large`,
        { headers: { Authorization: API_KEY } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    // Skip photos that read as money/office to keep the set on-theme.
    return (data.photos || []).filter((p) => {
        const desc = (p.alt || '').toLowerCase();
        return !/\$|dollar|euro|office desk|meeting|laptop|coin|cash|graph|chart/.test(desc);
    });
}

// Rewrite the HERO_POOL array literal in heroPool.js to the exact set of indices
// that exist, so the pool never points at a missing file.
function updatePool(indices) {
    const sorted = [...indices].sort((a, b) => a - b);
    let src = fs.readFileSync(POOL_FILE, 'utf8');
    const arr = `[${sorted.join(', ')}]`;
    const next = src.replace(
        /const HERO_POOL = \[[^\]]*\]\.map/,
        `const HERO_POOL = ${arr}.map`
    );
    if (next === src) {
        console.warn('  Could not find HERO_POOL array in heroPool.js — pool not updated.');
        return;
    }
    fs.writeFileSync(POOL_FILE, next);
    console.log(`  Updated HERO_POOL → ${sorted.length} images: ${arr}`);
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const picked = [];
    const seen = new Set();
    for (const q of QUERIES) {
        if (picked.length >= TARGET_NEW) break;
        const photos = await search(q);
        let takenFromQuery = 0;
        for (const p of photos) {
            if (picked.length >= TARGET_NEW || takenFromQuery >= PER_QUERY) break;
            if (seen.has(p.id)) continue;
            seen.add(p.id);
            picked.push(p);
            takenFromQuery++;
        }
    }

    if (picked.length === 0) {
        console.error('No suitable photos returned from Pexels.');
        process.exit(1);
    }

    const newIndices = [];
    const newCredits = [];
    let idx = START_INDEX;
    for (const photo of picked) {
        const imgRes = await fetch(photo.src.large2x || photo.src.large);
        if (!imgRes.ok) { console.warn(`  skip: download ${imgRes.status}`); continue; }
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const outPath = path.join(OUT_DIR, `bridging-${idx}.webp`);
        await sharp(buf).resize(1600, 1000, { fit: 'cover' }).webp({ quality: 80 }).toFile(outPath);
        const kb = Math.round(fs.statSync(outPath).size / 1024);
        console.log(`  bridging-${idx}.webp  ${kb}KB  (${photo.alt || 'Pexels'} — ${photo.photographer})`);
        newCredits.push(`bridging-${idx}: ${photo.photographer} — ${photo.url}`);
        newIndices.push(idx);
        idx++;
    }

    // Pool = preserved base images + whatever we successfully added.
    updatePool([...BASE_INDICES, ...newIndices]);

    // Append attribution rather than clobbering the existing credits.
    const creditsPath = path.join(OUT_DIR, 'CREDITS.txt');
    const existing = fs.existsSync(creditsPath) ? fs.readFileSync(creditsPath, 'utf8').trimEnd() + '\n' : 'Pexels hero images (free licence)\n\n';
    fs.writeFileSync(creditsPath, existing + newCredits.join('\n') + '\n');

    console.log(`\nDone — added ${newIndices.length} new images (pool now ${BASE_INDICES.length + newIndices.length}).`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
