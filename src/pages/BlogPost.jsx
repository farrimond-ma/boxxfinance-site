import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import blogPosts from '../data/blogIndex.json';
import SEO from '../components/SEO';
import ResourcePage from '../components/resource/ResourcePage';
import { pickHero } from '../components/resource/heroPool';

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

const SITE_URL = 'https://boxxfinance.co.uk';

const BlogPost = () => {
    const { slug } = useParams();

    const normalisedSlug = decodeURIComponent(String(slug || ''))
        .trim()
        .replace(/^\/+|\/+$/g, '')
        .toLowerCase();

    const publishedPosts = blogPosts.filter((post) => post && post.status === 'published');
    const post = publishedPosts.find((p) => {
        const postSlug = String(p.slug || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
        return postSlug === normalisedSlug;
    });

    // Article body + structured data live in a per-slug file fetched on demand.
    const [fullPost, setFullPost] = useState(null);
    useEffect(() => {
        if (!post) return undefined;
        let cancelled = false;
        setFullPost(null);
        fetch(`/content/insights/${encodeURIComponent(post.slug)}.json`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => { if (!cancelled) setFullPost(data); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [post && post.slug]);

    if (!post) {
        return (
            <div className="blog-post-page">
                <SEO title="Article Not Found" description="The requested article could not be found." keywords="boxx commercial finance, insights" />
                <div className="service-hero">
                    <div className="container">
                        <h1>Article <span className="text-highlight">Not Found</span></h1>
                        <p>The article you requested could not be found.</p>
                    </div>
                </div>
                <div className="container" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>
                    <div className="blog-main-card" style={{ padding: '2rem' }}>
                        <p><Link to="/insights" className="read-more">← Back to Insights</Link></p>
                    </div>
                </div>
            </div>
        );
    }

    const authorData = AUTHORS[post.author] || AUTHORS['Mark Higgins'];
    // Bridging posts use the curated property pool so none can show an
    // off-theme (e.g. office) image baked in at publish time. Other services
    // keep their own hero.
    const isBridging = (post.service || '').toLowerCase().includes('bridging');
    const heroImage = isBridging ? pickHero(post.slug) : (post.heroImage || post.image || null);

    const articleSchema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.metaTitle || post.title,
        description: post.metaDescription || post.excerpt || '',
        image: heroImage ? (heroImage.startsWith('http') ? heroImage : `${SITE_URL}${heroImage}`) : `${SITE_URL}/header_bg.png`,
        datePublished: post.date || '',
        dateModified: post.date || '',
        author: { '@type': 'Person', name: post.author || 'Mark Higgins', url: `${SITE_URL}/` },
        publisher: { '@type': 'Organization', name: 'Boxx Commercial Finance', logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/insights/${post.slug}` },
    };

    const heroDescription =
        post.metaDescription || post.excerpt ||
        'Practical insight from the commercial finance specialists at Boxx Commercial Finance.';

    return (
        <>
            <SEO
                title={post.metaTitle || post.title}
                description={post.metaDescription || post.excerpt}
                keywords={post.keywords}
                schema={fullPost && fullPost.schema ? [articleSchema, fullPost.schema] : articleSchema}
                type="article"
                canonical={`/insights/${post.slug}`}
                image={heroImage}
            />
            <ResourcePage
                title={post.title}
                heroDescription={heroDescription}
                heroImage={heroImage}
                service={post.service}
                author={{ name: post.author || 'Mark Higgins', ...authorData }}
                contentHtml={fullPost ? (fullPost.content || '<p>No article content found.</p>') : null}
                faqSchema={fullPost && fullPost.schema && fullPost.schema['@type'] === 'FAQPage' ? fullPost.schema : null}
                videoId={post.videoId}
                relatedSlug={post.slug}
            />
            <Link to="/chat-about-funding" className="resource-float-cta" aria-label="Need funding? Talk to us">
                <span>Need funding?</span> Talk to us
            </Link>
        </>
    );
};

export default BlogPost;
