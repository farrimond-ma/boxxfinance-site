import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import blogPosts from '../data/blogIndex.json';
import SEO from '../components/SEO';
import { heroForPost } from '../components/resource/heroPool';
import '../components/resource/ResourcePage.css'; // shared hero design language
import './Blog.css';

// Internal service identities are normalised to the public-facing terms used
// everywhere else on the site (notably "Bridging Loans", not "Bridging Finance").
const displayService = (s) => {
    const v = (s || '').trim();
    if (/bridging/i.test(v)) return 'Bridging Loans';
    if (/^commercial mortgage/i.test(v)) return 'Commercial Mortgages';
    if (/cashflow/i.test(v)) return 'Working Capital'; // cashflow-finance was retired → working capital
    return v || 'Other';
};

// Card thumbnails: prefer the post's own hero image; fall back to a service
// image, then a sensible default, so no card is ever imageless or broken.
const SERVICE_FALLBACK = {
    'Bridging Loans': '/images/hero/bridging-3.webp',
    'Business Loans': '/images/hero/service-business-loans.webp',
    'Commercial Mortgages': '/images/hero/service-commercial-mortgages.webp',
    'Development Finance': '/images/hero/service-development-finance.webp',
    'Invoice Finance': '/images/hero/service-invoice-finance.webp',
    'Asset Finance': '/images/hero/service-asset-finance.webp',
    'Working Capital': '/images/hero/service-working-capital.webp',
    'Trade Finance': '/images/hero/service-trade-finance.webp',
    'Structured Finance': '/images/hero/service-structured-finance.webp',
};
const DEFAULT_IMG = '/images/hero/service-commercial-mortgages.webp';
// heroForPost routes bridging posts through the curated pool (variety), so cards
// stop showing the content engine's duplicate per-slug stock photos and always
// match the article they link to. Service image / default cover any gaps.
const cardImage = (p) => heroForPost(p) || SERVICE_FALLBACK[displayService(p.service)] || DEFAULT_IMG;

const Blog = () => {
    const publishedPosts = useMemo(
        () =>
            [...blogPosts]
                .filter((post) => post && post.status === 'published')
                .sort((a, b) => new Date(b.date) - new Date(a.date)),
        []
    );

    // Filter chips: every service present with 3+ posts, most common first.
    // Smaller/one-off topics still appear under "All" so nothing is hidden.
    const filters = useMemo(() => {
        const counts = {};
        publishedPosts.forEach((p) => {
            const s = displayService(p.service);
            counts[s] = (counts[s] || 0) + 1;
        });
        return Object.entries(counts)
            .filter(([name, n]) => n >= 3 && name !== 'Other') // "Other" stays under "All"
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name);
    }, [publishedPosts]);

    const [active, setActive] = useState('All');
    const shown =
        active === 'All'
            ? publishedPosts
            : publishedPosts.filter((p) => displayService(p.service) === active);

    const formatDate = (dateStr) =>
        new Date(dateStr).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    return (
        <div className="blog-page">
            <SEO
                title="Commercial Funding Insights"
                description="Commercial finance insights and funding intelligence for UK business owners. Read expert guidance on bridging loans, commercial mortgages, asset finance and more."
                keywords="commercial finance insights, UK business funding blog, bridging loans advice, SME finance guidance"
            />

            {/* Same navy→property-image hero used across the site (ResourcePage.css). */}
            <div
                className="resource-hero has-hero-image"
                style={{ '--hero-image': `url("${DEFAULT_IMG}")` }}
            >
                <div className="container resource-hero-grid">
                    <div className="resource-hero-text">
                        <h1>
                            Commercial Funding <span className="text-highlight">Insights</span>
                        </h1>
                        <p className="resource-hero-lead">
                            Practical, up-to-date funding intelligence for UK businesses, homeowners
                            and property investors — written by our brokers.
                        </p>
                        <div className="resource-hero-actions">
                            <Link to="/chat-about-funding" className="btn btn-primary">Get a free quote</Link>
                            <a href="tel:03300431612" className="btn btn-outline resource-btn-phone">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                                Talk to an expert
                            </a>
                        </div>
                        <ul className="resource-hero-trust" aria-label="Why choose Boxx">
                            <li>Independent broker</li>
                            <li>Whole of market</li>
                            <li>Fast decisions</li>
                        </ul>
                    </div>
                </div>
            </div>

            <section className="section">
                <div className="container">
                    {/* Filter bar */}
                    <div className="blog-filter" role="group" aria-label="Filter insights by topic">
                        <button
                            type="button"
                            className={`blog-filter-chip${active === 'All' ? ' is-active' : ''}`}
                            onClick={() => setActive('All')}
                        >
                            All <span className="blog-filter-count">{publishedPosts.length}</span>
                        </button>
                        {filters.map((name) => (
                            <button
                                key={name}
                                type="button"
                                className={`blog-filter-chip${active === name ? ' is-active' : ''}`}
                                onClick={() => setActive(name)}
                            >
                                {name}
                            </button>
                        ))}
                    </div>

                    {shown.length > 0 ? (
                        <div className="blog-grid">
                            {shown.map((post) => {
                                const svc = displayService(post.service);
                                return (
                                    <Link
                                        key={post.id}
                                        to={`/insights/${post.slug}`}
                                        className="blog-card"
                                        aria-label={post.title}
                                    >
                                        <div className="blog-card-img">
                                            <img
                                                src={cardImage(post)}
                                                alt=""
                                                loading="lazy"
                                                onError={(e) => {
                                                    if (e.currentTarget.src.indexOf(DEFAULT_IMG) === -1) {
                                                        e.currentTarget.src = DEFAULT_IMG;
                                                    }
                                                }}
                                            />
                                            {svc && svc !== 'Other' && (
                                                <span className="blog-card-tag">{svc}</span>
                                            )}
                                        </div>
                                        <div className="blog-card-content">
                                            <h3>{post.title}</h3>
                                            <p>{post.excerpt}</p>
                                            <p className="blog-card-date">Last updated: {formatDate(post.date)}</p>
                                            <span className="read-more">Read Article &rarr;</span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center">
                            <h3>No articles in this topic yet.</h3>
                            <p>Try another filter or check back soon.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Blog;
