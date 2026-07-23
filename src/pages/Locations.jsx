import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import locationPages from '../data/locationPages.json';
import '../components/resource/ResourcePage.css'; // shared hero design language
import './Locations.css';

/**
 * /locations — the hub page that gives every location page an internal link.
 *
 * Why this exists: 155 of 209 location pages had NO internal links anywhere on
 * the site — their only discovery path was the sitemap, and Google was
 * reporting them as "URL is unknown to Google" (verified via the URL
 * Inspection watchdog, 21 Jul 2026). Sitemap-only programmatic pages get
 * deprioritised; a footer-linked hub gives each one a crawl path.
 */

// The data's service names are inconsistent ("Business Loans" vs
// "business-loans") and use the internal "Bridging Finance" taxonomy value.
// Normalise for grouping, and display "Bridging Loans" per the sitewide
// terminology decision.
const DISPLAY_NAMES = {
    'bridging finance': 'Bridging Loans',
    'business loans': 'Business Loans',
    'development finance': 'Development Finance',
    'invoice finance': 'Invoice Finance',
    'asset finance': 'Asset Finance',
    'commercial mortgages': 'Commercial Mortgages',
    'working capital': 'Working Capital',
    'trade finance': 'Trade Finance',
    'asset refinance': 'Asset Refinance',
    'merchant cash advance': 'Merchant Cash Advance',
    'structured finance': 'Structured Finance',
    'tax & vat funding': 'Tax & VAT Funding',
};

const normaliseService = (raw) => {
    const key = String(raw || '').replace(/-/g, ' ').trim().toLowerCase();
    return DISPLAY_NAMES[key] || key.replace(/\b\w/g, (c) => c.toUpperCase());
};

const buildGroups = () => {
    const groups = new Map();
    for (const page of locationPages) {
        if (page.status && page.status !== 'published') continue;
        if (!page.slug || !page.location) continue;
        const service = normaliseService(page.service);
        if (!groups.has(service)) groups.set(service, []);
        groups.get(service).push({ slug: page.slug, location: page.location });
    }
    for (const towns of groups.values()) {
        towns.sort((a, b) => a.location.localeCompare(b.location));
    }
    // Bridging Loans first (the strategic focus), then by section size.
    return [...groups.entries()].sort((a, b) => {
        if (a[0] === 'Bridging Loans') return -1;
        if (b[0] === 'Bridging Loans') return 1;
        return b[1].length - a[1].length;
    });
};

const Locations = () => {
    const groups = buildGroups();
    const total = groups.reduce((n, [, towns]) => n + towns.length, 0);

    return (
        <>
            <SEO
                title="UK Locations | Bridging Loans & Commercial Finance Across the UK"
                description={`Bridging loans and commercial finance arranged across ${total} UK towns and cities. Find your local Boxx Commercial Finance coverage, from bridging loans to commercial mortgages.`}
                keywords="bridging loans UK locations, commercial finance near me, UK bridging loan broker, local business funding"
            />

            <div className="resource-hero">
                <div className="container resource-hero-grid">
                    <div className="resource-hero-text">
                        <h1>
                            Our UK <span className="text-highlight">Locations</span>
                        </h1>
                        <p className="resource-hero-lead">
                            We arrange bridging loans and commercial funding for clients across the UK —
                            {' '}{total} towns and cities and counting. Every case is handled by the same
                            team, wherever you are; these pages cover what we arrange in each area.
                        </p>
                    </div>
                </div>
            </div>

            <div className="container locations-body">
                {groups.map(([service, towns]) => (
                    <section key={service} className="locations-section" aria-labelledby={`loc-${service.replace(/\W+/g, '-')}`}>
                        <h2 id={`loc-${service.replace(/\W+/g, '-')}`}>
                            {service} <span className="locations-count">({towns.length})</span>
                        </h2>
                        <ul className="locations-grid">
                            {towns.map((t) => (
                                <li key={t.slug}>
                                    <Link to={`/locations/${t.slug}`}>{t.location}</Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}

                <div className="locations-cta">
                    <p>
                        Don't see your town? We cover the whole of the UK —{' '}
                        <Link to="/chat-about-funding/bridging-loans">tell us what you need</Link> and
                        we'll take it from there.
                    </p>
                </div>
            </div>
        </>
    );
};

export default Locations;
