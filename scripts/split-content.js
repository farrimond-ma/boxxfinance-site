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
  {
    source: path.join(rootDir, 'src', 'data', 'countyPages.json'),
    index: path.join(rootDir, 'src', 'data', 'countyIndex.json'),
    contentDir: path.join(rootDir, 'public', 'content', 'counties'),
    heavyFields: ['content', 'faqSchema'],
  },
];

// FAQ items must be { '@type': 'Question', name, acceptedAnswer: { '@type':
// 'Answer', text } }: FaqAccordion renders q.name, and Google's FAQPage rich
// result requires exactly that shape. A one-off batch wrote `question` instead
// of `name` on 24 posts (incl. all 20 lender articles, 2026-09-10) and the FAQs
// rendered with blank questions for eight days — nothing failed, so nothing
// noticed. Normalising here means a bad shape in the source data can never
// reach a page again, whichever script or hand edit produced it.
function normaliseFaqSchema(item) {
  const schema = item.schema || item.faqSchema;
  if (!schema || !Array.isArray(schema.mainEntity)) return item;
  const mainEntity = schema.mainEntity
    .map((q) => ({
      '@type': 'Question',
      name: q.name || q.question || '',
      acceptedAnswer: { '@type': 'Answer', text: (q.acceptedAnswer && q.acceptedAnswer.text) || q.answer || '' },
    }))
    .filter((q) => q.name && q.acceptedAnswer.text);
  const fixed = { ...schema, '@type': schema['@type'] || 'FAQPage', mainEntity };
  return item.schema ? { ...item, schema: fixed } : { ...item, faqSchema: fixed };
}

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
    fs.writeFileSync(path.join(contentDir, `${slug}.json`), JSON.stringify(normaliseFaqSchema(item)));
    written++;
  }

  fs.writeFileSync(index, JSON.stringify(indexItems));
  console.log(
    `${path.basename(source)}: ${indexItems.length} items in index, ` +
    `${written} content files -> ${path.relative(rootDir, contentDir)}`
  );
}
