import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import locationPages from '../data/locationIndex.json';
import SEO from '../components/SEO';
import ResourcePage from '../components/resource/ResourcePage';

const AUTHOR = {
    name: 'Mark Higgins',
    title: 'Managing Partner, Commercial Finance',
    image: '/images/mark-higgins.webp',
    bio: 'Mark leads client relationships and complex case structuring across commercial mortgages, bridging and development finance, helping UK businesses secure the right funding at the right terms.',
    email: 'mark@boxxfinance.co.uk',
    linkedIn: 'https://www.linkedin.com/in/mark-higgins-05ab363b2/',
};

// Rotate location heroes across the curated bridging-property pool (fetched
// by scripts/fetch-bridging-heroes.js) so the 95 pages don't all share one
// image. Deterministic per slug. If the pool isn't present yet the background
// simply falls back to solid navy — no broken image.
// Only the wide establishing shots (house rows, streets, developments,
// refurbishments) blend well behind the navy gradient. The two tight
// close-ups (keys #2, for-sale sign #8) are excluded — cropped to the right
// of the hero they show only texture, not obvious property.
const HERO_POOL = [1, 3, 4, 5, 6, 7].map((i) => `/images/hero/bridging-${i}.webp`);
const pickHero = (slug) => {
    const sum = [...String(slug)].reduce((a, c) => a + c.charCodeAt(0), 0);
    return HERO_POOL[sum % HERO_POOL.length];
};

const LocationPage = () => {
    const { slug } = useParams();

    const normalisedSlug = decodeURIComponent(String(slug || ''))
        .trim()
        .replace(/^\/+|\/+$/g, '')
        .replace(/\.html$/i, '')
        .toLowerCase();

    const publishedPages = locationPages.filter((page) => page && page.status === 'published');
    const page = publishedPages.find((p) => {
        const pageSlug = String(p.slug || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '').toLowerCase();
        return pageSlug === normalisedSlug;
    });

    const [fullPage, setFullPage] = useState(null);
    useEffect(() => {
        if (!page) return undefined;
        let cancelled = false;
        setFullPage(null);
        fetch(`/content/locations/${encodeURIComponent(page.slug)}.json`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => { if (!cancelled) setFullPage(data); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [page && page.slug]);

    if (!page) {
        return (
            <div className="blog-post-page" data-page-type="location-not-found">
                <SEO title="Page Not Found" description="The requested location page could not be found." />
                <div className="service-hero">
                    <div className="container">
                        <h1>Page <span className="text-highlight">Not Found</span></h1>
                        <p>The location page you requested could not be found.</p>
                    </div>
                </div>
                <div className="container" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>
                    <div className="blog-main-card" style={{ padding: '2rem' }}>
                        <p><Link to="/" className="read-more">← Back to Home</Link></p>
                    </div>
                </div>
            </div>
        );
    }

    const pageSchema = fullPage && fullPage.faqSchema ? [fullPage.faqSchema] : undefined;
    // Some location titles carry a "| Commercial Finance Broker" meta suffix;
    // strip it so the big hero H1 reads cleanly (full title still used for SEO).
    const displayTitle = (page.title || '').split('|')[0].trim();
    const heroDescription = page.metaDescription || displayTitle;

    return (
        <div data-page-type="location-page">
            <SEO
                title={page.metaTitle || page.title}
                description={page.metaDescription || page.title}
                keywords={[page.title, page.location, page.service, 'commercial finance', 'business finance']}
                schema={pageSchema}
                type="article"
                canonical={`/locations/${page.slug}`}
            />
            <ResourcePage
                title={displayTitle}
                heroDescription={heroDescription}
                heroImage={pickHero(page.slug)}
                service={page.service}
                currentLocationSlug={page.slug}
                author={AUTHOR}
                contentHtml={fullPage ? (fullPage.content || '<p>No page content found.</p>') : null}
                faqSchema={fullPage ? fullPage.faqSchema : null}
            />
            <Link to="/chat-about-funding" className="resource-float-cta" aria-label="Need funding? Talk to us">
                <span>Need funding?</span> Talk to us
            </Link>
        </div>
    );
};

export default LocationPage;
