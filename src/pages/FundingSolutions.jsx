import React from 'react';
import { Link } from 'react-router-dom';
import { serviceContent } from '../data/services';
import SEO from '../components/SEO';
import '../components/resource/ResourcePage.css'; // shared hero design language
import './FundingSolutions.css';

// Ordered for display: property/asset products first, then cashflow/working capital
const DISPLAY_ORDER = [
    'bridging-loans',
    'development-finance',
    'commercial-mortgages',
    'asset-finance',
    'asset-refinance',
    'business-loans',
    'working-capital',
    'invoice-finance',
    'merchant-cash-advance',
    'trade-finance',
    'tax-vat-funding',
    'structured-finance',
];

const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'UK Commercial Finance & Business Funding Solutions — Boxx Commercial Finance',
    description:
        'A full overview of the commercial finance and business funding solutions Boxx Commercial Finance arranges for UK businesses, including bridging finance, development finance, commercial mortgages, asset finance, invoice finance, and more.',
    url: 'https://boxxfinance.co.uk/funding-solutions',
    mainEntity: {
        '@type': 'ItemList',
        itemListElement: DISPLAY_ORDER.map((slug, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: serviceContent[slug]?.title || slug,
            url: `https://boxxfinance.co.uk/funding-solutions/${slug}`,
        })),
    },
};

const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: 'What types of commercial finance does Boxx Commercial Finance offer?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Boxx Commercial Finance arranges 12 types of business funding for UK businesses: bridging finance, development finance, commercial mortgages, asset finance, asset refinance, business loans, working capital facilities, invoice finance, merchant cash advance, trade finance, tax & VAT funding, and structured finance. Each solution is matched to your specific business circumstances and growth objectives.',
            },
        },
        {
            '@type': 'Question',
            name: 'How do I know which type of business funding is right for me?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'The right funding type depends on your purpose, security, and timescale. Bridging finance suits short-term property transactions. Development finance is for ground-up or heavy refurbishment projects. Commercial mortgages are for long-term property acquisition. Asset finance spreads the cost of equipment. Invoice finance, working capital, and merchant cash advance address cash flow. Speaking to a specialist at Boxx Commercial Finance is the fastest way to identify the most cost-effective structure for your situation.',
            },
        },
        {
            '@type': 'Question',
            name: 'What is the difference between bridging finance and development finance?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Bridging finance is a short-term secured loan (typically 1–18 months) used to bridge a funding gap — for example, buying a property before selling another, or completing an auction purchase. Development finance is specifically designed for property development projects and is drawn down in stages as the build progresses, with the loan sized against the gross development value (GDV) rather than the current asset value.',
            },
        },
        {
            '@type': 'Question',
            name: 'Can businesses with adverse credit arrange commercial finance through Boxx?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. Many of the specialist and challenger lenders we work with have more flexible credit criteria than high street banks. Adverse credit, CCJs, or a previous insolvency does not automatically disqualify a business. The key factors are the strength of the underlying proposition, the security available, and the current trading position. We will always be honest about what is achievable and why.',
            },
        },
        {
            '@type': 'Question',
            name: 'How quickly can Boxx Commercial Finance arrange business funding?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Speed depends on the product and the lender. Bridging finance can complete in as little as 5–10 working days with the right preparation. Commercial mortgages typically take 4–8 weeks. Invoice finance and merchant cash advance facilities can be in place within days. In every case, having clean documentation ready (accounts, bank statements, security details) is the single biggest factor in reducing timescales.',
            },
        },
    ],
};

const FundingSolutions = () => {
    const servicesArray = DISPLAY_ORDER.map(slug => ({
        slug,
        ...(serviceContent[slug] || {}),
    })).filter(s => s.title);

    return (
        <div className="funding-solutions-page">
            <SEO
                title="UK Commercial Finance &amp; Business Funding Solutions"
                description="UK commercial finance broker — no lender ties. We arrange bridging finance, development finance, commercial mortgages, asset finance, invoice finance and more."
                keywords="commercial finance UK, business funding solutions, bridging finance, development finance, commercial mortgages, asset finance, invoice finance, working capital"
                schema={[schema, faqSchema]}
            />

            {/* Same navy→property-image hero used across the site (ResourcePage.css). */}
            <div
                className="resource-hero has-hero-image"
                style={{ '--hero-image': 'url("/images/hero/service-commercial-mortgages.webp")' }}
            >
                <div className="container resource-hero-grid">
                    <div className="resource-hero-text">
                        <h1>
                            Commercial <span className="text-highlight">Funding Solutions</span>
                        </h1>
                        <p className="resource-hero-lead">
                            We are a whole-of-market commercial finance broker, not a lender — our only job
                            is to find the structure that serves your business, not the product that suits
                            our book. Below, a plain-English overview of every funding type we arrange.
                        </p>
                        <div className="resource-hero-actions">
                            <Link to="/chat-about-funding" className="btn btn-primary">Get a free quote</Link>
                            <a href="tel:03300431612" className="btn btn-outline resource-btn-phone">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                                Talk to an expert
                            </a>
                        </div>
                        <ul className="resource-hero-trust" aria-label="Why choose Boxx">
                            <li>Independent broker</li>
                            <li>Whole of market</li>
                            <li>Fast decisions</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Service grid */}
            <section className="section fs-grid-section">
                <div className="container">
                    <div className="section-header">
                        <h2>Our Funding <span className="text-highlight">Solutions</span></h2>
                    </div>
                    <div className="fs-grid">
                        {servicesArray.map(service => (
                            <div key={service.slug} className="fs-card">
                                {service.icon && (
                                    <div className="fs-card-icon">{service.icon}</div>
                                )}
                                <h2 className="fs-card-title">{service.title}</h2>
                                <p className="fs-card-desc">{service.description}</p>
                                <Link
                                    to={`/funding-solutions/${service.slug}`}
                                    className="fs-card-link"
                                    aria-label={`Full guide to ${service.title} for UK businesses`}
                                >
                                    {service.title} solutions &rarr;
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ for AEO */}
            <section className="section fs-faq-section">
                <div className="container fs-faq-inner">
                    <h2>Frequently Asked <span className="text-highlight">Questions</span></h2>
                    <dl className="fs-faq">
                        {faqSchema.mainEntity.map((item, i) => (
                            <div key={i} className="fs-faq-item">
                                <dt>{item.name}</dt>
                                <dd>{item.acceptedAnswer.text}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            {/* CTA */}
            <section className="fs-cta-section">
                <div className="container fs-cta-inner">
                    <h2>Not sure which product fits your situation?</h2>
                    <p>
                        Most businesses don't need a product — they need a structure. Tell us what you're
                        trying to achieve and we'll tell you exactly what's available, what it will cost,
                        and whether it makes sense for your business.
                    </p>
                    <Link to="/chat-about-funding" className="btn btn-primary">
                        Speak to a funding specialist
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default FundingSolutions;
