import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import './AdLandingBridgingLoans.css';

/**
 * Paid-traffic landing page for Meta/Google ads campaigns targeting
 * "bridging loans" — deliberately minimal chrome (no nav, no footer links)
 * and a single-step form right in the hero, matching the high-converting
 * structure of competitor PPC landing pages (form-beside-hero, trust bullet
 * strip, proof, 3-step process, FAQ, compliance footer).
 *
 * noIndex: this is a paid-traffic page, not meant to rank organically or
 * compete with /funding-solutions/bridging-loans in search — excluded from
 * the sitemap for the same reason (see scripts/generate-sitemap.js).
 *
 * No invented rates or figures — every number here (LTV, term, completion
 * time) is pulled from the vetted bridging-loans service content in
 * src/data/services.jsx, not made up for this page.
 */

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwF7_EU1ekXaviBoRU_Xay1P4uzAhIm7t_Ded9j73jh9B_fpObwNdspWtSji8YLrpHFag/exec';

const TRUST_BULLETS = [
    'Funding from £50,000+',
    'Completion in 7 days',
    'Terms up to 24 months',
    'No exit fees',
    'LTV up to 90%',
    'Day 1 Refinance for Cash Purchases',
];

const USE_CASES = ['Auction purchases', 'Chain breaks', 'Refurbishment projects', 'Planning gain', 'Short-term refinancing'];

const STEPS = [
    { n: '01', title: 'Tell us what you need', text: 'Share the basics — property, amount, timing — using the form above.' },
    { n: '02', title: 'We compare the market', text: 'We match your deal to the right lender from our whole-of-market panel, structured around your exit.' },
    { n: '03', title: 'Get your terms', text: 'A specialist calls you back with indicative terms, usually the same working day.' },
];

const DEALS = [
    { amount: '£1.2m', title: 'Time-Sensitive Commercial Property Acquisition', text: 'A property developer needed to secure a mixed-use acquisition quickly after an existing lender could not meet the completion timeline. We structured a short-term bridging facility aligned with the exit strategy and engaged a specialist lender — funding secured within the tight window, protecting the purchase.' },
    { amount: '£340k', title: 'Auction Purchase, 21-Day Completion', text: 'A landlord needed to complete on an auction purchase within the standard 28-day window. Bridging finance was arranged against the asset, with funds released in time to meet the auction deadline.' },
    { amount: '£185k', title: 'Chain Break Resolved', text: "A homeowner's onward purchase was at risk when their own sale fell through late. A bridging loan kept the purchase moving, secured against the property being sold, repaid on completion of the delayed sale." },
];

const FAQS = [
    { q: 'How quickly can a bridging loan be arranged?', a: 'In some cases, funding can complete within 7 to 14 days, subject to valuation and legal process. Timing depends on how quickly a valuation and legal work can be completed.' },
    { q: 'What is the typical term of a bridging loan?', a: 'Most facilities run from 3 to 18 months, structured around your specific exit — a sale, a refinance onto a commercial mortgage, or completion of a development.' },
    { q: 'What loan-to-value is available?', a: 'Typically 60% to 75%, depending on the asset type and your exit strategy. We structure the facility around the exit, not just the headline rate.' },
    { q: 'Can interest be rolled up rather than paid monthly?', a: 'Yes. Interest can often be retained or rolled into the facility, reducing monthly payment pressure during the term.' },
    { q: 'Is a bridging loan regulated?', a: 'It depends on the property. Loans secured on a residential property you or a family member will live in are regulated; bridging for investment or commercial property is typically unregulated. We arrange both.' },
];

