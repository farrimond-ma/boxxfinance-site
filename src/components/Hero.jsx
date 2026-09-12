import React from 'react';
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
 * The trust ticks ("Independent broker / Whole of market / Fast decisions")
 * and the "also arranging..." funding-solutions link both moved out of the
 * hero and into the About teaser section below (About.jsx) — the hero is now
 * just the headline claim and the two primary CTAs, with the supporting
 * trust signals sitting where a visitor reads them as evidence rather than
 * as more copy competing with the call to action.
 *
 * The site's content strategy is overwhelmingly bridging loans — 156 of 205
 * location pages, 66 of 103 blog posts, and the last 25 posts without
 * exception. Visitors arriving from that content previously landed on a
 * generalist "tailored commercial finance" message with bridging presented as
 * one of ten equal products: a mismatch between where the traffic comes from
 * and what the page answers.
 *
 * This leads with bridging while keeping the brand line and (via the About
 * section) an explicit route to the full range, so broader enquiries are not
 * lost.
 */
const Hero = () => (
    <ResourceHero
        title={
            <>
                Bridging Loans &amp; <span className="text-highlight">Development Finance</span>
            </>
        }
        description="Short-term property funding for auction purchases, chain breaks, refurbishments and probate. We structure bridging loans for homeowners, landlords, investors and developers — around a clear exit plan, not just a headline rate."
        heroImage="/images/hero/bridging-9.webp"
        primaryCtaTo="/chat-about-funding/bridging-loans"
        showTrust={false}
    />
);

export default Hero;
