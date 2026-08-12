import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { serviceContent } from '../data/services';
import './MultiStepForm.css';

// Helper component for currency input
const CurrencyInput = ({ label, name, value, onChange, placeholder }) => {
    const formatValue = (val) => {
        if (!val) return '';
        return '£ ' + parseInt(val).toLocaleString();
    };

    const handleChange = (e) => {
        // Remove non-numeric characters
        const rawValue = e.target.value.replace(/[^0-9]/g, '');
        onChange({ target: { name, value: rawValue } });
    };

    return (
        <div className="quiz-input-group">
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>{label}</label>
            <input
                type="text"
                name={name}
                className="quiz-input"
                placeholder={placeholder}
                value={formatValue(value)}
                onChange={handleChange}
            />
        </div>
    );
};

const MultiStepForm = () => {
    const { slug } = useParams();
    const service = slug ? serviceContent[slug] : null;
    // Bridging loans are for individuals (homeowners, landlords, investors,
    // developers) as much as businesses — so the "Business Overview" step is
    // replaced with property/deal questions that actually fit those applicants.
    // Bridging is a fast-capture form now — just enough to start a conversation (same idea as
    // the Facebook lead form), so it's a single step rather than the full 3-step wizard.
    const isBridging = slug === 'bridging-loans';
    const [step, setStep] = useState(1);
    const totalSteps = isBridging ? 1 : 3;
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);

    // TODO: Replace with your actual Google Apps Script Web App URL
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwF7_EU1ekXaviBoRU_Xay1P4uzAhIm7t_Ded9j73jh9B_fpObwNdspWtSji8YLrpHFag/exec';

    // Dynamic funding options from services data
    const fundingOptions = serviceContent ? Object.values(serviceContent).map(s => s.title).sort() : [];
    // Add "Not Sure" manually if not present
    if (!fundingOptions.includes('Not Sure')) fundingOptions.push('Not Sure');

    const [formData, setFormData] = useState({
        // Step 1
        fundingType: service ? service.title : '',
        amount: '',
        purpose: '',
        // Step 2 (business funding)
        companyName: '',
        industry: '',
        tradingStatus: '',
        yearsTrading: '',
        turnover: '',
        // Step 3
        contactName: '',
        email: '',
        phone: '',
        preferredContact: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleOptionSelect = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const nextStep = () => {
        if (step < totalSteps) setStep(step + 1);
        else handleSubmit();
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            // Check if we have a URL configured
            if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_SCRIPT_WEB_APP_URL_HERE') {
                console.warn('Google Script URL not configured. Submitting locally for demo.');
                // Simulate delay
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                // Prepare form data for submission
                // Note: Google Sheets Apps Script doPost often expects x-www-form-urlencoded or multipart/form-data
                // Using URLSearchParams for x-www-form-urlencoded
                const params = new URLSearchParams();

                // Map formData to the header names expected by the new script
                params.append('source', 'Multi-Step Form');
                params.append('name', formData.contactName);
                params.append('email', formData.email);
                params.append('phone', formData.phone);
                params.append('company_name', formData.companyName);
                params.append('industry', formData.industry);
                params.append('trading_status', formData.tradingStatus);
                params.append('years_trading', formData.yearsTrading);
                params.append('turnover', formData.turnover);
                params.append('funding_amount', formData.amount);
                params.append('funding_type', formData.fundingType);

                // Bridging is now just amount + "how soon" (formData.purpose covers both,
                // labelled dynamically below) — same shape as the Facebook lead form.
                params.append('funding_purpose', formData.purpose || '');
                if (!isBridging) params.append('preferred_contact', formData.preferredContact);

                // Referral attribution: a partner's ?ref=CODE is stashed in
                // sessionStorage on first page load (see App.jsx) and sent with
                // the lead so introducer referrals can be traced and paid.
                const referral = (typeof window !== 'undefined' &&
                    (sessionStorage.getItem('boxx_ref') ||
                     new URLSearchParams(window.location.search).get('ref'))) || '';
                if (referral) params.append('referral_code', referral);

                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors', // Apps Script requires no-cors for simple POST redirection
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: params.toString()
                });

                // With no-cors, we can't read the response body, but we can assume success if it doesn't throw
            }

            if (typeof window.fbq === 'function') window.fbq('track', 'Lead');
            setSubmitted(true);
            window.scrollTo(0, 0);
        } catch (error) {
            console.error('Submission error:', error);
            setSubmitError('There was a problem submitting your application. Please check your connection and try again, or email us directly.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const progressPercentage = ((step - 1) / totalSteps) * 100;

    if (submitted) {
        return (
            <div className="multi-step-page">
                <SEO
                    title="Application Received"
                    description="Your commercial finance application has been received by Boxx Commercial Finance. A specialist will review your requirements and be in touch shortly."
                    type="article"
                />
                {/* Hero Section */}
                <div className="service-hero">
                    <div className="container">
                        <h1>Your Funding Review Is <span className="text-highlight">Underway</span></h1>
                        <p>A funding specialist will assess your requirements and contact you shortly to discuss next steps. We focus on clarity, structure and securing the right outcome — not generic finance options.</p>
                    </div>
                </div>

                <div className="container service-layout single-column">
                    <div className="multi-step-container" style={{ textAlign: 'center' }}>
                        <h2 className="step-title">What happens next?</h2>

                        <div className="thank-you-details" style={{ margin: '2rem 0', textAlign: 'left', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
                            <div className="detail-item" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start' }}>
                                <span style={{ color: '#00d084', marginRight: '1rem', fontSize: '1.2rem' }}>✔</span>
                                <div>
                                    <strong>Response Time:</strong><br />
                                    We typically respond within one working day.
                                </div>
                            </div>

                            <div className="detail-item" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start' }}>
                                <span style={{ color: '#00d084', marginRight: '1rem', fontSize: '1.2rem' }}>✔</span>
                                <div>
                                    <strong>Urgent Requirement?</strong><br />
                                    Call our team directly on <a href="tel:01236702070" style={{ color: '#020c1b', fontWeight: 'bold' }}>01236 702070</a>.
                                </div>
                            </div>

                            <div className="detail-item" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start' }}>
                                <span style={{ color: '#00d084', marginRight: '1rem', fontSize: '1.2rem' }}>✔</span>
                                <div>
                                    <strong>While you wait:</strong><br />
                                    Read our latest <Link to="/insights" style={{ color: '#020c1b', fontWeight: 'bold' }}>Market Insights & Case Studies</Link>.
                                </div>
                            </div>
                        </div>

                        <Link to="/" className="btn-next">Return Home</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="multi-step-page">
            <SEO
                title="Chat About Funding"
                description={isBridging
                    ? "Tell us about your property and bridging loan requirements. Our specialists match homeowners, landlords, investors and developers with the most suitable UK bridging lenders."
                    : "Tell us about your business and funding requirements. Our specialists will review your application and match you with the most suitable UK lenders."}
                type="article"
            />
            {/* Hero Section */}
            <div className="service-hero">
                <div className="container">
                    {/* Bridging is the strategic focus and sells on speed, so it
                        gets a more active H1. Other services keep the warmer
                        "Let's Discuss …" template. */}
                    {isBridging
                        ? <h1>Let's Get Your <span className="text-highlight">Bridging Loan</span> Moving</h1>
                        : <h1>Let's Discuss <span className="text-highlight">{service ? service.title : 'Your Funding'}</span></h1>}
                    <p>{service ? service.description : 'Complete the short form below and our funding specialists will review your requirements promptly. We’ll assess suitability, structure the right approach, and guide you through the next steps with clarity and confidence.'}</p>
                </div>
            </div>

            <div className="container service-layout single-column">
                <div className="multi-step-container">
                    {/* Progress Bar */}
                    <div className="progress-container">
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }}></div>
                        </div>
                    </div>

                    {/* Bridging: single-step fast capture — just enough to start a conversation */}
                    {step === 1 && isBridging && (
                        <div className="step-content">
                            <h2 className="step-title">Tell us the essentials</h2>
                            <p className="step-subtitle" style={{ fontSize: '0.9rem', color: '#666', marginBottom: '2rem' }}>
                                All information is handled confidentially and reviewed by a funding specialist. We do not share details without your consent.
                            </p>

                            <CurrencyInput
                                label="Loan amount required"
                                name="amount"
                                value={formData.amount}
                                onChange={handleChange}
                                placeholder="e.g. £ 250,000"
                            />

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>How soon is the loan needed?</label>
                                <input
                                    type="text"
                                    name="purpose"
                                    className="quiz-input"
                                    placeholder="e.g. ASAP, 2 weeks, 1 month..."
                                    value={formData.purpose}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Full Name</label>
                                <input
                                    type="text"
                                    name="contactName"
                                    className="quiz-input"
                                    placeholder="Your Name"
                                    value={formData.contactName}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Email Address</label>
                                <input
                                    type="email"
                                    name="email"
                                    className="quiz-input"
                                    placeholder="name@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Phone Number</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    className="quiz-input"
                                    placeholder="07700 900000"
                                    value={formData.phone}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 1 (non-bridging): Requirement */}
                    {step === 1 && !isBridging && (
                        <div className="step-content">
                            <h2 className="step-title">What are you looking for?</h2>
                            <p className="step-subtitle" style={{ fontSize: '0.9rem', color: '#666', marginBottom: '2rem' }}>
                                All information is handled confidentially and reviewed by a funding specialist. We do not share details without your consent.
                            </p>

                            {!service && (
                                <div className="quiz-input-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>What type of funding are you looking for?</label>
                                    <select
                                        name="fundingType"
                                        className="quiz-input"
                                        value={formData.fundingType}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Option...</option>
                                        {fundingOptions.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <CurrencyInput
                                label="Approximate funding amount required"
                                name="amount"
                                value={formData.amount}
                                onChange={handleChange}
                                placeholder="e.g. £ 50,000"
                            />

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                                    {service ? `How soon do you need the ${service.title.toLowerCase().replace(/s$/, '')}?` : 'Purpose of funding'}
                                </label>
                                <input
                                    type="text"
                                    name="purpose"
                                    className="quiz-input"
                                    placeholder={service ? "e.g. Next 2 weeks, 1 month..." : "Short description..."}
                                    value={formData.purpose}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 2 (business): Business Overview */}
                    {step === 2 && !isBridging && (
                        <div className="step-content">
                            <h2 className="step-title">Business Overview</h2>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Business Name</label>
                                <input
                                    type="text"
                                    name="companyName"
                                    className="quiz-input"
                                    placeholder="Your Business Name"
                                    value={formData.companyName}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Industry / Sector</label>
                                <input
                                    type="text"
                                    name="industry"
                                    className="quiz-input"
                                    placeholder="e.g. Construction, Retail, etc."
                                    value={formData.industry}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Trading Status</label>
                                <select
                                    name="tradingStatus"
                                    className="quiz-input"
                                    value={formData.tradingStatus}
                                    onChange={handleChange}
                                >
                                    <option value="">Select...</option>
                                    <option value="Limited Company">Limited Company</option>
                                    <option value="Sole Trader">Sole Trader</option>
                                    <option value="Partnership">Partnership</option>
                                    <option value="LLP">LLP</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Years Trading</label>
                                <select
                                    name="yearsTrading"
                                    className="quiz-input"
                                    value={formData.yearsTrading}
                                    onChange={handleChange}
                                >
                                    <option value="">Select...</option>
                                    <option value="<1">Less than 1 year</option>
                                    <option value="1-2">1 - 2 years</option>
                                    <option value="2-5">2 - 5 years</option>
                                    <option value="5+">5+ years</option>
                                </select>
                            </div>

                            <CurrencyInput
                                label="Approximate Annual Turnover"
                                name="turnover"
                                value={formData.turnover}
                                onChange={handleChange}
                                placeholder="e.g. £ 250,000"
                            />
                        </div>
                    )}

                    {/* Step 3: Contact Details */}
                    {step === 3 && (
                        <div className="step-content">
                            <h2 className="step-title">Contact Details</h2>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Full Name</label>
                                <input
                                    type="text"
                                    name="contactName"
                                    className="quiz-input"
                                    placeholder="Your Name"
                                    value={formData.contactName}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Email Address</label>
                                <input
                                    type="email"
                                    name="email"
                                    className="quiz-input"
                                    placeholder="name@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Phone Number</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    className="quiz-input"
                                    placeholder="07700 900000"
                                    value={formData.phone}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Preferred Contact Method</label>
                                <select
                                    name="preferredContact"
                                    className="quiz-input"
                                    value={formData.preferredContact}
                                    onChange={handleChange}
                                >
                                    <option value="">Select...</option>
                                    <option value="Phone">Phone</option>
                                    <option value="Email">Email</option>
                                    <option value="Any">Any</option>
                                </select>
                            </div>

                            <p className="step-subtitle" style={{ fontSize: '0.9rem', color: '#666', marginTop: '1rem' }}>
                                We’ll use these details solely to respond to your enquiry.
                            </p>
                        </div>
                    )}

                    {/* Navigation Actions */}
                    <div className="form-actions-wrapper">
                        {submitError && (
                            <div className="submit-error" style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
                                {submitError}
                            </div>
                        )}
                        <div className="form-actions">
                            {step > 1 ? (
                                <button className="btn-back" onClick={prevStep} disabled={isSubmitting}>← Back</button>
                            ) : (
                                <div></div>
                            )}

                            <button className="btn-next" onClick={nextStep} disabled={isSubmitting}>
                                {isSubmitting ? 'Submitting...' : (step === totalSteps ? 'Request Funding Review' : 'Next →')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default MultiStepForm;
