import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const blogDataPath = path.join(rootDir, 'src', 'data', 'blogPosts.json');
const locationDataPath = path.join(rootDir, 'src', 'data', 'locationPages.json');

const PORT = 4173;

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  };
  return map[ext] || 'application/octet-stream';
}

function startStaticServer() {
  // Snapshot the neutral, pre-prerender index.html ONCE, in memory, before any
  // route is rendered. The SPA-fallback below must always serve this — never
  // re-read dist/index.html from disk — because route '/' overwrites that file
  // on disk with the homepage's own fully-rendered snapshot (baked-in title,
  // meta, canonical). If the fallback re-read the file, every route processed
  // after '/' would hydrate on top of the homepage's tags instead of an empty
  // shell, leaving both sets in <head> — the exact duplicate title/meta/
  // canonical bug this file exists to prevent.
  const shellHtml = fs.readFileSync(path.join(distDir, 'index.html'));

  const server = http.createServer((req, res) => {
    try {
      let reqPath = decodeURIComponent((req.url || '/').split('?')[0]);

      if (reqPath === '/') {
        reqPath = '/index.html';
      }

      let filePath = path.join(distDir, reqPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      // Content-Type must be computed from what's ACTUALLY being served, not the
      // originally-requested path — when falling back to shellHtml, filePath is
      // still e.g. '/funding-solutions' (no extension), so mimeType() returned
      // 'application/octet-stream'. Chrome refuses to render an HTML navigation
      // served as octet-stream and aborts it (net::ERR_ABORTED), which is why
      // every route after '/' failed to prerender once this fallback was added.
      const usingShell = !fs.existsSync(filePath);
      const data = usingShell ? shellHtml : fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': usingShell ? 'text/html; charset=utf-8' : mimeType(filePath) });
      res.end(data);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Server error: ${err.message}`);
    }
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => resolve(server));
  });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function waitForInsightsPage(page, expectedMinimumCards = 2) {
  await page.waitForSelector('.blog-card', {
    timeout: 15000
  });

  await page.waitForFunction(
    (minCards) => document.querySelectorAll('.blog-card').length >= minCards,
    { timeout: 15000 },
    expectedMinimumCards
  );
}

async function waitForArticlePage(page) {
  await page.waitForSelector('.blog-post-content', {
    timeout: 15000
  });
}

async function waitForCountyPage(page) {
  await page.waitForSelector('[data-page-type="county-page"]', {
    timeout: 15000
  });
}

async function waitForLocationPage(page) {
  await page.waitForSelector('[data-page-type="location-page"]', {
    timeout: 15000
  });
}

async function renderRoute(browser, route, options = {}) {
  const {
    isArticleRoute = false,
    isInsightsRoute = false,
    isLocationRoute = false,
    isCountyRoute = false,
    expectedMinimumCards = 2,
    expectedTitle = ''
  } = options;

  const page = await browser.newPage();

  await page.goto(`http://127.0.0.1:${PORT}${route}`, {
    waitUntil: 'networkidle0',
    timeout: 120000
  });

  if (isInsightsRoute) {
    await waitForInsightsPage(page, expectedMinimumCards);
  }

  if (isCountyRoute) {
    await waitForCountyPage(page);
  }

  if (isArticleRoute) {
    await waitForArticlePage(page);
  }

  if (isLocationRoute) {
    await waitForLocationPage(page);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const finalUrl = page.url();
  const html = await page.content();

  if (isArticleRoute) {
    if (
      finalUrl.endsWith('/insights') ||
      finalUrl.endsWith('/insights/') ||
      finalUrl.endsWith('/') ||
      finalUrl === `http://127.0.0.1:${PORT}/`
    ) {
      throw new Error(`Prerender failed for ${route}: page redirected to ${finalUrl}`);
    }

    if (!html.includes('blog-post-content')) {
      throw new Error(`Prerender failed for ${route}: rendered HTML does not contain the article content container.`);
    }

    if (html.includes('Article Not Found')) {
      throw new Error(`Prerender failed for ${route}: rendered the Article Not Found page.`);
    }

    // Guard against silent SEO regressions — every article must carry
    // JSON-LD schema and OpenGraph tags in its static HTML.
    if (!html.includes('application/ld+json')) {
      throw new Error(`Prerender failed for ${route}: no JSON-LD schema in rendered HTML.`);
    }
    if (!html.includes('og:title')) {
      throw new Error(`Prerender failed for ${route}: no OpenGraph tags in rendered HTML.`);
    }
  }

  if (isInsightsRoute) {
    const cardMatches = html.match(/class="blog-card"/g) || [];
    if (cardMatches.length < expectedMinimumCards) {
      throw new Error(
        `Prerender failed for ${route}: only ${cardMatches.length} blog cards were rendered, expected at least ${expectedMinimumCards}.`
      );
    }
  }

  if (isLocationRoute) {
    if (finalUrl !== `http://127.0.0.1:${PORT}${route}`) {
      throw new Error(`Prerender failed for ${route}: page redirected to ${finalUrl}`);
    }

    if (html.includes('data-page-type="location-not-found"')) {
      throw new Error(`Prerender failed for ${route}: rendered the not found location page.`);
    }

    if (!html.includes('data-page-type="location-page"')) {
      throw new Error(`Prerender failed for ${route}: location page container not found.`);
    }

    if (expectedTitle) {
      // React HTML-encodes special chars (& → &amp;, etc.) so check both raw and encoded forms
      const encodedTitle = expectedTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (!html.includes(expectedTitle) && !html.includes(encodedTitle)) {
        throw new Error(`Prerender failed for ${route}: expected title "${expectedTitle}" was not found in HTML.`);
      }
    }
  }

  if (isCountyRoute) {
    if (finalUrl !== `http://127.0.0.1:${PORT}${route}`) {
      throw new Error(`Prerender failed for ${route}: page redirected to ${finalUrl}`);
    }

    if (html.includes('data-page-type="county-not-found"')) {
      throw new Error(`Prerender failed for ${route}: rendered the not found county page.`);
    }

    if (!html.includes('data-page-type="county-page"')) {
      throw new Error(`Prerender failed for ${route}: county page container not found.`);
    }
  }

  await page.close();

  let outputPath;

  if (route === '/') {
    outputPath = path.join(distDir, 'index.html');
  } else if (isLocationRoute) {
    const cleanRoute = route.startsWith('/') ? route.slice(1) : route;
    outputPath = path.join(distDir, `${cleanRoute}.html`);
    ensureDir(path.dirname(outputPath));
  } else {
    const cleanRoute = route.startsWith('/') ? route.slice(1) : route;
    const outputDir = path.join(distDir, cleanRoute);
    ensureDir(outputDir);
    outputPath = path.join(outputDir, 'index.html');
  }

  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`Prerendered: ${route} -> ${outputPath}`);
}

// ─── Route discovery ─────────────────────────────────────────────────────────
// The sitemap is the single source of truth for what the site publishes, so it
// is also the single source of truth for what gets prerendered.
//
// This used to be a hand-written list of four route shapes, and it silently
// rotted: the 12 service pages, the funding-solutions hub, the SME index and the
// legal pages were all added to the site and never prerendered, so any crawler
// that does not execute JavaScript (most AI answer engines) saw an empty React
// shell. Deriving from the sitemap means every new page type is covered
// automatically, and the completeness check in main() fails the build if any
// sitemap URL does not produce HTML.
//
// Requires `npm run sitemap` to have run first — see the build script order.
function readSitemapRoutes() {
  const candidates = [
    path.join(distDir, 'sitemap.xml'),
    path.resolve(__dirname, '../public/sitemap.xml'),
  ];
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) {
    throw new Error(
      `sitemap.xml not found (looked in: ${candidates.join(', ')}). ` +
      `Run "npm run sitemap" before "npm run prerender".`
    );
  }

  const xml = fs.readFileSync(file, 'utf8');
  const routes = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map((m) => m[1].trim().replace(/^https?:\/\/[^/]+/, ''))
    .map((r) => (r === '' ? '/' : r))
    .filter((r) => r.startsWith('/'));

  const unique = [...new Set(routes)];
  if (unique.length === 0) {
    throw new Error(`No <loc> entries found in ${file} — refusing to prerender nothing.`);
  }
  return unique;
}

// Per-route-shape assertions. Anything without a specific shape still renders,
// it just has no extra content assertions beyond the render succeeding.
function optionsForRoute(route, ctx) {
  if (route === '/insights') {
    return { isInsightsRoute: true, expectedMinimumCards: Math.min(2, ctx.publishedPostCount || 1) };
  }
  if (route.startsWith('/insights/')) {
    return { isArticleRoute: true };
  }
  if (route.startsWith('/locations/county/')) {
    return { isCountyRoute: true };
  }
  if (route.startsWith('/locations/')) {
    const slug = route.slice('/locations/'.length);
    return { isLocationRoute: true, expectedTitle: ctx.locationTitles.get(slug) || '' };
  }
  return {};
}

// Mirrors the output logic in renderRoute so main() can verify every route
// actually produced a file on disk.
function outputPathForRoute(route) {
  if (route === '/') return path.join(distDir, 'index.html');
  const clean = route.replace(/^\//, '');
  // /locations/county/<slug> renders as a directory (like most routes) —
  // only flat town-level /locations/<slug> routes use the .html-file shape.
  if (route.startsWith('/locations/') && !route.startsWith('/locations/county/')) {
    return path.join(distDir, `${clean}.html`);
  }
  return path.join(distDir, clean, 'index.html');
}

async function main() {
  if (!fs.existsSync(distDir)) {
    throw new Error(`dist folder not found at ${distDir}`);
  }

  if (!fs.existsSync(blogDataPath)) {
    throw new Error(`blogPosts.json not found at ${blogDataPath}`);
  }

  if (!fs.existsSync(locationDataPath)) {
    throw new Error(`locationPages.json not found at ${locationDataPath}`);
  }

  const blogPosts = JSON.parse(fs.readFileSync(blogDataPath, 'utf8'));
  const publishedPosts = blogPosts.filter((post) => post.status === 'published');

  const locationPages = JSON.parse(fs.readFileSync(locationDataPath, 'utf8'));
  const publishedLocationPages = locationPages.filter((page) => page.status === 'published');

  const routes = readSitemapRoutes();

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_BIN ||
    undefined;

  // --single-process/--no-zygote are needed for CI containers but are
  // unsupported on Windows (Chrome crashes with "frame was detached")
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: process.platform === 'win32'
      ? ['--disable-gpu']
      : [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--single-process'
        ]
  });

  const server = await startStaticServer();

  const ctx = {
    publishedPostCount: publishedPosts.length,
    locationTitles: new Map(
      publishedLocationPages.filter((p) => p?.slug).map((p) => [p.slug, p.title])
    ),
  };

  console.log(`Prerendering ${routes.length} routes discovered from the sitemap...\n`);

  try {
    for (const route of routes) {
      await renderRoute(browser, route, optionsForRoute(route, ctx));
    }
  } finally {
    await browser.close();
    server.close();
  }

  // Completeness gate — this is what stops the route list rotting again.
  // Every URL we tell Google about in the sitemap must exist as real HTML on
  // disk. If a new page type is added and somehow doesn't render, the BUILD
  // FAILS here rather than quietly shipping a JS-only page to crawlers.
  const missing = routes.filter((r) => !fs.existsSync(outputPathForRoute(r)));
  if (missing.length > 0) {
    throw new Error(
      `Prerender incomplete — ${missing.length} sitemap route(s) produced no HTML:\n  ` +
      missing.join('\n  ')
    );
  }

  console.log(`\n✅ All ${routes.length} sitemap routes prerendered — every URL in the sitemap is real HTML.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
