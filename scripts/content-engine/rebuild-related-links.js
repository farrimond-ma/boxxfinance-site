/**
 * Boxx Finance — rebuild related-article links (and in-body links to keepers)
 *
 * Why this exists: until 2026-09-14 publish-blog.js gave every new post the
 * FIRST THREE published rows in the sheet as its related articles, so three
 * hub posts collected ~150 links each while 225 of 263 published posts had no
 * internal link pointing at them from anywhere. Orphaned pages get little
 * ranking credit however good they are.
 *
 *   1. relatedBlogUrls for every published post are rebuilt from topic
 *      similarity within the same service. RelatedArticles.jsx shows the first
 *      2, so near-ties go to the less-linked candidate to spread links.
 *   2. Guarantee pass: any post still with no visible inbound link is placed in
 *      the second (visible) slot of its closest match — never displacing a link
 *      that is another post's only one.
 *   3. In-body links to the posts other posts were merged into on 2026-09-14:
 *      the first unlinked, in-paragraph mention of the topic in the most similar
 *      bridging posts becomes a link. At most PER_KEEPER sources per keeper and
 *      PER_SOURCE new links per post, never inside headings, bold FAQ questions
 *      or existing links.
 *
 * Deterministic and idempotent: a second run changes nothing.
 * Run: node rebuild-related-links.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { overlapScore, postTokens } = require('./topic-similarity');

const FILE = path.resolve(__dirname, '../../src/data/blogPosts.json');
const SITE = 'https://boxxfinance.co.uk';
const RELATED = 3;
const VISIBLE = 2;
const PER_KEEPER = 8;
const PER_SOURCE = 2;
const DRY = process.argv.includes('--dry-run');

const KEEPER_LINKS = {
  'bridging-loan-interest-options': /\b(?:rolled[- ]up|retained|serviced) interest\b/i,
  'auction-finance-28-days-uk': /\b28[- ]day (?:auction )?(?:completion )?(?:deadline|window|period|timescale)\b/i,
  'how-to-finance-auction-property-uk': /\bauction finance\b/i,
  'commercial-bridging-loan-uk': /\bcommercial bridging (?:loans?|finance)\b/i,
  'bridging-loan-process-timeline': /\bbridging loan (?:application )?(?:process|timeline)\b/i,
  'bridging-loan-maximum-term': /\b(?:maximum|typical) (?:loan )?term\b|\bterm length\b/i,
  'quick-bridging-loan-for-property-uk': /\b(?:quick|fast) bridging (?:loans?|finance)\b/i,
};

const raw = fs.readFileSync(FILE, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const posts = JSON.parse(raw);
const pub = posts.filter(p => p.status === 'published' && p.slug);
const bySlug = new Map(pub.map(p => [p.slug, p]));
const tokens = new Map(pub.map(p => [p.slug, postTokens(p)]));
const sim = (a, b) => overlapScore(tokens.get(a.slug), tokens.get(b.slug));
const url = slug => `${SITE}/insights/${slug}`;
const linksTo = (html, slug) => new RegExp(`/insights/${slug}(?![a-z0-9-])`).test(html || '');

function poolFor(p) {
  const same = pub.filter(q => q.slug !== p.slug && (q.service || '') === (p.service || ''));
  return same.length >= RELATED ? same : pub.filter(q => q.slug !== p.slug);
}

function inboundCounts() {
  const counts = new Map(pub.map(p => [p.slug, 0]));
  for (const p of pub) {
    const seen = new Set();
    for (const u of (p.relatedBlogUrls || []).slice(0, VISIBLE)) seen.add(u.split('/insights/')[1]);
    for (const m of (p.content || '').matchAll(/\/insights\/([a-z0-9-]+)/g)) seen.add(m[1]);
    for (const s of seen) if (s !== p.slug && counts.has(s)) counts.set(s, counts.get(s) + 1);
  }
  return counts;
}
const orphanCount = () => [...inboundCounts().values()].filter(n => n === 0).length;
const orphansBefore = orphanCount();

// ── 1. Related articles by topic ─────────────────────────────────────────────
// VISIBLE_CAP stops a few posts becoming new hubs. Overlap is measured against
// the SHORTER token set, so a post with only a handful of topic words
// ("bridging-finance-for-property-developers": 9, median 15) scores highly
// against nearly everything — uncapped, it took 39 visible slots.
const VISIBLE_CAP = 8;
const visibleIn = new Map(pub.map(p => [p.slug, 0]));
const plan = new Map();
for (const p of pub) {
  const ranked = poolFor(p)
    .map(q => ({ q, s: Math.round(sim(p, q) * 10) }))
    .sort((a, b) => (b.s - a.s) || (visibleIn.get(a.q.slug) - visibleIn.get(b.q.slug)) || String(b.q.date || '').localeCompare(String(a.q.date || '')) || a.q.slug.localeCompare(b.q.slug));
  const shown = ranked.filter(x => visibleIn.get(x.q.slug) < VISIBLE_CAP).slice(0, VISIBLE).map(x => x.q.slug);
  const spare = ranked.map(x => x.q.slug).filter(s => !shown.includes(s)).slice(0, RELATED - shown.length);
  shown.forEach(s => visibleIn.set(s, visibleIn.get(s) + 1));
  plan.set(p.slug, [...shown, ...spare]);
}

// ── 2. Guarantee every post a visible related-article link ──────────────────
for (const o of pub) {
  if (visibleIn.get(o.slug) > 0) continue;
  const hosts = poolFor(o).map(q => ({ q, s: sim(o, q) })).sort((a, b) => (b.s - a.s) || a.q.slug.localeCompare(b.q.slug));
  for (const { q } of hosts) {
    const list = plan.get(q.slug);
    if (list.includes(o.slug)) continue;
    const displaced = list[VISIBLE - 1];
    if (displaced && visibleIn.get(displaced) <= 1) continue;
    list.splice(VISIBLE - 1, 0, o.slug);
    list.length = Math.min(list.length, RELATED);
    if (displaced) visibleIn.set(displaced, visibleIn.get(displaced) - 1);
    visibleIn.set(o.slug, 1);
    break;
  }
}

let relatedChanged = 0;
for (const p of pub) {
  const next = plan.get(p.slug).map(url);
  if (JSON.stringify(p.relatedBlogUrls || []) !== JSON.stringify(next)) { p.relatedBlogUrls = next; relatedChanged++; }
}

// ── 3. In-body links to consolidation keepers ────────────────────────────────
const EXCLUDE = new Set(['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'dt', 'button', 'script', 'style']);
const CONTAINERS = new Set(['p', 'li', 'dd', 'div', 'td', 'section', 'blockquote', 'dl', 'ul', 'ol']);
const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'wbr']);

// The opening paragraph is skipped: a link in the first words of an article
// sends the reader away before they have started (first run linked
// "Auction finance" as word one of auction-finance-28-days-uk).
function linkFirstMention(html, re, href) {
  const parts = String(html).split(/(<[^>]+>)/);
  const stack = [];
  let leadDone = false;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith('<')) {
      const m = part.match(/^<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)/);
      if (!m) continue;
      const name = m[2].toLowerCase();
      if (VOID.has(name) || /\/\s*>$/.test(part)) continue;
      if (m[1]) { const at = stack.lastIndexOf(name); if (at !== -1) stack.splice(at); if (name === 'p') leadDone = true; }
      else stack.push(name);
      continue;
    }
    if (!leadDone || !part.trim() || stack.some(t => EXCLUDE.has(t))) continue;
    const container = [...stack].reverse().find(t => CONTAINERS.has(t));
    if (!['p', 'li', 'dd'].includes(container)) continue;
    const mm = part.match(re);
    if (!mm) continue;
    parts[i] = part.slice(0, mm.index) + `<a href='${href}'>${mm[0]}</a>` + part.slice(mm.index + mm[0].length);
    return parts.join('');
  }
  return null;
}

const added = [];
const perSource = new Map();
for (const [keeper, re] of Object.entries(KEEPER_LINKS)) {
  const k = bySlug.get(keeper);
  if (!k) throw new Error(`keeper not published: ${keeper}`);
  const sources = pub.filter(p => p.service === 'Bridging Finance' && p.slug !== keeper);
  let need = PER_KEEPER - sources.filter(p => linksTo(p.content, keeper)).length;
  const ranked = sources.filter(p => !linksTo(p.content, keeper))
    .map(p => ({ p, s: sim(k, p) })).sort((a, b) => (b.s - a.s) || a.p.slug.localeCompare(b.p.slug));
  for (const { p } of ranked) {
    if (need <= 0) break;
    if ((perSource.get(p.slug) || 0) >= PER_SOURCE) continue;
    const out = linkFirstMention(p.content, re, url(keeper));
    if (!out) continue;
    p.content = out;
    perSource.set(p.slug, (perSource.get(p.slug) || 0) + 1);
    need--;
    added.push(`${keeper} <- ${p.slug}`);
  }
}

console.log(`published posts: ${pub.length}`);
console.log(`related-article lists changed: ${relatedChanged}`);
console.log(`in-body keeper links added: ${added.length}`);
added.forEach(a => console.log(`  ${a}`));
console.log(`posts with no visible inbound link: ${orphansBefore} -> ${orphanCount()}`);

if (!DRY) fs.writeFileSync(FILE, (JSON.stringify(posts, null, 2) + '\n').replace(/\n/g, eol));
else console.log('(dry run — nothing written)');
