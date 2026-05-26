import React from 'react';
import { useParams, Link } from 'react-router-dom';
import blogPosts from '../data/blogPosts.json';
import SEO from '../components/SEO';
import RelatedArticles from '../components/RelatedArticles';
import './Blog.css';
import '../components/About.css';

const BlogPost = () => {
    const { slug } = useParams();

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

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    };

    const authors = {
        'Mark Higgins': {
            title: 'Managing Partner, Commercial Finance',
            image: '/images/mark-higgins.webp',
            bio: 'With extensive experience across commercial mortgages, development finance and structured lending, Mark leads client relationships and complex case structuring. He has helped hundreds of UK businesses secure the right funding at the right terms.',
            email: 'mark@boxxfinance.co.uk',
            linkedIn: 'https://www.linkedin.com/in/mark-higgins-05ab363b2/'
        },
        'Andrew Farrimond': {
            title: 'Managing Partner, Commercial Finance',
            image: '/images/andrew-farrimond.webp',
            bio: 'Andrew specialises in invoice finance, asset finance and working capital solutions, with a strong track record in helping growth-stage businesses unlock the liquidity they need to scale. His whole-of-market approach ensures clients receive competitive, lender-agnostic advice.',
            email: 'andrew@boxxfinance.co.uk',
            linkedIn: 'https://www.linkedin.com/in/commercial-funding/'
        }
    };

    if (!post) {
        return (
            <div className="blog-post-page">
                <SEO
                    title="Article Not Found | Boxx Commercial Finance"
                    description="The requested article could not be found."
                    keywords="boxx commercial finance, insights"
                />
                <div className="blog-hero" style={{ padding: '10rem 0 6rem' }}>
                    <div className="container">
                        <h1>Article <span className="text-highlight">Not Found</span></h1>
                        <p>The requested article slug did not match any published post.</p>
                    </div>
                </div>
                <div className="container" style={{ paddingBottom: '4rem' }}>
                    <div className="blog-main-card" style={{ padding: '2rem' }}>
                        <p><strong>Requested slug:</strong> {normalisedSlug}</p>
                        <p><strong>Published posts found:</strong> {publishedPosts.length}</p>
                        <h2>Available slugs</h2>
                        <ul>
                            {publishedPosts.map((p) => (
                                <li key={p.id || p.slug}>{p.slug}</li>
                            ))}
                        </ul>
                        <p style={{ marginTop: '1.5rem' }}>
                            <Link to="/insights" className="read-more">Back to Insights</Link>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const authorData = authors[post.author] || authors['Mark Higgins'];
    const heroImage = post.heroImage || post.image || '/images/header_bg.webp';
    const titleWords = post.title.split(' ');
    const titleMain = titleWords.length > 2 ? titleWords.slice(0, -2).join(' ') : '';
    const titleGold = titleWords.length > 2 ? titleWords.slice(-2).join(' ') : post.title;

    return (
        <div className="blog-post-page">
            <SEO
                title={post.metaTitle || post.title}
                description={post.metaDescription || post.excerpt}
                keywords={post.keywords}
                schema={post.schema}
                type="article"
            />

            {/* ── Hero ── */}
            <section className="bp-hero">
                <div className="container">
                    <div className="bp-hero-grid">
                        <div className="bp-hero-text">
                            <h1>
                                {titleMain && <>{titleMain}{' '}</>}
                                <span className="bp-gold">{titleGold}</span>
                            </h1>
                            <div className="bp-meta">
                                {formatDate(post.date)} &middot; {post.author}
                            </div>
                            <p className="bp-subtitle">Speak to us today about your requirements.</p>
                            <Link to="/chat-about-funding" className="btn btn-primary bp-cta">
                                Lets have a chat
                            </Link>
                        </div>
                        <div className="bp-hero-image-col">
                            <img
                                src={heroImage}
                                alt={post.title}
                                className="bp-hero-img"
                                onError={(e) => {
                                    e.currentTarget.src = '/images/header_bg.webp';
                                    e.currentTarget.onerror = null;
                                }}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Body ── */}
            <div className="bp-body">
                <div className="container bp-body-inner">

                    <div className="blog-main-card">
                        <div
                            className="blog-post-content"
                            dangerouslySetInnerHTML={{ __html: post.content || '<p>No article content found.</p>' }}
                        />
                    </div>

                    <div className="director-cards single-column" style={{ marginTop: '0', marginBottom: '3rem' }}>
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

                    <div style={{ marginBottom: '4rem' }}>
                        <RelatedArticles currentSlug={post.slug} />
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BlogPost;
