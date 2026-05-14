import React, { useState } from 'react';
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
            params.append('additional_info', 'Submitted via Contact Form');

            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString()
            });

            alert('Thank you for your enquiry. We will be in touch shortly.');
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
                                <p><strong>Manchester Office</strong><br/>Bartle House,<br/>Oxford Court, Manchester<br/>M2 3WQ</p>
                                <p><strong>Glasgow Office</strong><br/>6th Floor Gordon Chambers,<br/>90 Mitchell Street, Glasgow, G1 3NQ</p>
                            </div>
                        </div>

                        <div className="info-item">
                            <span className="icon">📞</span>
                            <div>
                                <h4>Phone</h4>
                                <p>0330 043 1612</p>
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
                            <div className="currency-input">
                                <span>£</span>
                                <input type="number" id="amount" name="amount" placeholder="50,000" min="1000" value={formData.amount} onChange={handleChange} />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Sending...' : 'Start Your Funding Conversation'}
                        </button>
                    </form>
                </div>
            </div>
        </section>
    );
};

export default Contact;
