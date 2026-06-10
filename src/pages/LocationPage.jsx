import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import locationPages from '../data/locationPages.json';
import SEO from '../components/SEO';
import Sidebar from '../components/Sidebar';
import './Blog.css';

const FALLBACK_IMAGES = [
    '/header_bg.png',
    '/images/sidebar/sidebar_meeting.jpg',
    '/images/sidebar/sidebar_handshake.jpg',
    '/images/sidebar/sidebar_office.jpg',
];

const LocationPage = () => {
    const { slug } = useParams();

    const [sidebarImage] = useState(
        () => FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)]
    );

    const normalisedSlug = decodeURIComponent(String(slug || ''))
        .trim()
        .replace(/^\/+|\/+$/g, '')
        .replace(/\.html$/i, '')
        .toLowerCase();

    const publishedPages = locationPages.filter((page) => page && page.status === 'published');

    const page = publishedPages.find((p) => {
        const pageSlug = String(p.slug || '')
            .trim()
            .replace(/^\/+|\/+$/g, '')
            .replace(/\.html$/i, '')
            .toLowerCase();
        return pageSlug === normalisedSlug;
    });

    if (!page) {
        return (
            <div className="blog-post-page" data-page-type="location-not-found">
                <SEO
                    title="Page Not Found"
                    description="The requested location page could not be found."
                />
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

    const sameServicePages = publishedPages
        .filter((p) => p.slug !== page.slug && p.service === page.service)
        .slice(0, 4);

    const pageSchema = page.faqSchema ? [page.faqSchema] : undefined;

    const serviceLabel = page.service
        ? page.service.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Finance';

    // Last two words get the gold highlight
    const titleWords = (page.title || '').split(' ');
    const titleMain = titleWords.length > 2 ? titleWords.slice(0, -2).join(' ') : '';
    const titleGold = titleWords.length > 2 ? titleWords.slice(-2).join(' ') : page.title;

    return (
        <div className="blog-post-page" data-page-type="location-page">
            <SEO
                title={page.metaTitle || page.title}
                description={page.metaDescription || page.title}
                keywords={[page.title, page.location, page.service, 'commercial finance', 'business finance']}
                schema={pageSchema}
                type="article"
            />

            {/* ── Hero — matches service / blog post style ── */}
            <div className="service-hero">
                <div className="container">
                    <h1>
                        {titleMain && <>{titleMain} </>}
                        <span className="text-highlight">{titleGold}</span>
                    </h1>
                    {page.metaDescription && <p>{page.metaDescription}</p>}
                    <Link to="/chat-about-funding" className="btn btn-primary blog-hero-cta">
                        Speak to us today
                    </Link>
                </div>
            </div>

            {/* ── Body — two-column layout ── */}
            <div className="container blog-layout">

                {/* Left column: article content + related locations */}
                <div className="blog-main">
                    <div className="blog-main-card">
                        <div
                            className="blog-post-content location-post-content"
                            dangerouslySetInnerHTML={{ __html: page.content || '<p>No page content found.</p>' }}
                        />
                    </div>

                    {sameServicePages.length > 0 && (
                        <div className="blog-main-card" style={{ marginTop: '1.5rem' }}>
                            <div style={{ padding: '2rem' }}>
                                <h2 style={{ marginTop: 0 }}>
                                    More {serviceLabel} guides
                                </h2>
                                <div className="related-locations-grid">
                                    {sameServicePages.map((relatedPage) => (
                                        <Link
                                            key={relatedPage.slug}
                                            to={`/locations/${relatedPage.slug}`}
                                            className="related-location-link"
                                        >
                                            {relatedPage.title}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right column: image + sidebar widget */}
                <div className="blog-sidebar">
                    <div className="sidebar-overlap-image">
                        <img
                            src={sidebarImage}
                            alt={`${serviceLabel} in ${page.location}`}
                            onError={(e) => {
                                e.currentTarget.src = '/header_bg.png';
                                e.currentTarget.onerror = null;
                            }}
                        />
                    </div>
                    <Sidebar />
                </div>

            </div>
        </div>
    );
};

export default LocationPage;
