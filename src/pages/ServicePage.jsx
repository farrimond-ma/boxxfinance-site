import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import './ServicePage.css';

import { serviceContent } from '../data/services';
import Sidebar from '../components/Sidebar';
import SEO from '../components/SEO';

const ServicePage = () => {
    const { slug } = useParams();
    const [imageError, setImageError] = useState(false);
    const service = serviceContent[slug];

    const sidebarImages = [
        '/header_bg.png',
        '/images/sidebar/sidebar_meeting.jpg',
        '/images/sidebar/sidebar_handshake.jpg',
        '/images/sidebar/sidebar_office.jpg'
    ];

    // Select a random image based on the slug to keep it consistent for that page per session
    // Or just a truly random one. Let's do truly random on each mount.
    const [sidebarImage] = useState(() => sidebarImages[Math.floor(Math.random() * sidebarImages.length)]);

    if (!service) {
        return (
            <div className="container section text-center">
                <h2>Service Not Found</h2>
                <Link to="/" className="btn btn-primary">Return Home</Link>
            </div>
        );
    }

    const formatTitle = (title) => {
        const words = title.split(' ');
        if (words.length < 2) return title;
        const firstWord = words[0];
        const rest = words.slice(1).join(' ');
        return (
            <>
                {firstWord} <span className="text-highlight">{rest}</span>
            </>
        );
    };

    return (
        <div className="service-page">
            <SEO
                title={service.metaTitle || service.title}
                description={service.metaDescription || service.description}
                keywords={service.metaKeywords}
                schema={service.schema}
                type="service"
            />
            <div className="service-hero">
                <div className="container">
                    <h1>{formatTitle(service.title)}</h1>
                    <p>{service.description}</p>
                </div>
            </div>

            <div className="container service-layout">
                {/* Main Content Area */}
                <div className="service-main">
                    {!imageError && service.image && (
                        <div className="service-header-image">
                            <img
                                src={service.image}
                                alt={service.title}
                                onError={() => setImageError(true)}
                            />
                        </div>
                    )}

                    <div className="service-content">
                        {service.content}

                        <div className="service-cta-box" style={{ marginTop: '3rem', padding: '2rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <h3>{service.ctaOverride?.title || `Ready to secure your ${service.title}?`}</h3>
                            <p style={{ marginBottom: '1.5rem' }}>
                                {service.ctaOverride?.text || "Start your application today and our specialists will review your requirements within 24 hours."}
                            </p>
                            <Link to={`/chat-about-funding/${slug}`} className="btn btn-primary">
                                {service.ctaOverride?.buttonText || "Speak to us"}
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Sidebar Area */}
                <div className="service-sidebar">
                    <div className="sidebar-overlap-image">
                        <img src={sidebarImage} alt="Commercial finance funding specialists — Boxx Commercial Finance" />
                    </div>
                    <Sidebar />
                </div>
            </div>
        </div>
    );
};

export default ServicePage;