const AdLandingBridgingLoans = () => {
    const [form, setForm] = useState({ name: '', phone: '', email: '', amount: '', timing: '' });
    const [status, setStatus] = useState('idle'); // idle | sending | done | error
    const [openFaq, setOpenFaq] = useState(0);

    const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const onSubmit = async (e) => {
        e.preventDefault();
        setStatus('sending');
        try {
            const params = new URLSearchParams();
            params.append('name', form.name);
            params.append('email', form.email);
            params.append('phone', form.phone);
            params.append('funding_type', 'Bridging Loan (Ad Landing Page)');
            params.append('funding_purpose', `Amount needed: ${form.amount || 'n/a'} | Timing: ${form.timing || 'n/a'}`);
            params.append('preferred_contact', 'phone');
            const referral = (typeof window !== 'undefined' &&
                (sessionStorage.getItem('boxx_ref') || new URLSearchParams(window.location.search).get('utm_campaign'))) || '';
            if (referral) params.append('referral_code', referral);
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            });
            // The one event Meta Ads actually optimises campaigns and reports
            // conversions against — this page is the paid-traffic destination,
            // so this is the most important of the three Lead fires.
            if (typeof window.fbq === 'function') window.fbq('track', 'Lead');
            setStatus('done');
        } catch {
            setStatus('error');
        }
    };

    return (
        <div className="adlp">
            <SEO
                title="Bridging Loans UK | Fast, Whole-of-Market Funding Quote"
                description="Fast bridging loans from £50,000. Whole-of-market comparison, completion from 7 days, terms from 3 to 18 months. Get a same-day quote from Boxx Finance."
                noIndex={true}
            />

            <header className="adlp-header">
                <Link to="/" className="adlp-logo">
                    <img src="/logo_gold.png" alt="Boxx Finance" />
                </Link>
            </header>

            {/* Pinned (not pickHero's hash) — same reasoning as /partners: a
                paid-traffic, conversion-focused page shouldn't gamble on
                whichever image the hash lands on. bridging-5.webp is the
                bright terraced-street shot already vetted for this use. */}
            <section className="adlp-hero has-hero-image" style={{ '--hero-image': 'url("/images/hero/bridging-5.webp")' }}>
                <div className="adlp-hero-inner">
                    <div className="adlp-hero-copy">
                        <h1>Fast Bridging Loans, <span className="text-highlight">Structured Properly</span></h1>
                        <p className="adlp-hero-lead">
                            Whole-of-market bridging finance for auction purchases, chain breaks, refurbishment and
                            short-term refinancing. We structure every facility around your exit — not just the rate.
                        </p>
                        <ul className="adlp-bullets">
                            {TRUST_BULLETS.map((b) => (
                                <li key={b}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    {b}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="adlp-form-card" id="quote-form">
                        {status === 'done' ? (
                            <div className="adlp-thanks">
                                <h3>Thanks — request received.</h3>
                                <p>A funding specialist will call you shortly to talk through your options.</p>
                                <p>Need to speak to someone now? <a href="tel:01236702070">01236 702070</a></p>
                            </div>
                        ) : (
                            <form onSubmit={onSubmit}>
                                <h2>Get your bridging loan quote</h2>
                                <p className="adlp-form-sub">Free, no obligation. A specialist calls you back — usually the same working day.</p>
                                <label>Full name
                                    <input name="name" required value={form.name} onChange={onChange} />
                                </label>
                                <label>Phone
                                    <input name="phone" type="tel" required value={form.phone} onChange={onChange} />
                                </label>
                                <label>Email
                                    <input name="email" type="email" required value={form.email} onChange={onChange} />
                                </label>
                                <div className="adlp-field-row">
                                    <label>Amount needed
                                        <input name="amount" placeholder="e.g. £250,000" value={form.amount} onChange={onChange} />
                                    </label>
                                    <label>When needed
                                        <input name="timing" placeholder="e.g. 2 weeks" value={form.timing} onChange={onChange} />
                                    </label>
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
                                    {status === 'sending' ? 'Sending…' : 'Get my free quote'}
                                </button>
                                {status === 'error' && <p className="adlp-error">Something went wrong — call <a href="tel:01236702070">01236 702070</a> instead.</p>}
                            </form>
                        )}
                    </div>
                </div>
            </section>

            <section className="adlp-usecases">
                <p className="adlp-usecases-label">Funding arranged for:</p>
                <div className="adlp-usecases-chips">
                    {USE_CASES.map((u) => <span key={u}>{u}</span>)}
                </div>
            </section>

            <section className="adlp-deals">
                <div className="adlp-section-header">
                    <h2>Recently Arranged</h2>
                    <p>A sample of the bridging loans we've structured for UK clients.</p>
                </div>
                <div className="adlp-deals-grid">
                    {DEALS.map((d) => (
                        <div className="adlp-deal-card" key={d.title}>
                            <div className="adlp-deal-amount">{d.amount}</div>
                            <h3>{d.title}</h3>
                            <p>{d.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="adlp-steps">
                <div className="adlp-section-header">
                    <h2>How It Works</h2>
                </div>
                <div className="adlp-steps-grid">
                    {STEPS.map((s) => (
                        <div className="adlp-step" key={s.n}>
                            <span className="adlp-step-n">{s.n}</span>
                            <h3>{s.title}</h3>
                            <p>{s.text}</p>
                        </div>
                    ))}
                </div>
                <div className="adlp-steps-cta">
                    <a href="#quote-form" className="btn btn-primary">Get my free quote</a>
                </div>
            </section>

            <section className="adlp-faq">
                <div className="adlp-section-header">
                    <h2>Frequently Asked Questions</h2>
                </div>
                <div className="adlp-faq-list">
                    {FAQS.map((f, i) => {
                        const isOpen = openFaq === i;
                        return (
                            <div className={`adlp-faq-item${isOpen ? ' is-open' : ''}`} key={f.q}>
                                <button type="button" onClick={() => setOpenFaq(isOpen ? -1 : i)} aria-expanded={isOpen}>
                                    <span>{f.q}</span>
                                    <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
                                </button>
                                {isOpen && <div className="adlp-faq-answer"><p>{f.a}</p></div>}
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="adlp-final-cta">
                <h2>Ready to move on your bridging loan?</h2>
                <p>Get a free, no-obligation quote — or call the team directly.</p>
                <div className="adlp-final-cta-actions">
                    <a href="#quote-form" className="btn btn-primary">Get my free quote</a>
                    <a href="tel:01236702070" className="btn btn-outline">01236 702070</a>
                </div>
            </section>

            <footer className="adlp-footer">
                <p>
                    We are a commercial finance broker and not a lender. Funding is subject to lender criteria, status
                    and terms. Commercial finance is not regulated by the Financial Conduct Authority. We may receive
                    commission from lenders for arranging finance. The amount of commission may vary depending on the
                    lender and product.
                </p>
                <p>&copy; {new Date().getFullYear()} Boxx Finance. <Link to="/privacy-policy">Privacy Policy</Link></p>
            </footer>
        </div>
    );
};

export default AdLandingBridgingLoans;
