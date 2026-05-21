import React from 'react';
import { useParams, Link } from 'react-router-dom';
import locationPages from '../data/locationPages.json';
import SEO from '../components/SEO';

const LocationPage = () => {
    const { slug } = useParams();

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
            <div className="blog-post-page">
                <SEO
                    title="Page Not Found | Boxx Commercial Finance"
                    description="The requested location page could not be found."
                    keywords="boxx commercial finance, locations"
                />
                <div className="polished-header">
                    <div className="polished-header__inner container">
                        <Link to="/" className="polished-back-link">← Back to Home</Link>
                        <h1>Page <span className="text-highlight">Not Found</span></h1>
                    </div>
                </div>
                <div className="container" style={{ paddingBottom: '4rem' }}>
                    <div className="polished-content-card">
                        <p><strong>Requested slug:</strong> {normalisedSlug}</p>
                        <p><strong>Published location pages found:</strong> {publishedPages.length}</p>
                        <h2>Available location slugs</h2>
                        <ul>
                            {publishedPages.map((p) => (
                                <li key={p.id || p.slug}>{p.slug}</li>
                            ))}
                        </ul>
                        <p style={{ marginTop: '1.5rem' }}>
                            <Link to="/" className="read-more">Back to Home</Link>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const sameServicePages = publishedPages
        .filter((p) => p.slug !== page.slug && p.service === page.service)
        .slice(0, 3);

    const pageSchema = page.faqSchema ? [page.faqSchema] : undefined;

    // City image via Unsplash — uses location name as search term, no API key needed
    const cityImageUrl = `https://source.unsplash.com/1200x500/?${encodeURIComponent(page.location + ',city,uk')}`;

    const serviceLabel = page.service
        ? page.service.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Finance';

    return (
        <div className="blog-post-page polished-page location-page" data-page-type="location-page">
            <SEO
                title={page.metaTitle || page.title}
                description={page.metaDescription || page.title}
                keywords={[
                    page.title,
                    page.location,
                    page.service,
                    'commercial finance',
                    'business finance'
                ]}
                schema={pageSchema}
                type="article"
            />

            {/* ── Clean white header ── */}
            <div className="polished-header">
                <div className="polished-header__inner container">
                    <Link to="/locations" className="polished-back-link">← All locations</Link>
                    <h1>{page.title}</h1>
                    {page.metaDescription && (
                        <p className="polished-location-subtitle">{page.metaDescription}</p>
                    )}
                </div>
            </div>

            {/* ── Full-width city image ── */}
            <div className="polished-hero-image">
                <img
                    src={cityImageUrl}
                    alt={`${serviceLabel} in ${page.location}`}
                    onError={(e) => {
                        // Fallback to a generic UK business image if Unsplash fails
                        e.currentTarget.src = '/header_bg.png';
                        e.currentTarget.onerror = null;
                    }}
                />
            </div>

            {/* ── Main content ── */}
            <div className="polished-body container">

                {/* Early CTA */}
                <div className="polished-cta-banner">
                    <p>Looking for {serviceLabel.toLowerCase()} in {page.location}?</p>
                    <a href="/chat-about-funding" className="btn btn-primary">
                        Chat about your requirements
                    </a>
                </div>

                <div className="polished-content-card">
                    <div
                        className="blog-post-content location-post-content"
                        dangerouslySetInnerHTML={{ __html: page.content || '<p>No page content found.</p>' }}
                    />
                </div>

                {/* Bottom CTA */}
                <div className="polished-content-card" style={{ marginTop: '2rem' }}>
                    <h2>Speak to Boxx Commercial Finance</h2>
                    <p>If you want to explore funding options for your business, speak to our team today.</p>
                    <p style={{ marginTop: '1rem' }}>
                        <a href="/chat-about-funding" className="btn btn-primary">
                            Start your enquiry
                        </a>
                    </p>
                </div>

                {/* Related locations */}
                {sameServicePages.length > 0 && (
                    <div className="polished-content-card" style={{ marginTop: '2rem', marginBottom: '4rem' }}>
                        <h2>Related locations</h2>
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
                )}

            </div>
        </div>
    );
};

export default LocationPage;
