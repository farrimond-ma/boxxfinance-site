import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './AdLandingBridgingLoans.css';

/**
 * Paid-traffic landing page for unregulated bridging finance (investment
 * and commercial property — not owner-occupied residential, which is
 * regulated). Deliberately minimal: brief copy, two CTAs, no form — for
 * campaigns where a phone call or booked appointment is the desired action
 * rather than a lead-capture form.
 *
 * Shares AdLandingBridgingLoans.css rather than duplicating it — same
 * navy/gold paid-traffic visual language, just a shorter layout (no form
 * card, no deals/steps/FAQ sections).
 *
 * noIndex: paid-traffic only, excluded from the sitemap for the same
 * reason as /ads/bridging-loans.
 *
 * Copy is deliberately scoped to unregulated bridging use cases (auction
 * purchase, refurbishment, commercial/portfolio refinance) rather than
 * chain-break language, which more often implies a regulated, owner-
 * occupied scenario — the product this page promotes is not that.
 */
const AdLandingBridgingUnregulated = () => (
    <div className="adlp">
        <SEO
            title="Bridging Finance for Property Investors | Boxx Finance"
            description="Fast, whole-of-market bridging finance for auction purchases, refurbishment and commercial property. Speak to a specialist or book an appointment."
            noIndex={true}
        />

        <header className="adlp-header">
            <Link to="/" className="adlp-logo">
                <img src="/logo_gold.png" alt="Boxx Finance" />
            </Link>
        </header>

        <section className="adlp-hero has-hero-image" style={{ '--hero-image': 'url("/images/hero/bridging-5.webp")' }}>
            <div className="adlp-hero-inner adlp-hero-single">
                <div className="adlp-hero-copy">
                    <h1>Bridging Finance for <span className="text-highlight">Property Investors & Developers</span></h1>
                    <p className="adlp-hero-lead">
                        Fast, whole-of-market bridging finance for auction purchases, refurbishment projects
                        and commercial or portfolio refinancing. We structure every facility around your exit
                        strategy — not just the headline rate.
                    </p>
                    <div className="adlp-final-cta-actions adlp-hero-ctas">
                        <a href="tel:01236702070" className="btn btn-primary">Call 01236 702070</a>
                        <Link to="/book-an-appointment" className="btn btn-outline">Book an Appointment</Link>
                    </div>
                </div>
            </div>
        </section>

        <footer className="adlp-footer">
            <p>Boxx Finance is a trading name of Birchwood Wealth Ltd, registered in Scotland, company number SC692076.</p>
            <p>
                We are a commercial finance broker and not a lender. Funding is subject to lender criteria, status
                and terms. Commercial finance is not regulated by the Financial Conduct Authority. We may receive
                commission from lenders for arranging finance. The amount of commission may vary depending on the
                lender and product.
            </p>
            <p>
                For regulated business we act as appointed representatives of Cornerstone Finance Group Ltd.
                Cornerstone Finance Group Ltd is authorised and regulated by The Financial Conduct Authority No.767202.
            </p>
            <p>&copy; {new Date().getFullYear()} Boxx Finance. <Link to="/privacy-policy">Privacy Policy</Link></p>
        </footer>
    </div>
);

export default AdLandingBridgingUnregulated;
