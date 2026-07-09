// Fetches a service-appropriate hero image from Pexels for each funding-solutions
// service page and saves as public/images/hero/service-<slug>.webp. The old
// /images/services/*.jpg paths never existed (heroes fell back to navy).
// Run via the fetch-hero-images workflow (PEXELS_API_KEY secret).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'images', 'hero');
const API_KEY = process.env.PEXELS_API_KEY;

// Service → landscape image search. Chosen to read clearly when blended behind
// the navy hero gradient (wide, concrete subjects — not close-ups).
const SERVICE_QUERIES = {
    'asset-finance': 'industrial machinery factory equipment',
    'structured-finance': 'london city financial district skyline',
    'invoice-finance': 'business office paperwork desk',
    'business-loans': 'uk small business shop owner',
    'commercial-mortgages': 'uk commercial building office exterior',
    'asset-refinance': 'commercial trucks fleet lorry',
    'merchant-cash-advance': 'retail shop card payment counter',
    'trade-finance': 'shipping port containers logistics',
    'tax-vat-funding': 'accountant calculator financial documents',
    'working-capital': 'business team office meeting growth',
    'development-finance': 'construction site building development crane',
    // bridging-finance intentionally omitted — it uses the property pool
};

if (!API_KEY) {
    console.error('PEXELS_API_KEY not set — run via the fetch-hero-images workflow.');
    process.exit(1);
}

async function fetchOne(query) {
    const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&size=large`,
        { headers: { Authorization: API_KEY } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photo = (data.photos || []).find((p) => !/\$|dollar|euro/.test((p.alt || '').toLowerCase())) || (data.photos || [])[0];
    if (!photo) return null;
    const imgRes = await fetch(photo.src.large2x || photo.src.large);
    if (!imgRes.ok) return null;
    return { buf: Buffer.from(await imgRes.arrayBuffer()), photo };
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const credits = [];
    for (const [slug, query] of Object.entries(SERVICE_QUERIES)) {
        const out = path.join(OUT_DIR, `service-${slug}.webp`);
        const r = await fetchOne(query);
        if (!r) { console.warn(`  no image for ${slug}`); continue; }
        await sharp(r.buf).resize(1600, 1000, { fit: 'cover' }).webp({ quality: 80 }).toFile(out);
        credits.push(`service-${slug}: ${r.photo.photographer} — ${r.photo.url}`);
        console.log(`  service-${slug}.webp  ${Math.round(fs.statSync(out).size / 1024)}KB`);
    }
    const creditsPath = path.join(OUT_DIR, 'CREDITS-services.txt');
    fs.writeFileSync(creditsPath, `Pexels service hero images (free licence)\n\n${credits.join('\n')}\n`);
    console.log(`\nDone — ${credits.length} service images.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
