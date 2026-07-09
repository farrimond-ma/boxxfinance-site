// Fetches a curated pool of UK-property hero images from Pexels for bridging
// pages (bridging = short-term PROPERTY finance, so residential/renovation/
// auction imagery, not generic office scenes). Saves them as webp to
// public/images/hero/bridging-N.webp. Location pages rotate through this pool
// by slug hash. Run via the fetch-hero-images workflow (PEXELS_API_KEY secret).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'images', 'hero');
const API_KEY = process.env.PEXELS_API_KEY;
const TARGET = 8; // pool size

// Property-focused, bridging-appropriate searches (deliberately not "office").
const QUERIES = [
    'UK residential house exterior',
    'house keys property purchase',
    'property renovation refurbishment',
    'new build housing development UK',
    'terraced houses british street',
    'modern house exterior daylight',
    'property under construction renovation',
    'real estate house for sale UK',
];

if (!API_KEY) {
    console.error('PEXELS_API_KEY not set — cannot fetch. Run via the fetch-hero-images workflow.');
    process.exit(1);
}

async function search(query) {
    const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=6&orientation=landscape&size=large`,
        { headers: { Authorization: API_KEY } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    // Skip photos that read as money/office to keep the set on-theme
    return (data.photos || []).filter((p) => {
        const desc = (p.alt || '').toLowerCase();
        return !/\$|dollar|euro|office desk|meeting|laptop|coin|cash/.test(desc);
    });
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const picked = [];
    const seen = new Set();

    for (const q of QUERIES) {
        if (picked.length >= TARGET) break;
        const photos = await search(q);
        const photo = photos.find((p) => !seen.has(p.id));
        if (!photo) continue;
        seen.add(photo.id);
        picked.push(photo);
    }

    if (picked.length === 0) {
        console.error('No suitable photos returned from Pexels.');
        process.exit(1);
    }

    let n = 0;
    for (const photo of picked) {
        n++;
        const imgRes = await fetch(photo.src.large2x || photo.src.large);
        if (!imgRes.ok) { console.warn(`  skip ${n}: download ${imgRes.status}`); continue; }
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const outPath = path.join(OUT_DIR, `bridging-${n}.webp`);
        await sharp(buf).resize(1600, 1000, { fit: 'cover' }).webp({ quality: 80 }).toFile(outPath);
        const kb = Math.round(fs.statSync(outPath).size / 1024);
        console.log(`  bridging-${n}.webp  ${kb}KB  (${photo.alt || 'Pexels'} — ${photo.photographer})`);
    }

    // Record attribution (Pexels licence: attribution appreciated, not required)
    const credits = picked.map((p, i) => `bridging-${i + 1}: ${p.photographer} — ${p.url}`).join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'CREDITS.txt'), `Pexels hero images (free licence)\n\n${credits}\n`);
    console.log(`\nDone — ${n} images in public/images/hero/`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
