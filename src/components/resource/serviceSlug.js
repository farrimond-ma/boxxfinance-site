import { serviceContent } from '../../data/services';
import { FOCUS_SERVICES, RETIRED_SERVICE_CTA } from '../../data/serviceFocus';

const normalize = (s) => (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z]+/g, '');

// Maps a service's internal identity (e.g. "Bridging Finance" — the label
// used for SERVICE_FILTER/grouping in blogPosts.json/locationPages.json) to
// its public-facing funding-solutions slug (e.g. "bridging-loans"). Derives
// from services.jsx so it can't drift from the actual route slugs; returns
// null when there's no match so callers can fall back to the generic form.
export function serviceToSlug(service) {
    const target = normalize(service);
    if (!target) return null;
    // "Bridging Finance" (service identity) and "bridging-loans" (public slug/
    // title) are the same product under different names — see the bridging
    // rename (2026-07). Special-cased since normalize() can't unify them.
    if (target.startsWith('bridging')) return 'bridging-loans';
    for (const [slug, data] of Object.entries(serviceContent)) {
        if (normalize(slug) === target || normalize(data.title) === target) return slug;
    }
    return null;
}

// Every CTA that "goes to a form" should land on that service's own enquiry
// form (/chat-about-funding/<slug>) rather than the generic form, so the
// visitor's context carries through. Falls back to the generic form when the
// page has no recognised service.
// An article or location page written for a de-listed service (invoice
// finance, business loans and the rest) still exists and still ranks, so its
// CTAs are re-pointed at a focus service rather than sending the enquiry into
// a product we no longer promote. The page itself is untouched — only where
// its "start your enquiry" button lands.
export function serviceCtaTo(service) {
    const slug = serviceToSlug(service);
    if (!slug) return '/chat-about-funding';
    if (!FOCUS_SERVICES.includes(slug)) return `/chat-about-funding/${RETIRED_SERVICE_CTA}`;
    return `/chat-about-funding/${slug}`;
}
