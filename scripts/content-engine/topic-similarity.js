// Shared topic matching for the content engine — the duplicate-coverage guard
// and related-article linking must agree on what "the same topic" means, so
// they use one implementation rather than drifting copies.

const STOPWORDS = new Set(['a','an','the','and','or','for','to','of','in','on','is','are','can','do','does','you','your','uk','with','what','how','my','i','it','be']);

// Plurals are folded to singular ("flats" -> "flat"). Without it,
// "what happens to your flat if the freeholder goes bust" scored 0.38 against
// the published freeholder-insolvency post (0.40 needed), the model was never
// consulted, and a straight duplicate went live on 2026-09-14.
function singular(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

function topicTokens(str) {
  return new Set(String(str || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/).filter(w => w.length > 2 && !STOPWORDS.has(w)).map(singular));
}

// How much of the SHORTER topic is covered by the other.
function overlapScore(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size);
}

const postTokens = (p) => topicTokens(`${p.keywords || ''} ${p.title || ''} ${p.slug || ''}`);

const SITE = 'https://boxxfinance.co.uk';

// Published posts in the same service, most topically similar first. Every
// publisher must use this rather than sheet order: sheet order gave every post
// the same three related articles and left 236 of 263 posts orphaned.
function relatedByTopic(planned, posts, service, limit = 3) {
  const svc = String(service || '').toLowerCase();
  return posts
    .filter(p => p.status === 'published' && p.slug && String(p.service || '').toLowerCase() === svc)
    .map(p => ({ p, s: overlapScore(planned, postTokens(p)) }))
    .sort((a, b) => (b.s - a.s) || String(b.p.date || '').localeCompare(String(a.p.date || '')))
    .slice(0, limit)
    .map(({ p }) => p);
}

// Inbound link at birth: the new post takes the second (visible) related slot
// on its closest existing match. Otherwise it only ever links out.
function addInboundLink(host, newSlug, limit = 3) {
  if (!host) return false;
  const list = (host.relatedBlogUrls || []).filter(u => !u.endsWith(`/insights/${newSlug}`));
  list.splice(1, 0, `${SITE}/insights/${newSlug}`);
  host.relatedBlogUrls = list.slice(0, limit);
  return true;
}

module.exports = { STOPWORDS, singular, topicTokens, overlapScore, postTokens, relatedByTopic, addInboundLink };
