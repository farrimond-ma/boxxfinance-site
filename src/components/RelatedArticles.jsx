import React from 'react';
import { Link } from 'react-router-dom';
import blogPosts from '../data/blogPosts.json';
import './RelatedArticles.css';

const RelatedArticles = ({ currentSlug, type = 'blog' }) => {
    // Selection Logic:
    // If legal page, show specific cornerstone articles
    // If blog post, try to find similar content or show latest

    let related = [];

    if (type === 'legal') {
        // For legal pages, show general overview guides
        related = blogPosts.filter(p => [1, 2].includes(p.id));
    } else {
        const currentPost = blogPosts.find(p => p.slug === currentSlug);

        if (currentPost) {
            // Simple similarity: same category or fallback
            // (In a real app we'd use tags, here we filter by ID range/context)
            const others = blogPosts.filter(p => p.slug !== currentSlug);

            // Hardcoded "similar" suggestions for best UX
            const suggestions = {
                1: [2, 8], // Guide -> Explained, Broker
                2: [1, 8], // Explained -> Guide, Broker
                3: [10, 6], // Bad Credit -> MCA, Asset
                4: [3, 10], // Invoice -> Bad Credit, MCA
                5: [7, 9], // Mortgage -> Bridging, Development
                6: [4, 1], // Asset -> Invoice, Guide
                7: [5, 9], // Bridging -> Mortgage, Development
                8: [1, 2], // Broker -> Guide, Explained
                9: [7, 5], // Development -> Bridging, Mortgage
                10: [3, 4] // MCA -> Bad Credit, Invoice
            };

            const ids = suggestions[currentPost.id] || [1, 2];
            related = others.filter(p => ids.includes(p.id)).slice(0, 2);

            // Fallback if less than 2
            if (related.length < 2) {
                related = others.slice(0, 2);
            }
        }
    }

    if (related.length === 0) return null;

    return (
        <section className="related-articles">
            <h3 className="related-title">
                {type === 'legal' ? 'You may be interested in these...' : 'Related Articles'}
            </h3>
            <div className="related-grid">
                {related.map(post => (
                    <div key={post.id} className="related-card">
                        <div className="related-card-content">
                            <h4>{post.title}</h4>
                            <p>{post.excerpt}</p>
                            <Link to={`/insights/${post.slug}`} className="related-link">
                                Read Article &rarr;
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default RelatedArticles;
