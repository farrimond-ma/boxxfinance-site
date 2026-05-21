import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import blogPosts from '../data/blogPosts.json';
import SEO from '../components/SEO';
import RelatedArticles from '../components/RelatedArticles';
import './Blog.css';
import './NewLayout.css';
import '../components/About.css';

const LinkedInIcon = () => (
    <svg className="linkedin-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <path d="M19 0H5C2.239 0 0 2.239 0 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5V5c0-2.761-2.238-5-5-5zM8 19H5V8h3v11zM6.5 6.732c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zM20 19h-3v-5.604c0-3.368-4-3.113-4 0V19h-3V8h3v1.765c1.396-2.586 7-2.777 7 2.476V19z" />
    </svg>
);

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

    const heroImages = [
        '/header_bg.webp',
        '/images/sidebar/sidebar_meeting.webp',
        '/images/sidebar/sidebar_handshake.webp',
        '/images/sidebar/sidebar_office.webp'
    ];

    const heroImage = useMemo(() => {
        return heroImages[Math.floor(Math.random() * heroImages.length)];
    }, []);

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    };

    const authors = {
        'Mark Higgins': {
            title: 'Managing Partner, Commercial Finance',
            image: '/mark-higgins.webp',
            bio: 'With extensive experience across commercial mortgages, development finance and structured lending, Mark leads client relationships and complex case structuring. He has helped hundreds of UK businesses secure the right funding at the right terms.',
            email: 'mark@boxxfinance.co.uk',
            linkedIn: 'https://www.linkedin.com/in/mark-higgins-05ab363b2/'
        },
        'Andrew Farrimond': {
            title: 'Managing Partner, Commercial Finance',
            image: '/andrew-farrimond.webp',
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
                <div className="polished-header">
                    <div className="polished-header__inner">
                        <Link to="/insights" className="polished-back-link">Back to Insights</Link>
                        <h1>Article <span className="text-highlight">Not Found</span></h1>
                    </div>
                </div>
                <div className="container" style={{ paddingBottom: '4rem' }}>
                    <div className="polished-content-card">
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

    const wordCount = (post.content || '').replace(/<[^>]+>/g, '').split(/\s+/).length;
    const readMins = Math.max(1, Math.round(wordCount / 200));

    return (
        <div className="blog-post-page polished-page">
            <SEO
                title={post.metaTitle || post.title}
                description={post.metaDescription || post.excerpt}
                keywords={post.keywords}
                schema={post.schema}
                type="article"
            />

            <div className="polished-header">
                <div className="polished-header__inner">
                    <Link to="/insights" className="polished-back-link">Back to Insights</Link>
                    <div className="polished-hero-grid">
                        <div className="polished-hero-text">
                            <h1>
                                {post.title.split(' ').slice(0, -2).join(' ')}{' '}
                                <span className="text-highlight">
                                    {post.title.split(' ').slice(-2).join(' ')}
                                </span>
                            </h1>
                            <div className="polished-meta">
                                <span>{formatDate(post.date)}</span>
                                <span className="polished-meta__dot">·</span>
                                <span>{readMins} min read</span>
                                {post.author && (
                                    <>
                                        <span className="polished-meta__dot">·</span>
                                        <a href="#author" className="polished-author-link">{post.author}</a>
                                    </>
                                )}
                            </div>
                            <a href="/chat-about-funding" className="btn btn-primary polished-hero-btn">
                                Lets have a chat
                            </a>
                        </div>
                        <div className="polished-hero-image">
                            <img
                                src={post.image || heroImage}
                                alt={post.title}
                                onError={(e) => {
                                    e.currentTarget.src = '/hero-desktop.webp';
                                    e.currentTarget.onerror = null;
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="polished-body">
                <div className="polished-body__inner">
                    <div className="polished-content-card">
                        <div
                            className="blog-post-content"
                            dangerouslySetInnerHTML={{ __html: post.content || '<p>No article content found.</p>' }}
                        />
                    </div>

                    <div id="author" className="director-cards single-column" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                        <div className="director-card">
                            <img src={authorData.image} alt={post.author} className="director-avatar-photo" />
                            <div className="director-info">
                                <h4>{post.author}</h4>
                                <p className="director-title">{authorData.title}</p>
                                <p className="director-bio">{authorData.bio}</p>
                                <div className="director-social-links">
                                    <div className="contact-link-row">
                                        <a href={'mailto:' + authorData.email} className="director-email gold-link">
                                            {authorData.email}
                                        </a>
                                    </div>
                                    <div className="contact-link-row">
                                        <a href="tel:03300434281" className="director-phone gold-link">
                                            0330 043 4281
                                        </a>
                                    </div>
                                    {authorData.linkedIn && (
                                        <div className="contact-link-row">
                                            
                                                href={authorData.linkedIn}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="director-linkedin-btn"
                                                title="Connect on LinkedIn"
                                            >
                                                <LinkedInIcon />
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
