import React from 'react';
import { Link } from 'react-router-dom';
import './Hero.css';

/**
 * Bridging-led hero.
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
const Hero = () => {
    return (
        <section className="hero" id="home">
            <div className="hero-overlay"></div>
            <div className="container hero-content">
                <p className="hero-eyebrow">UK Bridging Loan Specialists</p>
                <h1>
                    Bridging Loans, <br />
                    <span className="text-gold">Done Properly.</span>
                </h1>
                <p className="hero-lead">
                    Short-term property funding for auction purchases, chain breaks, refurbishments
                    and probate. We structure bridging loans for homeowners, landlords, investors
                    and developers — around a clear exit plan, not just a headline rate.
                </p>
                <div className="hero-btns">
                    <Link to="/chat-about-funding/bridging-loans" className="btn btn-primary">
                        Discuss Your Bridging Loan
                    </Link>
                    <a href="#funding-solutions" className="btn btn-outline">
                        See All Funding Options
                    </a>
                </div>
                {/* On mobile the outline button is hidden (Hero.css), so this
                    line carries the only route to the wider product range —
                    hence the inline link rather than plain text. */}
                <p className="hero-secondary">
                    Also arranging asset finance, commercial mortgages, development finance and
                    invoice finance — <Link to="/funding-solutions">see all funding options</Link>.
                </p>
            </div>
        </section>
    );
};

export default Hero;
