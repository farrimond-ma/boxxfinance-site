import React, { useState } from 'react';
import SEO from '../components/SEO';
import './MultiStepForm.css';

// Same Apps Script endpoint every other form on the site posts to.
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwF7_EU1ekXaviBoRU_Xay1P4uzAhIm7t_Ded9j73jh9B_fpObwNdspWtSji8YLrpHFag/exec';

// Boxx applications CRM intake endpoint (see boxx_webapp/INTAKE.md in the CRM project).
// Fill these in once the CRM is deployed to SiteGround; until then this call is skipped
// so the Google Sheet remains the only destination.
const CRM_INTAKE_URL = ''; // e.g. 'https://crm.boxxfinance.co.uk/intake.php'
const CRM_INTAKE_KEY = ''; // the 'intake_key' value set in the CRM's config.php

const CurrencyInput = ({ label, name, value, onChange, placeholder }) => {
    const formatValue = (val) => {
        if (!val) return '';
        return '£ ' + parseInt(val).toLocaleString();
    };
    const handleChange = (e) => {
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

const EXIT_OPTIONS = ['Sale of the security property', 'Refinance onto a mortgage', 'Sale of another property', 'Other'];

// Generic, un-personalised page — anyone with the link can submit, no lookup
// of an existing enquiry. Captures exactly the four things asked for: the
// two properties (purchase + security), the exit strategy, and the client's
// identity (name + DOB). Posts to the same sheet as every other form, tagged
// distinctly so it's easy to filter to "progressing" submissions.
const ProgressApplication = () => {
    const [form, setForm] = useState({
        fullName: '',
        dob: '',
        email: '',
        phone: '',
        purchaseAddress: '',
        purchasePrice: '',
        securityAddress: '',
        securityValue: '',
        loanAmount: '',
        exitStrategy: '',
        exitStrategyDetail: '',
    });
    const [status, setStatus] = useState('idle'); // idle | sending | done | error

    const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const onSubmit = async (e) => {
        e.preventDefault();
        setStatus('sending');
        try {
            const summary = [
                `Loan amount required: £${form.loanAmount ? Number(form.loanAmount).toLocaleString() : 'n/a'}`,
                `Purchase property: ${form.purchaseAddress} (£${form.purchasePrice ? Number(form.purchasePrice).toLocaleString() : 'n/a'})`,
                `Security property: ${form.securityAddress} (£${form.securityValue ? Number(form.securityValue).toLocaleString() : 'n/a'})`,
                `Exit strategy: ${form.exitStrategy}${form.exitStrategyDetail ? ' — ' + form.exitStrategyDetail : ''}`,
                `DOB: ${form.dob}`,
            ].join(' | ');

            const params = new URLSearchParams();
            params.append('name', form.fullName);
            params.append('email', form.email);
            params.append('phone', form.phone);
            params.append('funding_type', 'Progress Application (Bridging)');
            params.append('funding_purpose', summary);
            params.append('funding_amount', form.loanAmount);
            params.append('property_value', form.securityValue);
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            });

            // Also send to the Boxx applications CRM, best-effort — if this fails the
            // Google Sheet above still has the lead, so we don't surface an error to the
            // client or block the "thanks" screen on it.
            if (CRM_INTAKE_URL) {
                // mode:'no-cors' only permits "simple" headers/bodies, so this uses
                // form-urlencoded (like the Google Script call above) rather than JSON.
                const crmParams = new URLSearchParams();
                crmParams.append('intake_key', CRM_INTAKE_KEY);
                crmParams.append('full_name', form.fullName);
                crmParams.append('client_dob', form.dob);
                crmParams.append('email', form.email);
                crmParams.append('phone', form.phone);
                crmParams.append('purchase_address', form.purchaseAddress);
                crmParams.append('purchase_price', form.purchasePrice);
                crmParams.append('security_address', form.securityAddress);
                crmParams.append('security_value', form.securityValue);
                crmParams.append('loan_amount', form.loanAmount);
                crmParams.append('exit_strategy', form.exitStrategy);
                crmParams.append('exit_strategy_notes', form.exitStrategyDetail);
                fetch(CRM_INTAKE_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: crmParams.toString(),
                }).catch(() => { /* best-effort, Sheet already has the lead */ });
            }

            setStatus('done');
        } catch {
            setStatus('error');
        }
    };

    return (
        <div className="multi-step-page">
            <SEO
                title="Progress Your Application"
                description="Give us a few more details to progress your bridging loan application."
                noIndex={true}
            />

            <div className="service-hero">
                <h1>Progress Your <span className="text-highlight">Application</span></h1>
                <p>A few more details so we can move your bridging loan forward.</p>
            </div>

            <div className="service-layout single-column">
                <div className="multi-step-container">
                    {status === 'done' ? (
                        <div>
                            <h2>Thanks — we've got everything we need.</h2>
                            <p>A member of the team will be in touch shortly to progress your application.</p>
                        </div>
                    ) : (
                        <form onSubmit={onSubmit}>
                            <h3 style={{ marginTop: 0 }}>About you</h3>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Full name</label>
                                <input type="text" name="fullName" className="quiz-input" required value={form.fullName} onChange={onChange} />
                            </div>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Date of birth</label>
                                <input type="date" name="dob" className="quiz-input" required value={form.dob} onChange={onChange} />
                            </div>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Email</label>
                                <input type="email" name="email" className="quiz-input" required value={form.email} onChange={onChange} />
                            </div>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Phone</label>
                                <input type="tel" name="phone" className="quiz-input" required value={form.phone} onChange={onChange} />
                            </div>

                            <h3>The property you want to buy</h3>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Address</label>
                                <textarea name="purchaseAddress" className="quiz-input" rows="5" required value={form.purchaseAddress} onChange={onChange} />
                            </div>
                            <CurrencyInput label="Purchase price" name="purchasePrice" value={form.purchasePrice} onChange={onChange} placeholder="e.g. £ 350,000" />

                            <h3>The property securing the bridge</h3>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Address</label>
                                <textarea name="securityAddress" className="quiz-input" rows="5" required value={form.securityAddress} onChange={onChange} />
                            </div>
                            <CurrencyInput label="Value" name="securityValue" value={form.securityValue} onChange={onChange} placeholder="e.g. £ 500,000" />

                            <h3>How much do you need to borrow?</h3>
                            <CurrencyInput label="Loan amount required" name="loanAmount" value={form.loanAmount} onChange={onChange} placeholder="e.g. £ 250,000" />

                            <h3>How will you exit the bridge?</h3>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Exit strategy</label>
                                <select name="exitStrategy" className="quiz-input" required value={form.exitStrategy} onChange={onChange}>
                                    <option value="" disabled>Select an option</option>
                                    {EXIT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Anything else we should know? (optional)</label>
                                <textarea name="exitStrategyDetail" className="quiz-input" rows="3" value={form.exitStrategyDetail} onChange={onChange} />
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={status === 'sending'} style={{ width: '100%', marginTop: '1rem' }}>
                                {status === 'sending' ? 'Sending…' : 'Submit details'}
                            </button>
                            {status === 'error' && <p style={{ color: '#a3271f', marginTop: '0.75rem' }}>Something went wrong — call <a href="tel:01236702070">01236 702070</a> instead.</p>}
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProgressApplication;
