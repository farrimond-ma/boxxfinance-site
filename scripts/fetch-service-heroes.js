// Fetches a service-appropriate hero image from Pexels for each funding-solutions
// service page and saves as public/images/hero/service-<slug>.webp. The old
// /images/services/*.jpg paths never existed (heroes fell back to navy).
// Run via the fetch-hero-images workflow (PEXELS_API_KEY secret).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
// Shared UK-vs-US photo filter, originally built for the news pipeline after
// "UK residential property" kept returning American apartment blocks — a
// single "UK <subject>" string barely constrains Pexels, which is US-heavy.
// This script had the same single-query, currency-symbol-only weakness, and
// buy-to-let-refinance's own query ("apartment building exterior") is exactly
// the shape that already caused that failure once on the blog-post pipeline
// (2026-09-07/08) — hardened here before it does the same thing to a live
// service page hero. See scripts/content-engine/lib/news-images.js.
import { fetchPexelsImage } from './content-engine/lib/news-images.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'images', 'hero');

// Service → several landscape query variants, tried in order until one
// returns a UK-tagged, non-US result. Chosen to read clearly when blended
// behind the navy hero gradient (wide, concrete subjects — not close-ups).
const SERVICE_QUERIES = {
    'asset-finance': ['industrial machinery factory equipment', 'British factory warehouse equipment', 'UK haulage lorry depot'],
    'structured-finance': ['London city financial district skyline', 'City of London skyline', 'London Canary Wharf skyline'],
    'invoice-finance': ['British business office paperwork desk', 'UK office desk invoice', 'UK small business owner desk'],
    'business-loans': ['UK small business shop owner', 'British shop owner storefront', 'UK small business owner desk'],
    'commercial-mortgages': ['UK commercial building office exterior', 'British high street shopfront', 'London office building exterior'],
    'asset-refinance': ['British commercial trucks fleet lorry', 'UK haulage lorry depot', 'UK warehouse logistics'],
    'merchant-cash-advance': ['British retail shop card payment counter', 'UK high street shop till', 'UK small business owner shop'],
    'trade-finance': ['British shipping port containers logistics', 'UK warehouse logistics', 'UK port shipping containers'],
    'tax-vat-funding': ['British accountant calculator financial documents', 'UK office desk paperwork', 'UK small business owner desk'],
    'working-capital': ['British business team office meeting growth', 'UK small business owner shop', 'British office team meeting'],
    'development-finance': ['UK construction site building development crane', 'British building site scaffolding', 'UK new build houses construction'],
    'buy-to-let-refinance': ['British terraced houses street', 'Victorian terraced houses London', 'UK semi detached houses'],
    'bad-credit-mortgages': ['UK suburban semi detached houses', 'British terraced houses street', 'English suburban street houses'],
    'second-charge-mortgages': ['UK terraced houses residential street', 'British semi detached houses street', 'English brick townhouses'],
    'secured-loans': ['UK detached house exterior driveway', 'British semi detached house', 'English suburban houses'],
    // bridging-finance intentionally omitted — it uses the property pool
};

// Existing images are left alone by default, so adding a service to the map
// above and re-running fills only the gap rather than reshuffling every hero
// on the site. Pass --force to deliberately refresh the lot.
const FORCE = process.argv.includes('--force');

if (!process.env.PEXELS_API_KEY) {
    console.error('PEXELS_API_KEY not set — run via the fetch-hero-images workflow.');
    process.exit(1);
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const credits = [];
    const usedPhotoIds = new Set();
    for (const [slug, queries] of Object.entries(SERVICE_QUERIES)) {
        const out = path.join(OUT_DIR, `service-${slug}.webp`);
        if (!FORCE && fs.existsSync(out)) { console.log(`  service-${slug}.webp  already present, skipped`); continue; }
        const result = await fetchPexelsImage(queries, usedPhotoIds);
        if (!result) { console.warn(`  no usable image for ${slug}`); continue; }
        usedPhotoIds.add(result.photoId);
        await sharp(result.buffer).resize(1600, 1000, { fit: 'cover' }).webp({ quality: 80 }).toFile(out);
        credits.push(`service-${slug}: ${result.photographer} — ${result.url}`);
        console.log(`  service-${slug}.webp  ${Math.round(fs.statSync(out).size / 1024)}KB`);
    }
    // Merge rather than overwrite — a skipped image still needs its existing
    // attribution kept, or we would be using Pexels photos uncredited.
    const creditsPath = path.join(OUT_DIR, 'CREDITS-services.txt');
    const byService = new Map();
    if (fs.existsSync(creditsPath)) {
        for (const line of fs.readFileSync(creditsPath, 'utf8').split('\n')) {
            const m = line.match(/^(service-[a-z0-9-]+):/);
            if (m) byService.set(m[1], line);
        }
    }
    for (const line of credits) byService.set(line.split(':')[0], line);
    const merged = [...byService.values()].sort();
    fs.writeFileSync(creditsPath, `Pexels service hero images (free licence)\n\n${merged.join('\n')}\n`);
    console.log(`\nDone — ${credits.length} service images.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
