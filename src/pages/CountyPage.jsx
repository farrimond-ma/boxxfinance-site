import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import countyPages from '../data/countyIndex.json';
import SEO from '../components/SEO';
import ResourcePage from '../components/resource/ResourcePage';
import { pickHero } from '../components/resource/heroPool';

const AUTHOR = {
    name: 'Mark Higgins',
    title: 'Managing Partner, Commercial Finance',
    image: '/images/mark-higgins.webp',
    bio: 'Mark leads client relationships and complex case structuring across commercial mortgages, bridging and development finance, helping UK businesses secure the right funding at the right terms.',
    email: 'mark@boxxfinance.co.uk',
    linkedIn: 'https://www.linkedin.com/in/mark-higgins-05ab363b2/',
};

// County-level content pages — one step up from the town-level LocationPage.
// Deliberately real written content per county (coverage, market character,
// links to the major town pages), not a link-dump: see src/data/countyPages.json.
// Mirrors LocationPage.jsx's structure/schema pattern closely on purpose.
const CountyPage = () => {
    const { countySlug } = useParams();

    const normalisedSlug = decodeURIComponent(String(countySlug || ''))
        .trim()
        .replace(/^\/+|\/+$/g, '')
        .replace(/\.html$/i, '')
        .toLowerCase();

    const publishedPages = countyPages.filter((page) => page && page.status === 'published');
    const page = publishedPages.find((p) => {
        const pageSlug = String(p.slug || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '').toLowerCase();
        return pageSlug === normalisedSlug;
    });

    const [fullPage, setFullPage] = useState(null);
    useEffect(() => {
        if (!page) return undefined;
        let cancelled = false;
        setFullPage(null);
        fetch(`/content/counties/${encodeURIComponent(page.slug)}.json`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => { if (!cancelled) setFullPage(data); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [page && page.slug]);

    if (!page) {
        return (
            <div className="blog-post-page" data-page-type="county-not-found">
                <SEO title="Page Not Found" description="The requested county page could not be found." />
                <div className="service-hero">
                    <div className="container">
                        <h1>Page <span className="text-highlight">Not Found</span></h1>
                        <p>The county page you requested could not be found.</p>
                    </div>
                </div>
                <div className="container" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>
                    <div className="blog-main-card" style={{ padding: '2rem' }}>
                        <p><Link to="/locations" className="read-more">← Back to Locations</Link></p>
                    </div>
                </div>
            </div>
        );
    }

    // FinancialService + areaServed, same "near me" logic as LocationPage but
    // scoped to an AdministrativeArea (the county) rather than a City.
    const localServiceSchema = {
        '@context': 'https://schema.org',
        '@type': 'FinancialService',
        name: `Bridging Loans ${page.county} — Boxx Commercial Finance`,
        url: `https://boxxfinance.co.uk/locations/county/${page.slug}`,
        telephone: '+44-330-043-1612',
        areaServed: { '@type': 'AdministrativeArea', name: page.county, containedInPlace: { '@type': 'Country', name: 'United Kingdom' } },
        provider: {
            '@type': 'Organization',
            name: 'Boxx Commercial Finance',
            url: 'https://boxxfinance.co.uk',
        },
        serviceType: 'Bridging Loans',
    };
    const pageSchema = fullPage && fullPage.faqSchema
        ? [localServiceSchema, fullPage.faqSchema]
        : [localServiceSchema];
    const displayTitle = (page.title || '').split('|')[0].trim();
    const heroDescription = page.metaDescription || displayTitle;

    return (
        <div data-page-type="county-page">
            <SEO
                title={page.metaTitle || page.title}
                description={page.metaDescription || page.title}
                keywords={[page.title, page.county, 'bridging loans', 'commercial finance']}
                schema={pageSchema}
                type="article"
                canonical={`/locations/county/${page.slug}`}
            />
            <ResourcePage
                title={displayTitle}
                heroDescription={heroDescription}
                heroImage={pickHero(page.slug)}
                service="Bridging Finance"
                author={AUTHOR}
                contentHtml={fullPage ? (fullPage.content || '<p>No page content found.</p>') : null}
                faqSchema={fullPage ? fullPage.faqSchema : null}
            />
        </div>
    );
};

export default CountyPage;
