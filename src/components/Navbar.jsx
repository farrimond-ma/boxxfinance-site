import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();

    // Pages that should start with a dark navy navbar
    const darkNavRoutes = ['/insights/', '/insights', '/locations/'];
    const isDarkPage = darkNavRoutes.some(route => location.pathname.startsWith(route)) ||
        /^\/insights\//.test(location.pathname) ||
        /^\/locations\//.test(location.pathname);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // On dark pages: start dark navy, turn white on scroll
    // On other pages: existing behaviour
    const navClass = [
        'navbar',
        scrolled ? 'scrolled' : '',
        isDarkPage && !scrolled ? 'navbar-dark' : '',
    ].filter(Boolean).join(' ');

    const logoSrc = scrolled
        ? '/logo_scroll.png?v=2'
        : isDarkPage
            ? '/logo.png?v=2'
            : '/logo.png?v=2';

    return (
        <nav className={navClass}>
            <div className="navbar-container container">
                <div className="navbar-logo">
                    <Link to="/">
                        <img
                            src={logoSrc}
                            alt="Boxx Commercial Finance"
                            className="navbar-logo-img"
                        />
                    </Link>
                </div>
                <div className={`navbar-menu ${mobileMenuOpen ? 'active' : ''}`}>
                    <a href="/#funding-solutions" className="navbar-link" onClick={() => setMobileMenuOpen(false)}>Funding Solutions</a>
                    <a href="/#about" className="navbar-link" onClick={() => setMobileMenuOpen(false)}>About Us</a>
                    <Link to="/insights" className="navbar-link" onClick={() => setMobileMenuOpen(false)}>Insights</Link>
                    <a href="/#case-studies" className="navbar-link" onClick={() => setMobileMenuOpen(false)}>Case Studies</a>
                    <a href="tel:03300431612" className="navbar-btn btn btn-primary" onClick={() => setMobileMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        Call us now
                    </a>
                </div>
                <div className="navbar-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                    <span className="bar"></span>
                    <span className="bar"></span>
                    <span className="bar"></span>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
