import React from 'react';
import { Link } from 'react-router-dom';

// "You may also need" — service cards that link to the money pages. Strong
// internal-linking + conversion signal on every article. The current page's
// own service is filtered out so we never link a page to itself.
const ALL = [
    { slug: 'bridging-finance', title: 'Bridging Loans', blurb: 'Fast short-term property funding' },
    { slug: 'commercial-mortgages', title: 'Commercial Mortgages', blurb: 'Long-term property finance' },
    { slug: 'business-loans', title: 'Business Loans', blurb: 'Flexible funding for growth' },
    { slug: 'development-finance', title: 'Development Finance', blurb: 'Fund your build or conversion' },
    { slug: 'asset-finance', title: 'Asset Finance', blurb: 'Spread the cost of equipment' },
    { slug: 'invoice-finance', title: 'Invoice Finance', blurb: 'Release cash tied up in invoices' },
];

// Normalise to a comparable stem: lowercase, alphanumeric only, drop a
// trailing plural 's' so "Commercial Mortgage" matches the "commercial-mortgages"
// card and a page never links to its own service.
const stem = (s) => (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z]+/g, '').replace(/s$/, '');

const FundingCards = ({ currentService }) => {
    const key = stem(currentService);
    const cards = ALL.filter((c) => stem(c.slug) !== key).slice(0, 4);

    return (
        <section className="resource-funding-cards" aria-label="Other funding options">
            <h2>You may also need</h2>
            <div className="funding-cards-grid">
                {cards.map((c) => (
                    <Link key={c.slug} to={`/funding-solutions/${c.slug}`} className="funding-card">
                        <span className="funding-card-title">{c.title}</span>
                        <span className="funding-card-blurb">{c.blurb}</span>
                    </Link>
                ))}
            </div>
        </section>
    );
};

export default FundingCards;
