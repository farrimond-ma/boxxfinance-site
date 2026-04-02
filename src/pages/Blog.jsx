import React from 'react';
import { Link } from 'react-router-dom';
import blogPosts from '../data/blogPosts.json';
import SEO from '../components/SEO';
import './Blog.css';

const Blog = () => {
    const publishedPosts = [...blogPosts]
        .filter((post) => post && post.status === 'published')
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    };

    return (
        <div className="blog-page">
            <SEO
                title="Commercial Funding Insights"
                description="Commercial finance insights and funding intelligence for UK business owners. Read expert guidance on business loans, asset finance, bridging and more."
                keywords="commercial finance insights, UK business funding blog, SME finance advice, business loan guidance"
            />

            <div className="blog-hero">
                <div className="container">
                    <h1>Commercial <span className="text-highlight">Funding Insights</span></h1>
                    <p>Practical funding intelligence for UK businesses.</p>
                </div>
            </div>

            <section className="section">
                <div className="container">
                    <div style={{ marginBottom: '1rem', fontSize: '0.95rem', opacity: 0.8 }}>
                        Articles found: {publishedPosts.length}
                    </div>

                    {publishedPosts.length > 0 ? (
                        <div className="blog-grid">
                            {publishedPosts.map((post) => (
                                <div key={post.id} className="blog-card">
                                    <div className="blog-card-content">
                                        <h3>
                                            <Link to={`/insights/${post.slug}`}>{post.title}</Link>
                                        </h3>
                                        <p>{post.excerpt}</p>
                                        <p className="blog-card-date">Last updated: {formatDate(post.date)}</p>
                                        <Link to={`/insights/${post.slug}`} className="read-more">
                                            Read Article &rarr;
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center">
                            <h3>No posts found.</h3>
                            <p>Check back soon for the latest updates.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Blog;
