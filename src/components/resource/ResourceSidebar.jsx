import React from 'react';
import { Link } from 'react-router-dom';
import locationIndex from '../../data/locationIndex.json';

// Sticky sidebar = conversion box + two internal-linking hubs (funding
// solutions, popular locations). Replaces the old decorative image.

const FUNDING_SOLUTIONS = [
    { slug: 'bridging-finance', title: 'Bridging Loans' },
    { slug: 'commercial-mortgages', title: 'Commercial Mortgages' },
    { slug: 'business-loans', title: 'Business Loans' },
    { slug: 'development-finance', title: 'Development Finance' },
    { slug: 'asset-finance', title: 'Asset Finance' },
    { slug: 'invoice-finance', title: 'Invoice Finance' },
];

// Priority order for "popular locations" — only rendered if the page exists
// and is published, so links never 404.
const LOCATION_PRIORITY = [
    'bridging-loans-london',
    'bridging-loans-birmingham',
    'bridging-loans-city-of-london',
    'bridging-loans-bristol',
    'bridging-loans-manchester',
    'bridging-loans-leeds',
];

const popularLocations = LOCATION_PRIORITY
    .map((slug) => locationIndex.find((p) => p && p.slug === slug && p.status === 'published'))
    .filter(Boolean)
    .slice(0, 5);

const ResourceSidebar = () => (
    <aside className="resource-sidebar">
        <div className="resource-sidebar-cta">
            <h3>Need funding?</h3>
            <ul className="resource-sidebar-ticks">
                <li>Independent broker</li>
                <li>Whole of market</li>
                <li>Fast decisions</li>
                <li>Speak to a real expert</li>
            </ul>
            <Link to="/chat-about-funding" className="btn btn-primary">Start your enquiry</Link>
            <a href="tel:03300431612" className="resource-sidebar-phone">or call 0330 043 1612</a>
        </div>

        <div className="resource-sidebar-links">
            <h3>Funding solutions</h3>
            <ul>
                {FUNDING_SOLUTIONS.map((s) => (
                    <li key={s.slug}>
                        <Link to={`/funding-solutions/${s.slug}`}>{s.title}</Link>
                    </li>
                ))}
            </ul>
        </div>

        {popularLocations.length > 0 && (
            <div className="resource-sidebar-links">
                <h3>Popular locations</h3>
                <ul>
                    {popularLocations.map((p) => (
                        <li key={p.slug}>
                            <Link to={`/locations/${p.slug}`}>{p.title}</Link>
                        </li>
                    ))}
                </ul>
            </div>
        )}
    </aside>
);

export default ResourceSidebar;
