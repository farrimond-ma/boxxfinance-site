import React from 'react';
import './HeroStats.css';

/**
 * Headline figures under the homepage hero (2026-11-25, approved by Mark).
 *
 * A borrower's first two questions are "am I in the right place?" and "roughly
 * what will this cost?". The page answered neither without reading a paragraph,
 * which is the main thing competitor bridging sites do better.
 *
 * Every figure is defensible:
 *   0.45%   Octopus Real Estate, regulated bridging starting rate (lender pages)
 *   £50,000 Boxx's own practical minimum, Mark's call 2026-11-26. Deliberately
 *           NOT the panel's technical floor (Together will go to about £25,000):
 *           it matches the enquiry form, where anything under £50,000 is routed
 *           to the chat assistant rather than an adviser. Keep the two in step.
 *   £30m    West One Loans, the highest maximum on the panel (lender pages)
 *   3 to 24 months, the usual span of bridging terms across the panel
 *
 * These are financial promotions. The qualifier is part of the block, not
 * decoration: if the panel changes, change the figures and the qualifier
 * together, and check the lender pages still support whatever is claimed here.
 */
const STATS = [
    { figure: 'From 0.45%', label: 'a month on qualifying bridging' },
    { figure: '£50,000 to £30m', label: 'across our lender panel' },
    { figure: '3 to 24 months', label: 'typical bridging terms' },
];

const HeroStats = () => (
    <section className="hero-stats" aria-label="Bridging loans at a glance">
        <div className="container">
            <dl>
                {STATS.map(({ figure, label }) => (
                    <div key={figure}>
                        <dt>{figure}</dt>
                        <dd>{label}</dd>
                    </div>
                ))}
            </dl>
            <p className="hero-stats-note">
                Indicative only. The rate and terms you are offered depend on the property, the
                loan to value, your circumstances and the lender, and are subject to status.
            </p>
        </div>
    </section>
);

export default HeroStats;
