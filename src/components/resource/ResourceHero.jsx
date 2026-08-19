import React from 'react';
import { Link } from 'react-router-dom';
import { useChatWidget } from '../chat/ChatWidgetContext';
import './ResourcePage.css';

// Shared hero + final-CTA band used by BOTH content pages (ResourcePage) and
// service/landing pages, so the visual language stays identical and can't
// drift. Navy panel blending into a full-height background image, dual CTAs,
// trust ticks.
export const ResourceHero = ({ title, description, heroImage, primaryCtaTo = '/chat-about-funding' }) => {
    // Title is white by default; if it contains a colon (mainly blog titles
    // like "Raising Capital for Growth: Debt vs. Equity"), the part after the
    // colon is gold.
    const colonIdx = (title || '').indexOf(':');
    const titleWhite = colonIdx !== -1 ? title.slice(0, colonIdx + 1) : title;
    const titleGold = colonIdx !== -1 ? title.slice(colonIdx + 1).trim() : '';

    return (
        <div
            className={`resource-hero${heroImage ? ' has-hero-image' : ''}`}
            style={heroImage ? { '--hero-image': `url("${heroImage}")` } : undefined}
        >
            <div className="container resource-hero-grid">
                <div className="resource-hero-text">
                    <h1>
                        {titleWhite}
                        {titleGold && <> <span className="text-highlight">{titleGold}</span></>}
                    </h1>
                    {description && <p className="resource-hero-lead">{description}</p>}

                    <div className="resource-hero-actions">
                        <Link to={primaryCtaTo} className="btn btn-primary">Get a free quote</Link>
                        <a href="tel:01236702070" className="btn btn-outline resource-btn-phone">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                            Talk to an expert
                        </a>
                    </div>

                    <ul className="resource-hero-trust" aria-label="Why choose Boxx">
                        <li>Independent broker</li>
                        <li>Whole of market</li>
                        <li>Fast decisions</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

// Grey final-CTA band that separates from the navy footer below.
export const FinalCtaBand = ({ ctaTo = '/chat-about-funding' }) => (
    <div className="resource-final-cta">
        <div className="container">
            <h2>Ready to discuss your funding?</h2>
            <p>
                Whether you're purchasing property, refinancing or raising working capital,
                we'll help you find the right lender for your timescales and objectives.
            </p>
            <div className="resource-final-cta-actions">
                <Link to={ctaTo} className="btn btn-primary">Start your enquiry</Link>
                <span>or call <a href="tel:01236702070">01236 702070</a></span>
            </div>
        </div>
    </div>
);

// Floating "Need funding?" pill — the single floating element on a page.
// Opens the AI chat widget. Rendered once, globally, from Layout.jsx so it
// appears on every page site-wide — not per-page here, to avoid it being
// forgotten on pages that don't go through ResourcePage/ServicePage.
export const FloatingCta = () => {
    const { openChat } = useChatWidget();
    return (
        <button type="button" onClick={openChat} className="resource-float-cta" aria-label="Need funding? Talk to us">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
        </button>
    );
};

export default ResourceHero;
