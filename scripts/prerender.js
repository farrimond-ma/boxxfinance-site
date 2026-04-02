import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const dataPath = path.join(rootDir, 'src', 'data', 'blogPosts.json');

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

      if (!fs.existsSync(filePath)) {
        filePath = path.join(distDir, 'index.html');
      }

      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': mimeType(filePath) });
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
    (minCards) => {
      return document.querySelectorAll('.blog-card').length >= minCards;
    },
    { timeout: 15000 },
    expectedMinimumCards
  );
}

async function waitForArticlePage(page) {
  await page.waitForSelector('.blog-post-content', {
    timeout: 15000
  });
}

async function renderRoute(browser, route, options = {}) {
  const {
    isArticleRoute = false,
    isInsightsRoute = false,
    expectedMinimumCards = 2
  } = options;

  const page = await browser.newPage();

  await page.goto(`http://127.0.0.1:${PORT}${route}`, {
    waitUntil: 'networkidle0',
    timeout: 120000
  });

  if (isInsightsRoute) {
    await waitForInsightsPage(page, expectedMinimumCards);
  }

  if (isArticleRoute) {
    await waitForArticlePage(page);
  }

  // Small extra wait to let React fully settle before capturing
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
  }

  if (isInsightsRoute) {
    const cardMatches = html.match(/class="blog-card"/g) || [];
    if (cardMatches.length < expectedMinimumCards) {
      throw new Error(
        `Prerender failed for ${route}: only ${cardMatches.length} blog cards were rendered, expected at least ${expectedMinimumCards}.`
      );
    }
  }

  await page.close();

  const cleanRoute = route.startsWith('/') ? route.slice(1) : route;
  const outputDir = cleanRoute ? path.join(distDir, cleanRoute) : distDir;
  ensureDir(outputDir);

  const outputPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(outputPath, html, 'utf8');

  console.log(`Prerendered: ${route} -> ${outputPath}`);
}

async function main() {
  if (!fs.existsSync(distDir)) {
    throw new Error(`dist folder not found at ${distDir}`);
  }

  if (!fs.existsSync(dataPath)) {
    throw new Error(`blogPosts.json not found at ${dataPath}`);
  }

  const blogPosts = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const publishedPosts = blogPosts.filter((post) => post.status === 'published');

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_BIN ||
    undefined;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--single-process'
    ]
  });

  const server = await startStaticServer();

  try {
    await renderRoute(browser, '/');
    await renderRoute(browser, '/insights', {
      isInsightsRoute: true,
      expectedMinimumCards: Math.min(2, publishedPosts.length || 1)
    });

    for (const post of publishedPosts) {
      if (post?.slug) {
        await renderRoute(browser, `/insights/${post.slug}`, {
          isArticleRoute: true
        });
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
