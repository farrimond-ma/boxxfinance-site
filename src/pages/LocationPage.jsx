import React from 'react';
import { useParams, Link } from 'react-router-dom';
import locationPages from '../data/locationPages.json';
import SEO from '../components/SEO';
import './Blog.css';
import '../components/About.css';

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

                <div className="blog-hero" style={{ padding: '10rem 0 6rem' }}>
                    <div className="container">
                        <h1>Page <span className="text-highlight">Not Found</span></h1>
                        <p>The requested location page could not be found.</p>
                    </div>
                </div>

                <div className="container" style={{ paddingBottom: '4rem' }}>
                    <div className="blog-main-card">
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

    const pageSchema = page.faqSchema
        ? [page.faqSchema]
        : undefined;

    return (
        <div className="blog-post-page" data-page-type="location-page">
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

            <div className="blog-hero" style={{ padding: '10rem 0 6rem' }}>
                <div className="container">
                    <h1>{page.title}</h1>
                    {page.metaDescription && (
                        <p className="blog-post-date" style={{ maxWidth: '800px' }}>
                            {page.metaDescription}
                        </p>
                    )}
                </div>
            </div>

            <div className="container blog-layout">
                <div className="blog-main">
                    <div className="blog-main-card">
                        <div
                            className="blog-post-content"
                            dangerouslySetInnerHTML={{ __html: page.content || '<p>No page content found.</p>' }}
                        />
                    </div>

                    <div className="blog-main-card" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                        <h2>Speak to Boxx Commercial Finance</h2>
                        <p>
                            If you want to explore funding options for your business, speak to our team today.
                        </p>
                        <p style={{ marginTop: '1rem' }}>
                            <a href="/chat-about-funding" className="btn btn-primary">
                                Start your enquiry
                            </a>
                        </p>
                    </div>

                    {sameServicePages.length > 0 && (
                        <div className="blog-main-card" style={{ marginBottom: '4rem' }}>
                            <h2>Related locations</h2>
                            <ul>
                                {sameServicePages.map((relatedPage) => (
                                    <li key={relatedPage.slug}>
                                        <Link to={`/locations/${relatedPage.slug}`} className="read-more">
                                            {relatedPage.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="blog-sidebar">
                    <SidebarLocationCard currentPage={page} />
                </div>
            </div>
        </div>
    );
};

const SidebarLocationCard = ({ currentPage }) => {
    return (
        <div className="sidebar-card">
            <h3>{currentPage.title}</h3>
            <p>
                Looking for support with {currentPage.service?.replace(/-/g, ' ')} in {currentPage.location}?
                Boxx Commercial Finance helps businesses access tailored funding solutions.
            </p>
            <p style={{ marginTop: '1rem' }}>
                <a href="/chat-about-funding" className="btn btn-primary">
                    Speak to us
                </a>
            </p>
        </div>
    );
};

export default LocationPage;
