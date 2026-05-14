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
                            <img src="/logo.webp" alt="Boxx Commercial Finance" className="footer-logo-img" />
                            <span className="footer-logo-text"><span className="text-highlight">Commercial Finance</span></span>
                        </Link>
                        <p>Funding Done Properly. Structured for Growth.</p>
                    </div>

                    <div className="footer-links">
                        <h4>Quick Links</h4>
                        <ul>
                            <li><a href="/#funding-solutions">Funding Solutions</a></li>
                            <li><a href="/#about">About Us</a></li>
                            <li><Link to="/insights">Insights</Link></li>
                            <li><Link to="/uk-sme-funding-index">UK SME Funding Index</Link></li>
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
                        <p><strong>Manchester Office</strong><br/>Bartle House,<br/>Oxford Court, Manchester<br/>M2 3WQ</p>
                        <p><strong>Glasgow Office</strong><br/>6th Floor Gordon Chambers,<br/>90 Mitchell Street, Glasgow, G1 3NQ</p>
                        <p><a href="mailto:hello@boxxfinance.co.uk" className="clickable-email">hello@boxxfinance.co.uk</a></p>
                        <p><a href="tel:03300431612" className="clickable-email">0330 043 1612</a></p>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p className="footer-disclaimer">We are a commercial finance broker and not a lender. Funding is subject to lender criteria, status and terms. Commercial finance is not regulated by the Financial Conduct Authority. We may receive commission from lenders for arranging finance. The amount of commission may vary depending on the lender and product.</p>
                    <p>&copy; {new Date().getFullYear()} Boxx Commercial Finance. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
