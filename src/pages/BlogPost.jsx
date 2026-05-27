import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import blogPosts from '../data/blogPosts.json';
import SEO from '../components/SEO';
import Sidebar from '../components/Sidebar';
import RelatedArticles from '../components/RelatedArticles';
import './Blog.css';
import '../components/About.css';

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
