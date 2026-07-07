import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import locationPages from '../data/locationIndex.json';
import SEO from '../components/SEO';
import RelatedArticles from '../components/RelatedArticles';
import ResourcePage from '../components/resource/ResourcePage';

const AUTHOR = {
    name: 'Mark Higgins',
    title: 'Managing Partner, Commercial Finance',
    image: '/images/mark-higgins.webp',
    bio: 'Mark leads client relationships and complex case structuring across commercial mortgages, bridging and development finance, helping UK businesses secure the right funding at the right terms.',
    email: 'mark@boxxfinance.co.uk',
    linkedIn: 'https://www.linkedin.com/in/mark-higgins-05ab363b2/',
};

const readingMinutes = (html) => {
    const words = (html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(2, Math.round(words / 200));
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
    const heroDescription = page.metaDescription || page.title;

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
                title={page.title}
                heroDescription={heroDescription}
                heroImage="/images/sidebar/sidebar_meeting.jpg"
                service={page.service}
                dateLabel={null}
                currentLocationSlug={page.slug}
                readingMinutes={fullPage ? readingMinutes(fullPage.content) : null}
                author={AUTHOR}
                contentHtml={fullPage ? (fullPage.content || '<p>No page content found.</p>') : null}
                faqSchema={fullPage ? fullPage.faqSchema : null}
                relatedSlug={page.slug}
                RelatedArticles={RelatedArticles}
            />
            <Link to="/chat-about-funding" className="resource-float-cta" aria-label="Need funding? Talk to us">
                <span>Need funding?</span> Talk to us
            </Link>
        </div>
    );
};

export default LocationPage;
