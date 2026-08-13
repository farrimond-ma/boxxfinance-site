import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import '../components/resource/ResourcePage.css';
import './Partners.css';

/**
 * /partners — introducer (referral) program for mortgage brokers who receive
 * bridging enquiries they don't place themselves.
 *
 * Two deliberate compliance choices baked into this page:
 *  1. The partner link snippet uses rel="sponsored" and a BRANDED anchor
 *     ("Boxx Finance"), never exact-match "bridging loans". A paid
 *     relationship with optimised commercial anchor text is a Google link
 *     scheme; branded + sponsored is the correct, penalty-safe form.
 *  2. The commercial terms (referral fee) are described qualitatively, not with
 *     an invented figure — the real number and the introducer agreement are
 *     business/compliance decisions the firm owns.
 */

// Same Apps Script endpoint the enquiry form posts to; partner sign-ups land in
// the same sheet, tagged so they're easy to filter.
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwF7_EU1ekXaviBoRU_Xay1P4uzAhIm7t_Ded9j73jh9B_fpObwNdspWtSji8YLrpHFag/exec';

const SPONSORED_SNIPPET =
`<p>Need a bridging loan? Our specialist partner
  <a href="https://boxxfinance.co.uk/?ref=YOUR-CODE" rel="sponsored" target="_blank">Boxx Finance</a>
  arranges short-term property finance across the UK.</p>`;

