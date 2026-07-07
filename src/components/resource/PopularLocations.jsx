import React from 'react';
import { Link } from 'react-router-dom';
import locationIndex from '../../data/locationIndex.json';

// "Looking for funding near you?" — internal-link section below the article
// (replaces the retired sidebar's location list). Only renders links to
// pages that exist and are published, so it never 404s.
const LOCATION_PRIORITY = [
    'bridging-loans-london',
    'bridging-loans-birmingham',
    'bridging-loans-city-of-london',
    'bridging-loans-bristol',
    'bridging-loans-manchester',
    'bridging-loans-leeds',
    'bridging-loans-reading',
    'bridging-loans-norwich',
];

const PopularLocations = ({ currentSlug }) => {
    const locations = LOCATION_PRIORITY
        .filter((slug) => slug !== currentSlug)
        .map((slug) => locationIndex.find((p) => p && p.slug === slug && p.status === 'published'))
        .filter(Boolean)
        .slice(0, 6);

    if (locations.length === 0) return null;

    return (
        <section className="resource-locations" aria-label="Popular locations">
            <h2>Looking for funding near you?</h2>
            <div className="resource-locations-grid">
                {locations.map((p) => (
                    <Link key={p.slug} to={`/locations/${p.slug}`} className="resource-location-pill">
                        {p.title}
                    </Link>
                ))}
            </div>
        </section>
    );
};

export default PopularLocations;
