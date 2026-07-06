import React from 'react';
import { Link } from 'react-router-dom';
import blogPosts from '../data/blogIndex.json';
import locationPages from '../data/locationIndex.json';
import './RelatedArticles.css';

// Pull the slug off the end of a full boxxfinance.co.uk URL, e.g.
// "https://boxxfinance.co.uk/insights/what-is-bridging-finance" -> "what-is-bridging-finance"
const slugFromUrl = (url = '') => url.replace(/\/+$/, '').split('/').pop();

// Build a keyword-rich anchor phrase for a related blog post. Falls back
// through the post's primary keyword, then its title, so the link text
// always describes *what the destination is about* — good for SEO topical
// relevance and AEO (answer engines weigh descriptive anchor text heavily).
const blogAnchorText = (post) => {
    const keywordList = Array.isArray(post.keywords)
        ? post.keywords
        : (post.keywords || '').split(',');
    const firstKeyword = (keywordList[0] || '').trim();
    if (firstKeyword && firstKeyword.length > 3) {
        // Title-case the keyword phrase so it reads naturally as a link
        const phrase = firstKeyword.replace(/\b\w/g, c => c.toUpperCase());
        return `Read our guide: ${phrase}`;
    }
    return post.title;
};

// Location page titles are already formatted as "{Service} {Location}"
// (e.g. "Bridging Finance London") — naturally keyword-rich as anchor text.
const locationAnchorText = (loc) => loc.title;

const RelatedArticles = ({ currentSlug, type = 'blog' }) => {
    // Selection Logic:
    // If legal page, show specific cornerstone articles
    // If blog post, use the relatedBlogUrls / relatedLocationUrls the
    // publisher already computed for this post (real topical relevance,
    // not a hardcoded ID map that goes stale the moment new posts ship)

    let related = [];
    let relatedLocations = [];

    if (type === 'legal') {
        // For legal pages, show general overview guides
        related = blogPosts.filter(p => [1, 2].includes(p.id));
    } else {
        const currentPost = blogPosts.find(p => p.slug === currentSlug);

        if (currentPost) {
            const blogSlugs = (currentPost.relatedBlogUrls || []).map(slugFromUrl);
            const locationSlugs = (currentPost.relatedLocationUrls || []).map(slugFromUrl);

            related = blogSlugs
                .map(slug => blogPosts.find(p => p.slug === slug && p.slug !== currentSlug))
                .filter(Boolean);

            relatedLocations = locationSlugs
                .map(slug => locationPages.find(l => l.slug === slug))
                .filter(Boolean)
                .slice(0, 4);

            // Fallback for any post that predates relatedBlogUrls or whose
            // linked slugs no longer resolve — show the two latest posts
            // rather than rendering an empty section.
            if (related.length === 0) {
                related = blogPosts.filter(p => p.slug !== currentSlug).slice(0, 2);
            }
            related = related.slice(0, 2);
        }
    }

    if (related.length === 0 && relatedLocations.length === 0) return null;

    return (
        <section className="related-articles">
            <h3 className="related-title">
                {type === 'legal' ? 'You may be interested in these...' : 'Related Articles'}
            </h3>
            {related.length > 0 && (
                <div className="related-grid">
                    {related.map(post => (
                        <div key={post.id} className="related-card">
                            <div className="related-card-content">
                                <h4>{post.title}</h4>
                                <p>{post.excerpt}</p>
                                <Link to={`/insights/${post.slug}`} className="related-link">
                                    {type === 'legal' ? 'Read Article' : blogAnchorText(post)} &rarr;
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {type !== 'legal' && relatedLocations.length > 0 && (
                <ul className="related-locations">
                    {relatedLocations.map(loc => (
                        <li key={loc.slug}>
                            <Link to={`/locations/${loc.slug}`} className="related-location-link">
                                {locationAnchorText(loc)} &rarr;
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

export default RelatedArticles;
