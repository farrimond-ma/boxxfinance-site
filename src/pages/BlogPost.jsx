import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import blogPosts from '../data/blogPosts.json';
import SEO from '../components/SEO';
import Sidebar from '../components/Sidebar';
import RelatedArticles from '../components/RelatedArticles';
import './Blog.css';
import '../components/About.css';

const AUTHORS = {
    'Mark Higgins': {
        title: 'Managing Partner, Commercial Finance',
        image: '/images/mark-higgins.webp',
        bio: 'With extensive experience across commercial mortgages, development finance and structured lending, Mark leads client relationships and complex case structuring. He has helped hundreds of UK businesses secure the right funding at the right terms.',
        email: 'mark@boxxfinance.co.uk',
        linkedIn: 'https://www.linkedin.com/in/mark-higgins-05ab363b2/',
    },
    'Andrew Farrimond': {
        title: 'Managing Partner, Commercial Finance',
        image: '/images/andrew-farrimond.webp',
        bio: 'Andrew specialises in invoice finance, asset finance and working capital solutions, with a strong track record in helping growth-stage businesses unlock the liquidity they need to scale. His whole-of-market approach ensures clients receive competitive, lender-agnostic advice.',
        email: 'andrew@boxxfinance.co.uk',
        linkedIn: 'https://www.linkedin.com/in/commercial-funding/',
    },
};

const FALLBACK_IMAGES = [
    '/header_bg.png',
    '/images/sidebar/sidebar_meeting.jpg',
    '/images/sidebar/sidebar_handshake.jpg',
    '/images/sidebar/sidebar_office.jpg',
];

const BlogPost = () => {
    const { slug } = useParams();

    // Pick a random fallback sidebar image once per mount
    const [fallbackImage] = useState(
        () => FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)]
    );

    const normalisedSlug = decodeURIComponent(String(slug || ''))
        .trim()
        .replace(/^\/+|\/+$/g, '')
        .toLowerCase();

    const publishedPosts = blogPosts.filter((post) => post && post.status === 'published');

    const post = publishedPosts.find((p) => {
        const postSlug = String(p.slug || '')
            .trim()
            .replace(/^\/+|\/+$/g, '')
            .toLowerCase();
        return postSlug === normalisedSlug;
    });

    if (!post) {
        return (
            <div className="blog-post-page">
                <SEO
                    title="Article Not Found"
                    description="The requested article could not be found."
                    keywords="boxx commercial finance, insights"
                />
                <div className="service-hero">
                    <div className="container">
                        <h1>Article <span className="text-highlight">Not Found</span></h1>
                        <p>The article you requested could not be found.</p>
                    </div>
                </div>
                <div className="container" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>
                    <div className="blog-main-card" style={{ padding: '2rem' }}>
                        <p>
                            <Link to="/insights" className="read-more">← Back to Insights</Link>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const authorData = AUTHORS[post.author] || AUTHORS['Mark Higgins'];

    // Sidebar image: use DALL-E hero if available, otherwise a random fallback
    const heroImage = post.heroImage || post.image || null;
    const sidebarImage = heroImage || fallbackImage;

    // Title treatment: last two words get the gold highlight
    const titleWords = post.title.split(' ');
    const titleMain = titleWords.length > 2 ? titleWords.slice(0, -2).join(' ') : '';
    const titleGold = titleWords.length > 2 ? titleWords.slice(-2).join(' ') : post.title;

    // Hero description — use metaDescription or excerpt as the "couple of lines of text"
    const heroDescription =
        post.metaDescription ||
        post.excerpt ||
        'Practical insight from the commercial finance specialists at Boxx Commercial Finance.';

    return (
        <div className="blog-post-page">
            <SEO
                title={post.metaTitle || post.title}
                description={post.metaDescription || post.excerpt}
                keywords={post.keywords}
                schema={post.schema}
                type="article"
                canonical={`/insights/${post.slug}`}
                image={heroImage}
            />

            {/* ── Hero — centred, matches service page style ── */}
            <div className="service-hero">
                <div className="container">
                    <h1>
                        {titleMain && <>{titleMain} </>}
                        <span className="text-highlight">{titleGold}</span>
                    </h1>
                    <p>{heroDescription}</p>
                    <Link to="/chat-about-funding" className="btn btn-primary blog-hero-cta">
                        Speak to us today
                    </Link>
                </div>
            </div>

            {/* ── Body — two-column layout matching service pages ── */}
            <div className="container blog-layout">

                {/* Left column: article content */}
                <div className="blog-main">
                    <div className="blog-main-card">
                        <div
                            className="blog-post-content"
                            dangerouslySetInnerHTML={{ __html: post.content || '<p>No article content found.</p>' }}
                        />
                    </div>
                    {/* Author bio card */}
                    <div className="director-cards single-column" style={{ marginTop: '0', marginBottom: '1.5rem' }}>
                        <div className="director-card">
                            <img src={authorData.image} alt={post.author} className="director-avatar-photo" />
                            <div className="director-info">
                                <h4>{post.author}</h4>
                                <p className="director-title">{authorData.title}</p>
                                <p className="director-bio">{authorData.bio}</p>
                                <div className="director-social-links">
                                    <div className="contact-link-row">
                                        <a href={`mailto:${authorData.email}`} className="director-email gold-link">
                                            {authorData.email}
                                        </a>
                                    </div>
                                    <div className="contact-link-row">
                                        <a href="tel:03300431612" className="director-phone gold-link">
                                            0330 043 1612
                                        </a>
                                    </div>
                                    {authorData.linkedIn && (
                                        <div className="contact-link-row">
                                            <a
                                                href={authorData.linkedIn}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="director-linkedin-btn"
                                            >
                                                Connect on LinkedIn
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <RelatedArticles currentSlug={post.slug} />
                </div>

                {/* Right column: sidebar image + links/CTA widget */}
                <div className="blog-sidebar">
                    <div className="sidebar-overlap-image">
                        <img
                            src={sidebarImage}
                            alt={post.title}
                            style={{ objectPosition: 'center center' }}
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

export default BlogPost;
