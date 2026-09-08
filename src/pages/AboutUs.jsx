import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import ResourceHero, { FinalCtaBand } from '../components/resource/ResourceHero';
import '../components/resource/ResourcePage.css';
// Reuses the director-card styling already built for the homepage teaser
// rather than duplicating it — same cards, same photos, same links.
import '../components/About.css';

/**
 * Dedicated About Us page (2026-09). Previously only a same-page anchor
 * (/#about) — no URL of its own, no title tag, no meta description, and
 * unreachable directly from any page other than the homepage. Moved to its
 * own route for the usual reasons content pages get one here: a real SEO
 * surface, and E-E-A-T signals (a named team, credentials, contact details)
 * matter more for a financial services site than most. The homepage keeps a
 * condensed version — see About.jsx — that links here for the full story.
 */
const AboutUs = () => {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: 'About Boxx Finance',
        url: 'https://boxxfinance.co.uk/about-us',
        mainEntity: {
            '@type': 'Organization',
            name: 'Boxx Finance',
            url: 'https://boxxfinance.co.uk',
            employee: [
                { '@type': 'Person', name: 'Mark Higgins', jobTitle: 'Managing Partner, Commercial Finance' },
                { '@type': 'Person', name: 'Tara Jameson', jobTitle: 'Commercial Finance and Bridging Loans Specialist' },
            ],
        },
    };

    return (
        <div className="resource-page">
            <SEO
                title="About Boxx Finance"
                description="UK whole-of-market commercial finance broker specialising in bridging loans. Meet the team, our approach to structuring finance, and why we work the way we do."
                keywords="about Boxx Finance, commercial finance broker Scotland, bridging loan specialists, Mark Higgins, Tara Jameson"
                schema={schema}
            />

            <ResourceHero
                eyebrow="Who We Are"
                title="About Boxx Finance"
                description="Speed and structure, not just approval. We built our reputation arranging fast, whole-of-market bridging loans for UK property buyers, landlords and developers — funding structured around your exit strategy, not just the headline rate."
                heroImage="/images/hero/bridging-15.webp"
                primaryCtaTo="/chat-about-funding"
            />

            <div className="resource-column">
                <div className="resource-main-card">
                    <div className="blog-post-content">
                        <p>
                            We were built by directors who spent years watching businesses and
                            investors lose deals, miss opportunities and pay over the odds because
                            their funding was wrong for their situation. We set out to change that.
                        </p>

                        <h2>Whole of market, not one panel</h2>
                        <p>
                            With access to a panel of 50+ lenders — from high street banks and
                            challenger lenders to specialist and private debt providers — we go to
                            the whole market on your behalf, whether that's a bridging loan
                            completing in days or a longer-term commercial facility.
                        </p>

                        <h2>Who we work with</h2>
                        <p>
                            Property investors and developers, UK-based SMEs, business owners
                            seeking growth capital, and entrepreneurs restructuring or refinancing
                            existing facilities. Whether you're raising £50,000 or £5 million, we
                            treat every case with the same rigour.
                        </p>

                        <h2>Our approach is deliberate</h2>
                        <p>
                            Every facility we arrange starts with a strategy conversation — not a
                            form. We analyse your situation, your timescales and your exit before
                            approaching a single lender. That preparation is what separates a
                            structured deal from a rejected application, and it's why our clients
                            consistently secure better terms than they expected.
                        </p>

                        <h2>Beyond bridging loans</h2>
                        <p>
                            We arrange funding across the full spectrum of commercial finance —
                            commercial mortgages, development finance, asset finance, invoice
                            finance, structured finance and working capital. Whether you need a
                            straightforward facility or a complex multi-tranche structure, we have
                            the experience and the lender relationships to deliver.
                        </p>

                        <h2>Based in Scotland, working across the UK</h2>
                        <p>
                            Based in Coatbridge and operating across the whole of the UK, we work
                            with clients from Manchester to Edinburgh, London to Belfast. Distance
                            is no barrier — what matters is that your funding is right for your
                            business.
                        </p>

                        <h2>The team</h2>
                    </div>

                    <div className="director-cards">
                        <div className="director-card">
                            <img src="/images/mark-higgins.webp" alt="Mark Higgins, Managing Partner at Boxx Finance" className="director-avatar-photo" />
                            <div className="director-info">
                                <h4>Mark Higgins</h4>
                                <p className="director-title">Managing Partner, Commercial Finance</p>
                                <p className="director-bio">With extensive experience across commercial mortgages, development finance and structured lending, Mark leads client relationships and complex case structuring. He has helped hundreds of UK businesses secure the right funding at the right terms.</p>
                                <div className="director-social-links">
                                    <div className="contact-link-row">
                                        <a href="mailto:mark@boxxfinance.co.uk" className="director-email gold-link">mark@boxxfinance.co.uk</a>
                                    </div>
                                    <div className="contact-link-row">
                                        <a href="tel:01236702070" className="director-phone gold-link">01236 702070</a>
                                    </div>
                                    <div className="contact-link-row">
                                        <a href="https://www.linkedin.com/in/mark-higgins-05ab363b2/" target="_blank" rel="noopener noreferrer" className="director-linkedin-btn" title="Connect on LinkedIn">
                                            <svg className="linkedin-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                            </svg>
                                            Connect on LinkedIn
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="director-card">
                            <img src="/images/tara-jameson.webp" alt="Tara Jameson, Commercial Finance and Bridging Loans Specialist at Boxx Finance" className="director-avatar-photo" />
                            <div className="director-info">
                                <h4>Tara Jameson</h4>
                                <p className="director-title">Commercial Finance and Bridging Loans Specialist</p>
                                <p className="director-bio">Tara specialises in bridging loans, invoice finance, asset finance and working capital solutions, with a strong track record in helping property investors and growth-stage businesses unlock the funding they need. Her whole-of-market approach ensures clients receive competitive, lender-agnostic advice.</p>
                                <div className="director-social-links">
                                    <div className="contact-link-row">
                                        <a href="mailto:tara@boxxfinance.co.uk" className="director-email gold-link">tara@boxxfinance.co.uk</a>
                                    </div>
                                    <div className="contact-link-row">
                                        <a href="tel:01236702070" className="director-phone gold-link">01236 702070</a>
                                    </div>
                                    <div className="contact-link-row">
                                        <a href="https://www.linkedin.com/in/commercial-funding/" target="_blank" rel="noopener noreferrer" className="director-linkedin-btn" title="Connect on LinkedIn">
                                            <svg className="linkedin-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                            </svg>
                                            Connect on LinkedIn
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <FinalCtaBand />
        </div>
    );
};

export default AboutUs;
