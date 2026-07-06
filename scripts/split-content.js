import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Splits the two large content JSONs (source of truth for the content engine —
// do not change their format) into:
//   1. a lightweight index bundled into the SPA (everything except the heavy
//      content/schema fields), and
//   2. one JSON file per published slug under public/content/, fetched by the
//      article/location pages on demand.
// Keeps ~2MB of article HTML out of the client JavaScript bundle.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const SPLITS = [
  {
    source: path.join(rootDir, 'src', 'data', 'blogPosts.json'),
    index: path.join(rootDir, 'src', 'data', 'blogIndex.json'),
    contentDir: path.join(rootDir, 'public', 'content', 'insights'),
    heavyFields: ['content', 'schema'],
  },
  {
    source: path.join(rootDir, 'src', 'data', 'locationPages.json'),
    index: path.join(rootDir, 'src', 'data', 'locationIndex.json'),
    contentDir: path.join(rootDir, 'public', 'content', 'locations'),
    heavyFields: ['content', 'faqSchema'],
  },
];

for (const { source, index, contentDir, heavyFields } of SPLITS) {
  const items = JSON.parse(fs.readFileSync(source, 'utf8'));

  fs.rmSync(contentDir, { recursive: true, force: true });
  fs.mkdirSync(contentDir, { recursive: true });

  const indexItems = items.map((item) => {
    const light = { ...item };
    for (const field of heavyFields) delete light[field];
    return light;
  });

  let written = 0;
  for (const item of items) {
    if (!item || item.status !== 'published') continue;
    const slug = String(item.slug || '');
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) continue; // guard against path escapes
    fs.writeFileSync(path.join(contentDir, `${slug}.json`), JSON.stringify(item));
    written++;
  }

  fs.writeFileSync(index, JSON.stringify(indexItems));
  console.log(
    `${path.basename(source)}: ${indexItems.length} items in index, ` +
    `${written} content files -> ${path.relative(rootDir, contentDir)}`
  );
}
