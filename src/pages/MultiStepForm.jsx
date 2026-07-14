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
    const isBridging = slug === 'bridging-loans';
    const [step, setStep] = useState(1);
    const totalSteps = 3;
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
        // Step 2 (bridging loan)
        applicantType: '',
        propertyType: '',
        loanPurpose: '',
        propertyValue: '',
        exitStrategy: '',
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

                if (isBridging) {
                    // Send discrete bridging fields...
                    params.append('applicant_type', formData.applicantType);
                    params.append('property_type', formData.propertyType);
                    params.append('loan_purpose', formData.loanPurpose);
                    params.append('property_value', formData.propertyValue);
                    params.append('exit_strategy', formData.exitStrategy);
                    // ...and fold them into funding_purpose so the detail is
                    // captured even if the sheet only records known columns.
                    const bridgingSummary = [
                        formData.applicantType && `Applicant: ${formData.applicantType}`,
                        formData.propertyType && `Property: ${formData.propertyType}`,
                        formData.loanPurpose && `Purpose: ${formData.loanPurpose}`,
                        formData.propertyValue && `Est. value: £${parseInt(formData.propertyValue).toLocaleString()}`,
                        formData.exitStrategy && `Exit: ${formData.exitStrategy}`,
                        formData.purpose && `Timescale: ${formData.purpose}`,
                    ].filter(Boolean).join(' | ');
                    params.append('funding_purpose', bridgingSummary);
                } else {
                    params.append('funding_purpose', formData.purpose || '');
                }
                params.append('preferred_contact', formData.preferredContact);

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
                                    Call our team directly on <a href="tel:03300431612" style={{ color: '#020c1b', fontWeight: 'bold' }}>0330 043 1612</a>.
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
                    <h1>Let's Discuss <span className="text-highlight">{service ? service.title : 'Your Funding'}</span></h1>
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

                    {/* Step 1: Requirement */}
                    {step === 1 && (
                        <div className="step-content">
                            <h2 className="step-title">{service ? `${service.title} Details` : 'Share Your Funding Requirements'}</h2>
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
                                    {service ? `How soon do you need the ${service.title.toLowerCase()}?` : 'Purpose of funding'}
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

                    {/* Step 2 (bridging): Property & Deal */}
                    {step === 2 && isBridging && (
                        <div className="step-content">
                            <h2 className="step-title">About the Property & Deal</h2>
                            <p className="step-subtitle" style={{ fontSize: '0.9rem', color: '#666', marginBottom: '2rem' }}>
                                Bridging loans are available to homeowners, landlords, investors and developers — not just businesses. A few quick details help us match the right lender.
                            </p>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Who is the loan for?</label>
                                <select name="applicantType" className="quiz-input" value={formData.applicantType} onChange={handleChange}>
                                    <option value="">Select...</option>
                                    <option value="Homeowner">Homeowner (e.g. chain break)</option>
                                    <option value="Landlord">Landlord</option>
                                    <option value="Property investor">Property investor</option>
                                    <option value="Property developer">Property developer</option>
                                    <option value="Business">Business</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Type of property</label>
                                <select name="propertyType" className="quiz-input" value={formData.propertyType} onChange={handleChange}>
                                    <option value="">Select...</option>
                                    <option value="Residential">Residential</option>
                                    <option value="Buy-to-let / HMO">Buy-to-let / HMO</option>
                                    <option value="Semi-commercial">Semi-commercial</option>
                                    <option value="Commercial">Commercial</option>
                                    <option value="Land / development site">Land / development site</option>
                                </select>
                            </div>

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>What do you need the bridging loan for?</label>
                                <select name="loanPurpose" className="quiz-input" value={formData.loanPurpose} onChange={handleChange}>
                                    <option value="">Select...</option>
                                    <option value="Breaking a property chain">Breaking a property chain</option>
                                    <option value="Auction purchase">Auction purchase</option>
                                    <option value="Buy before you sell">Buy before you sell</option>
                                    <option value="Refurbishment / conversion">Refurbishment / conversion</option>
                                    <option value="Development exit">Development exit</option>
                                    <option value="Raising capital / equity release">Raising capital / equity release</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <CurrencyInput
                                label="Estimated property value"
                                name="propertyValue"
                                value={formData.propertyValue}
                                onChange={handleChange}
                                placeholder="e.g. £ 350,000"
                            />

                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>How will the loan be repaid (exit)?</label>
                                <select name="exitStrategy" className="quiz-input" value={formData.exitStrategy} onChange={handleChange}>
                                    <option value="">Select...</option>
                                    <option value="Sale of this property">Sale of this property</option>
                                    <option value="Sale of another property">Sale of another property</option>
                                    <option value="Refinance onto a mortgage">Refinance onto a mortgage</option>
                                    <option value="Sale after refurbishment">Sale after refurbishment</option>
                                    <option value="Not sure yet">Not sure yet</option>
                                </select>
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
