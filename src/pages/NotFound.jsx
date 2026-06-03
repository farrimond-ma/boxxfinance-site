import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './Blog.css';

const NotFound = () => {
    return (
        <div className="blog-post-page">
            <SEO
                title="Page Not Found | Boxx Commercial Finance"
                description="The page you are looking for could not be found. Browse our funding solutions or get in touch with our team."
            />
            <div className="legal-hero" style={{ padding: '10rem 0 6rem' }}>
                <div className="container">
                    <h1>Page <span className="text-highlight">Not Found</span></h1>
                </div>
            </div>

            <div className="container" style={{ padding: '4rem 0 6rem', textAlign: 'center' }}>
                <p style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#4a5568' }}>
                    Sorry, the page you are looking for does not exist or has been moved.
                </p>
                <p style={{ marginBottom: '2.5rem', color: '#718096' }}>
                    If you followed a link to get here, it may be out of date.
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link
                        to="/"
                        style={{
                            background: '#031b49',
                            color: '#fff',
                            padding: '0.85rem 2rem',
                            borderRadius: '4px',
                            textDecoration: 'none',
                            fontWeight: '600',
                        }}
                    >
                        Back to Home
                    </Link>
                    <Link
                        to="/funding-solutions/business-loans"
                        style={{
                            background: 'transparent',
                            color: '#031b49',
                            padding: '0.85rem 2rem',
                            borderRadius: '4px',
                            textDecoration: 'none',
                            fontWeight: '600',
                            border: '2px solid #031b49',
                        }}
                    >
                        Browse Funding Solutions
                    </Link>
                    <Link
                        to="/chat-about-funding"
                        style={{
                            background: '#b8922a',
                            color: '#fff',
                            padding: '0.85rem 2rem',
                            borderRadius: '4px',
                            textDecoration: 'none',
                            fontWeight: '600',
                        }}
                    >
                        Talk to an Adviser
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
