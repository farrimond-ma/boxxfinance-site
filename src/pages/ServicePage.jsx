import React from 'react';
import { useParams, Link } from 'react-router-dom';
import './ServicePage.css';

import { serviceContent } from '../data/services';
import SEO from '../components/SEO';
import ResourceHero, { FinalCtaBand, FloatingCta } from '../components/resource/ResourceHero';
import FundingCards from '../components/resource/FundingCards';
import { pickHero } from '../components/resource/heroPool';
import '../components/resource/ResourcePage.css';

const ServicePage = () => {
    const { slug } = useParams();
    const service = serviceContent[slug];

    if (!service) {
        return (
            <div className="container section text-center">
                <h2>Service Not Found</h2>
                <Link to="/" className="btn btn-primary">Return Home</Link>
            </div>
        );
    }

    // Bridging service gets a property hero from the pool; others use a
    // service-specific Pexels image (fetched to /images/hero/service-<slug>.webp).
    // The blended hero falls back to solid navy if the file is missing.
    const isBridging = slug === 'bridging-finance' || (service.title || '').toLowerCase().includes('bridging');
    const heroImage = isBridging ? pickHero(slug) : `/images/hero/service-${slug}.webp`;

    return (
        <div className="resource-page">
            <SEO
                title={service.metaTitle || service.title}
                description={service.metaDescription || service.description}
                keywords={service.metaKeywords}
                schema={service.schema}
                type="service"
            />

            <ResourceHero
                title={service.title}
                description={service.description}
                heroImage={heroImage}
                primaryCtaTo={`/chat-about-funding/${slug}`}
            />

            <div className="resource-column">
                <div className="resource-main-card">
                    <div className="blog-post-content">
                        {service.content}
                    </div>
                </div>

                <FundingCards currentService={slug} />
            </div>

            <FinalCtaBand />
            <FloatingCta />
        </div>
    );
};

export default ServicePage;
