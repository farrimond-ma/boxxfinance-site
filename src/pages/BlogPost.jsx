import React, { useState, useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import blogPosts from '../data/blogPosts.json';
import Sidebar from '../components/Sidebar';
import SEO from '../components/SEO';
import RelatedArticles from '../components/RelatedArticles';
import './Blog.css';
import '../components/About.css';

const BlogPost = () => {
    const { slug } = useParams();
    const [imageError, setImageError] = useState(false);
    const post = blogPosts.find(p => p.slug === slug);
    console.log(`DEBUG: Viewing post [${slug}]:`, post);

    const sidebarImages = [
        '/header_bg.png',
        '/images/sidebar/sidebar_meeting.jpg',
        '/images/sidebar/sidebar_handshake.jpg',
        '/images/sidebar/sidebar_office.jpg'
    ];

    const sidebarImage = useMemo(() => {
        if (slug === 'merchant-cash-advance-retailers') {
            return '/about_bg.png';
        }
        return sidebarImages[Math.floor(Math.random() * sidebarImages.length)];
    }, [slug]);

    if (!post) {
        return <Navigate to="/insights" replace />;
    }


    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    };

    const authors = {
        'Mark Higgins': {
            title: 'Managing Partner, Commercial Finance',
            image: '/mark-higgins.png',
            bio: 'With extensive experience across commercial mortgages, development finance and structured lending, Mark leads client relationships and complex case structuring. He has helped hundreds of UK businesses secure the right funding at the right terms.',
            email: 'mark@boxxfinance.co.uk',
            linkedIn: 'https://www.linkedin.com/in/mark-higgins-05ab363b2/'
        },
        'Andrew Farrimond': {
            title: 'Managing Partner, Commercial Finance',
            image: '/andrew-farrimond.png',
            bio: 'Andrew specialises in invoice finance, asset finance and working capital solutions, with a strong track record in helping growth-stage businesses unlock the liquidity they need to scale. His whole-of-market approach ensures clients receive competitive, lender-agnostic advice.',
            email: 'andrew@boxxfinance.co.uk',
            linkedIn: 'https://www.linkedin.com/in/commercial-funding/'
        }
    };

    const authorData = authors[post.author] || authors['Mark Higgins'];

    return (
        <div className="blog-post-page">
            <SEO
                title={post.metaTitle || post.title}
                description={post.metaDescription || post.excerpt}
                keywords={post.keywords}
                schema={post.schema}
                type="article"
            />
            <div className="blog-hero" style={{ padding: '10rem 0 6rem' }}>
                <div className="container">
                    <h1>
                        {post.title.split(' ').slice(0, -2).join(' ')}{' '}
                        <span className="text-highlight">
                            {post.title.split(' ').slice(-2).join(' ')}
                        </span>
                    </h1>
                    <p className="blog-post-date">Last updated: {formatDate(post.date)}</p>
                </div>
            </div>

            <div className="container blog-layout">
                {/* Main Content */}
                <div className="blog-main">
                    <div className="blog-main-card">
                        <div className="blog-post-content" dangerouslySetInnerHTML={{ __html: post.content }}></div>
                    </div>

                    {/* Author Bio - Moved inside blog-main to match content width */}
                    <div className="director-cards single-column" style={{ marginTop: '0', marginBottom: '3rem' }}>
                        <div className="director-card">
                            <img src={authorData.image} alt={post.author} className="director-avatar-photo" />
                            <div className="director-info">
                                <h4>{post.author}</h4>
                                <p className="director-title">{authorData.title}</p>
                                <p className="director-bio">{authorData.bio}</p>
                                <div className="director-social-links">
                                    <div className="contact-link-row">
                                        <a href={`mailto:${authorData.email}`} className="director-email gold-link">{authorData.email}</a>
                                    </div>
                                    <div className="contact-link-row">
                                        <a href="tel:03300434281" className="director-phone gold-link">0330 043 4281</a>
                                    </div>
                                    {authorData.linkedIn && (
                                        <div className="contact-link-row">
                                            <a href={authorData.linkedIn} target="_blank" rel="noopener noreferrer" className="director-linkedin-btn" title="Connect on LinkedIn">
                                                <svg className="linkedin-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                                </svg>
                                                Connect on LinkedIn
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Related Articles - Moved inside blog-main to ensure left alignment with content */}
                    <div style={{ marginBottom: '4rem' }}>
                        <RelatedArticles currentSlug={slug} />
                    </div>
                </div>

                {/* Sidebar */}
                <div className="blog-sidebar">
                    <div className="sidebar-overlap-image">
                        <img src={sidebarImage} alt="Commercial finance funding specialists — Boxx Commercial Finance" />
                    </div>
                    <Sidebar />
                </div>
            </div>
        </div>
    );
};

export default BlogPost;