const Partners = () => {
    const [form, setForm] = useState({ firm: '', contact: '', email: '', phone: '', fca: '', message: '' });
    const [status, setStatus] = useState('idle'); // idle | sending | done | error
    const [copied, setCopied] = useState(false);

    const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const onSubmit = async (e) => {
        e.preventDefault();
        setStatus('sending');
        try {
            const params = new URLSearchParams();
            params.append('name', form.contact);
            params.append('email', form.email);
            params.append('phone', form.phone);
            params.append('company_name', form.firm);
            params.append('funding_type', 'Partner sign-up (introducer)');
            params.append('funding_purpose', `FCA ref: ${form.fca || 'n/a'} | ${form.message || ''}`.trim());
            params.append('preferred_contact', 'email');
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            });
            setStatus('done');
        } catch {
            setStatus('error');
        }
    };

    const copySnippet = async () => {
        try {
            await navigator.clipboard.writeText(SPONSORED_SNIPPET);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch { /* clipboard blocked — user can select manually */ }
    };

    return (
        <>
            <SEO
                title="Introducer Program for Mortgage Brokers | Refer Bridging Loans"
                description="Refer the bridging loan enquiries you don't place to Boxx Finance. A specialist partner for UK mortgage brokers — high-intent leads handled properly, with a referral fee on completed cases."
                keywords="bridging loan introducer, refer bridging enquiries, mortgage broker partner program, bridging loan referral"
            />

            {/* Pinned to a bright terraced-street image — the random pickHero
                landed on a dark renovation interior that read poorly under the
                hero scrim on this professional, broker-facing page. */}
            <div
                className="resource-hero has-hero-image"
                style={{ '--hero-image': 'url("/images/hero/bridging-5.webp")' }}
            >
                <div className="container resource-hero-grid">
                    <div className="resource-hero-text">
                        <h1>
                            Refer It. <span className="text-highlight">We'll Place It.</span>
                        </h1>
                        <p className="resource-hero-lead">
                            An introducer program for mortgage brokers who get bridging loan enquiries
                            they don't handle. Pass them to a specialist, keep your client relationship,
                            and earn on every case we complete.
                        </p>
                        <div className="resource-hero-actions">
                            <a href="#partner-signup" className="btn btn-primary">Become a partner</a>
                            <a href="tel:01236702070" className="btn btn-outline resource-btn-phone">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                                Talk to us first
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container partners-body">
                <section className="partners-intro">
                    <h2>If bridging loans aren't your thing, let us help</h2>
                    <p>
                        Most residential and mainstream brokers see bridging enquiries they'd rather not
                        take on — auction deadlines, chain breaks, refurbishment funding, probate. Instead
                        of turning them away, refer them to us. We're a whole-of-market bridging specialist,
                        so your client gets the right outcome and you get paid for the introduction.
                    </p>
                </section>

                <section className="partners-steps">
                    <h2>How it works</h2>
                    <ol className="partners-step-grid">
                        <li>
                            <span className="partners-step-n">01</span>
                            <h3>Sign up</h3>
                            <p>Register below. We'll send an introducer agreement and your unique referral code.</p>
                        </li>
                        <li>
                            <span className="partners-step-n">02</span>
                            <h3>Refer the case</h3>
                            <p>Send us the enquiry — a form, a link with your code, or a quick call. Your client relationship stays yours.</p>
                        </li>
                        <li>
                            <span className="partners-step-n">03</span>
                            <h3>Get paid</h3>
                            <p>When the case completes, you receive a share of the fee. Transparent, tracked to your code.</p>
                        </li>
                    </ol>
                </section>

                <section className="partners-benefits">
                    <h2>What you get</h2>
                    <ul className="partners-benefit-list">
                        <li><strong>A referral fee on every completed case</strong> — the structure is agreed up front in your introducer agreement.</li>
                        <li><strong>Your client stays your client.</strong> We handle the bridging piece and hand back cleanly.</li>
                        <li><strong>Whole-of-market placement</strong> — we compare lenders so your client gets a proper outcome, not a default product.</li>
                        <li><strong>Fast turnaround</strong> — terms in principle often same-day, so your client isn't left waiting.</li>
                    </ul>
                </section>

                {/* The compliant link snippet — branded anchor + rel=sponsored */}
                <section className="partners-snippet">
                    <h2>Adding a link on your site (optional)</h2>
                    <p>
                        If you'd like to point clients to us from your own website, use the snippet below.
                        It uses a <strong>branded anchor</strong> and <code>rel="sponsored"</code> — the
                        correct, search-engine-safe way to link a paid partner. Please don't alter the
                        anchor text to keyword phrases; that breaks search-engine guidelines for both of us.
                        Swap <code>YOUR-CODE</code> for the referral code we issue you so clicks are tracked.
                    </p>
                    <pre className="partners-code"><code>{SPONSORED_SNIPPET}</code></pre>
                    <button type="button" className="btn btn-outline" onClick={copySnippet}>
                        {copied ? 'Copied ✓' : 'Copy snippet'}
                    </button>
                </section>

                <section className="partners-signup" id="partner-signup">
                    <h2>Become a partner</h2>
                    {status === 'done' ? (
                        <div className="partners-thanks">
                            <p><strong>Thanks — we've got your details.</strong></p>
                            <p>A member of the team will be in touch with your introducer agreement and referral code. In the meantime, <Link to="/chat-about-funding/bridging-loans">send us a live case</Link> any time.</p>
                        </div>
                    ) : (
                        <form className="partners-form" onSubmit={onSubmit}>
                            <div className="partners-field-row">
                                <label>Firm name<input name="firm" required value={form.firm} onChange={onChange} /></label>
                                <label>Your name<input name="contact" required value={form.contact} onChange={onChange} /></label>
                            </div>
                            <div className="partners-field-row">
                                <label>Email<input type="email" name="email" required value={form.email} onChange={onChange} /></label>
                                <label>Phone<input name="phone" value={form.phone} onChange={onChange} /></label>
                            </div>
                            <label>FCA reference number (if applicable)<input name="fca" value={form.fca} onChange={onChange} /></label>
                            <label>Anything else?<textarea name="message" rows="3" value={form.message} onChange={onChange} /></label>
                            <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
                                {status === 'sending' ? 'Sending…' : 'Apply to join'}
                            </button>
                            {status === 'error' && <p className="partners-error">Something went wrong — email <a href="mailto:hello@boxxfinance.co.uk">hello@boxxfinance.co.uk</a> and we'll sort it.</p>}
                        </form>
                    )}
                    <p className="partners-smallprint">
                        Referrals of regulated bridging business are handled under a formal introducer
                        agreement in line with FCA requirements. We'll walk you through it before anything
                        goes live.
                    </p>
                </section>
            </div>
        </>
    );
};

export default Partners;
