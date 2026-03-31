import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { spawn, execSync } from 'child_process';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, '../dist');

// ── Kill any lingering vite preview processes ──────────────────────────────
const killOrphanedServers = () => {
    try {
        execSync('taskkill /f /im node.exe /fi "WINDOWTITLE eq vite*"', { stdio: 'ignore' });
    } catch (_) { }
    // Aggressively free ports 4173-4190
    for (let p = 4173; p <= 4190; p++) {
        try {
            execSync(`for /f "tokens=5" %a in ('netstat -aon ^| findstr :${p}') do taskkill /f /pid %a`, { stdio: 'ignore', shell: true });
        } catch (_) { }
    }
};

// ── Find a free port ───────────────────────────────────────────────────────
const findFreePort = (start = 4173) => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(start, () => {
        const { port } = server.address();
        server.close(() => resolve(port));
    });
    server.on('error', () => findFreePort(start + 1).then(resolve).catch(reject));
});

// ── Route helpers ──────────────────────────────────────────────────────────
const getServiceSlugs = () => {
    try {
        const content = fs.readFileSync(path.join(__dirname, '../src/data/services.jsx'), 'utf8');
        const slugs = [];
        const lines = content.split('\n');
        let inside = false;
        for (const line of lines) {
            if (line.includes('export const serviceContent = {')) { inside = true; continue; }
            if (inside && line.trim() === '};') { inside = false; break; }
            if (inside) {
                const m = line.match(/^ {4}['"]?([a-zA-Z0-9-]+)['"]?:\s*\{/);
                if (m) slugs.push(m[1]);
            }
        }
        return slugs;
    } catch (e) { console.warn('Could not read services.jsx', e); return []; }
};

const getSmeFundingSlugs = () => {
    try {
        const content = fs.readFileSync(path.join(__dirname, '../src/data/smeFundingData.json'), 'utf8');
        const smeData = JSON.parse(content);
        return smeData.map(item => item.slug).filter(slug => slug !== 'latest');
    } catch (e) {
        console.warn('Could not read smeFundingData.json', e);
        return [];
    }
};

const getBlogSlugs = () => {
    try {
        const content = fs.readFileSync(path.join(__dirname, '../src/data/blogPosts.json'), 'utf8');
        const blogPosts = JSON.parse(content);
        const slugs = [];
        const now = new Date();

        for (const post of blogPosts) {
            if (post.status === 'published' || (post.publishDate && new Date(post.publishDate) <= now)) {
                if (post.slug) slugs.push(post.slug);
            }
        }
        return slugs;
    } catch (e) {
        console.warn('Could not read blogPosts.json', e);
        return [];
    }
};

const routes = [
    '/',
    '/insights',
    '/uk-sme-funding-index',
    '/chat-about-funding',
    '/privacy-policy',
    '/legal-disclaimer',
    '/terms-and-conditions',
];
getServiceSlugs().forEach(s => routes.push(`/funding-solutions/${s}`));
getBlogSlugs().forEach(s => routes.push(`/insights/${s}`));
getSmeFundingSlugs().forEach(s => routes.push(`/uk-sme-funding-index/${s}`));

// ── Start preview server on a known free port ──────────────────────────────
const startServer = async (port) => {
    return new Promise((resolve, reject) => {
        const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
            cwd: path.join(__dirname, '..'),
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
            windowsHide: true,
        });

        let ready = false;
        const onData = (data) => {
            if (!ready && data.toString().includes('localhost')) {
                ready = true;
                resolve(server);
            }
        };
        server.stdout.on('data', onData);
        server.stderr.on('data', onData);

        setTimeout(() => {
            if (!ready) { ready = true; resolve(server); }
        }, 8000);

        server.on('error', reject);
    });
};

// ── Main prerender ─────────────────────────────────────────────────────────
const prerender = async () => {
    console.log('\n🔧 Killing any orphaned preview servers...');
    killOrphanedServers();
    await new Promise(r => setTimeout(r, 1000));

    const port = await findFreePort(4173);
    console.log(`🚀 Starting preview server on port ${port}...`);
    const serverProcess = await startServer(port);
    const BASE_URL = `http://localhost:${port}`;

    console.log(`✅ Server ready at ${BASE_URL}\n`);

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    for (const route of routes) {
        process.stdout.write(`   Prerendering: ${route} ...`);
        try {
            await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle0', timeout: 30000 });
            try { await page.waitForSelector('#root', { timeout: 5000 }); } catch (_) { }

            const html = await page.content();
            const filePath = route === '/'
                ? path.join(DIST_DIR, 'index.html')
                : path.join(DIST_DIR, route, 'index.html');

            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, html);
            process.stdout.write(' ✓\n');
        } catch (err) {
            process.stdout.write(` ✗ ${err.message}\n`);
        }
    }

    await browser.close();
    console.log('\n✅ Prerendering complete.');

    // Clean kill on Windows
    try { execSync(`taskkill /pid ${serverProcess.pid} /f /t`, { stdio: 'ignore' }); } catch (_) { }
    process.exit(0);
};

prerender().catch(err => { console.error(err); process.exit(1); });
