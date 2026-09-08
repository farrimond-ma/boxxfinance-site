import { Link } from 'react-router-dom';
import './About.css';

// Homepage teaser (2026-09). The full six-paragraph story plus these same
// director cards used to live only here, reachable at /#about — no URL of
// its own, no title tag. Moved to a dedicated /about-us page (see
// src/pages/AboutUs.jsx) for the SEO surface and E-E-A-T signals a named
// team page gives a financial site. This stays as a short trust signal for a
// first-time homepage visitor, linking through for the full story rather
// than either duplicating it or dropping it from the homepage entirely.
const About = () => {
    return (
        <section className="section about" id="about">
            <div className="container">
                <div className="about-teaser-intro">
                    <h2>UK Bridging Loan Specialists <span className="text-highlight">— And Your Whole-of-Market Partner</span></h2>
                    <p>
                        Speed and structure, not just approval. With access to a panel of 50+
                        lenders, we go to the whole market on your behalf — funding structured
                        around your exit strategy, not just the headline rate.{' '}
                        <Link to="/about-us">Read our full story and meet the team →</Link>
                    </p>
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
                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <Link to="/chat-about-funding" className="btn btn-primary">Start Your Funding Conversation</Link>
                </div>
            </div>
        </section>
    );
};

export default About;
