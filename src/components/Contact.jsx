import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AMOUNT_BANDS } from './AmountBandSelect';
import { useChatWidget } from './chat/ChatWidgetContext';
import './Contact.css';

const Contact = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        interest: 'Commercial Mortgage',
        amount: ''
    });

    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwF7_EU1ekXaviBoRU_Xay1P4uzAhIm7t_Ded9j73jh9B_fpObwNdspWtSji8YLrpHFag/exec';

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [belowMinimumSent, setBelowMinimumSent] = useState(false);
    const { openChat } = useChatWidget();

    // Panel bridging lenders start at £50,000, so this combination is below
    // criteria — there is no lender to place it with. Bridging only: the other
    // options here (asset finance, invoice finance and the rest) have no such
    // floor. Same handling as the enquiry form: recorded, but not treated as a
    // lead and not promised a callback.
    const isBelowMinimum = formData.interest === 'Bridging Loan' && formData.amount === '0-49,999';

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const params = new URLSearchParams();
            params.append('source', 'Contact Form');
            params.append('name', formData.name);
            params.append('email', formData.email);
            params.append('phone', formData.phone);
            params.append('funding_type', formData.interest);
            params.append('funding_amount', formData.amount);
            params.append('additional_info', isBelowMinimum
                ? 'Submitted via Contact Form | Below £50,000 bridging minimum — routed to the assistant'
                : 'Submitted via Contact Form');

            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString()
            });

            // Not a Lead below the lending minimum: Meta optimises towards
            // whatever is reported as one, so it would buy more of these.
            if (!isBelowMinimum && typeof window.fbq === 'function') window.fbq('track', 'Lead');
            if (isBelowMinimum) setBelowMinimumSent(true);
            else alert('Thank you for your enquiry. We will be in touch shortly.');
            setFormData({
                name: '',
                email: '',
                phone: '',
                interest: 'Commercial Mortgage',
                amount: ''
            });
        } catch (error) {
            console.error('Submission error:', error);
            alert('There was a problem sending your message. Please try again or email us directly.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="section contact" id="contact">
            <div className="container">
                <div className="section-header">
                    <h2>Get in <span className="text-highlight">Touch</span></h2>
                    <p>Ready to discuss your funding requirements? Contact us today.</p>
                </div>

                <div className="contact-wrapper">
                    <div className="contact-info">
                        <h3>Contact Information</h3>
                        <p>Fill out the form or reach us via our details below.</p>

                        <div className="info-item">
                            <span className="icon">📍</span>
                            <div>
                                <h4>Address</h4>
                                <p>Atrium Business Centre, North Caldeen Road, Coatbridge, ML5 4EF</p>
                            </div>
                        </div>

                        <div className="info-item">
                            <span className="icon">📞</span>
                            <div>
                                <h4>Phone</h4>
                                <p>01236 702070</p>
                            </div>
                        </div>

                        <div className="info-item">
                            <span className="icon">✉️</span>
                            <div>
                                <h4>Email</h4>
                                <p><a href="mailto:hello@boxxfinance.co.uk" className="clickable-email">hello@boxxfinance.co.uk</a></p>
                            </div>
                        </div>
                    </div>

                    {belowMinimumSent ? (
                        <div className="contact-form" style={{ background: '#fff8e6', border: '1px solid #f0d488', borderRadius: '8px', padding: '1.5rem' }}>
                            <h3 style={{ marginTop: 0 }}>We can&rsquo;t place a bridging loan that size</h3>
                            <p style={{ lineHeight: 1.6 }}>
                                Bridging lenders on our panel start at £50,000. A secured loan or a second charge against a property
                                you already own can often cover smaller amounts, and both are things we do arrange.
                            </p>
                            <button type="button" className="btn btn-primary" onClick={openChat}>Ask the assistant</button>
                            <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                                Or read about <Link to="/funding-solutions/secured-loans">secured loans</Link> and{' '}
                                <Link to="/funding-solutions/second-charge-mortgages">second charge mortgages</Link>.
                            </p>
                        </div>
                    ) : (
                    <form className="contact-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="name">Full Name</label>
                            <input type="text" id="name" name="name" required value={formData.name} onChange={handleChange} />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input type="email" id="email" name="email" required value={formData.email} onChange={handleChange} />
                        </div>

                        <div className="form-group">
                            <label htmlFor="phone">Phone Number</label>
                            <input type="tel" id="phone" name="phone" required value={formData.phone} onChange={handleChange} />
                        </div>

                        <div className="form-group">
                            <label htmlFor="interest">Interested In</label>
                            <select id="interest" name="interest" value={formData.interest} onChange={handleChange}>
                                <option>Commercial Mortgage</option>
                                <option>Bridging Loan</option>
                                <option>Asset Finance</option>
                                <option>Invoice Finance</option>
                                <option>Development Finance</option>
                                <option>Business Loan</option>
                                <option>Other</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="amount">How Much Do You Want to Borrow?</label>
                            <select id="amount" name="amount" value={formData.amount} onChange={handleChange}>
                                <option value="">Select amount...</option>
                                {AMOUNT_BANDS.map((b) => (
                                    <option key={b.value} value={b.value}>{b.label}</option>
                                ))}
                            </select>
                        </div>

                        {isBelowMinimum && (
                            <div className="form-group" style={{ background: '#fff8e6', border: '1px solid #f0d488', borderRadius: '8px', padding: '1rem' }}>
                                <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                    Bridging lenders on our panel start at <strong>£50,000</strong>. A secured loan or second charge
                                    may suit instead &mdash; our assistant can tell you in a couple of minutes.
                                </p>
                                <button type="button" className="btn btn-primary" onClick={openChat} style={{ fontSize: '0.9rem' }}>
                                    Ask the assistant
                                </button>
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Sending...' : 'Start Your Funding Conversation'}
                        </button>
                    </form>
                    )}
                </div>
            </div>
        </section>
    );
};

export default Contact;
