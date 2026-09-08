import React from 'react';
import { Link } from 'react-router-dom';
import { ResourceHero } from './resource/ResourceHero';

/**
 * Bridging-led hero.
 *
 * Renders through the same ResourceHero every blog post, location page and
 * service page already uses (see resource/ResourceHero.jsx), rather than a
 * parallel hand-tuned copy — the previous version had its own CSS approximating
 * the same navy/image-blend/breakpoint pattern with slightly different values
 * (breakpoint, gradient angle, container widths), which is exactly the kind of
 * drift that's caused real bugs elsewhere in this codebase when two things
 * meant to look identical are actually maintained as two things.
 *
 * The site's content strategy is overwhelmingly bridging loans — 156 of 205
 * location pages, 66 of 103 blog posts, and the last 25 posts without
 * exception. Visitors arriving from that content previously landed on a
 * generalist "tailored commercial finance" message with bridging presented as
 * one of ten equal products: a mismatch between where the traffic comes from
 * and what the page answers.
 *
 * This leads with bridging while keeping the brand line and an explicit route
 * to the full range, so broader enquiries are not lost.
 */
const Hero = () => (
    <ResourceHero
        eyebrow="UK Bridging Loan Specialists"
        title={
            <>
                Bridging Loans.<br />
                <span className="text-highlight">Funded Fast.</span>
            </>
        }
        description="Short-term property funding for auction purchases, chain breaks, refurbishments and probate. We structure bridging loans for homeowners, landlords, investors and developers — around a clear exit plan, not just a headline rate."
        heroImage="/images/hero/bridging-1.webp"
        primaryCtaTo="/chat-about-funding/bridging-loans"
        afterTrust={
            <p className="resource-hero-secondary">
                Also arranging asset finance, commercial mortgages, development finance and
                invoice finance — <Link to="/funding-solutions">see all funding options</Link>.
            </p>
        }
    />
);

export default Hero;
