import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';
const Footer = () => {
    return (
        <footer className="footer">
            <div className="container">
                <div className="footer-content">
                    <div className="footer-brand">
                        <Link to="/" className="footer-logo">
                            <img src="/logo.png" alt="Boxx Finance" className="footer-logo-img" loading="lazy" />
                        </Link>
                        <p>Bridging Loans and Commercial Finance</p>
                    </div>

                    <div className="footer-links">
                        <h4>Quick Links</h4>
                        <ul>
                            <li><Link to="/funding-solutions">Funding Solutions</Link></li>
                            <li><Link to="/about-us">About Us</Link></li>
                            <li><Link to="/insights">Insights</Link></li>
                            <li><Link to="/uk-sme-funding-index">UK SME Funding Index</Link></li>
                            {/* The locations hub — the footer link is what gives all
                                209 location pages a sitewide crawl path. */}
                            <li><Link to="/locations">UK Locations</Link></li>
                            <li><Link to="/partners">Broker Partners</Link></li>
                            <li><a href="/#case-studies">Case Studies</a></li>
                            <li><a href="/#contact">Contact</a></li>
                        </ul>
                    </div>

                    <div className="footer-links">
                        <h4>Legal</h4>
                        <ul>
                            <li><Link to="/privacy-policy">Privacy Policy</Link></li>
                            <li><Link to="/legal-disclaimer">Legal Disclaimer</Link></li>
                            <li><Link to="/terms-and-conditions">Terms & Conditions</Link></li>
                        </ul>
                    </div>

                    <div className="footer-contact">
                        <h4>Contact Us</h4>
                        <p><strong>Boxx Finance</strong><br />Atrium Business Centre, <br />North Caldeen Road, Coatbridge, ML5 4EF</p>
                        <p><a href="mailto:hello@boxxfinance.co.uk" className="clickable-email">hello@boxxfinance.co.uk</a></p>
                        <p><a href="tel:01236702070" className="clickable-email">01236 702070</a></p>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p className="footer-disclaimer"><strong>Non-regulated</strong> – Boxx Finance Ltd, registered at 6th Floor Gordon Chambers, 90 Mitchell Street, Glasgow, G1 3NQ (company number SC905235), is not authorised by the Financial Conduct Authority and can only complete non-regulated introductions.</p>
                    <p className="footer-disclaimer">We work with a panel of lenders whose particulars will be supplied upon request to find a potentially suitable arrangement for your consideration. We are a commercial finance broker and not a lender. Funding is subject to lender criteria, status and terms. Typically we will receive commission from lenders for arranging finance. The amount of commission may vary depending on the lender and product.</p>
                    <p className="footer-disclaimer">ICO registration number: ZC273334.</p>
                    <p>&copy; {new Date().getFullYear()} Boxx Finance. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
