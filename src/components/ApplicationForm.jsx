import React, { useEffect, useState } from 'react';
import SEO from './SEO';
import { useChatWidget } from './chat/ChatWidgetContext';
import '../pages/MultiStepForm.css';

// Same Apps Script endpoint every other form on the site posts to.
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwF7_EU1ekXaviBoRU_Xay1P4uzAhIm7t_Ded9j73jh9B_fpObwNdspWtSji8YLrpHFag/exec';

// Boxx applications CRM endpoints (see boxx_webapp/INTAKE.md and GOOGLE_SHEET_SYNC.md in the CRM
// project).
const CRM_INTAKE_URL = 'https://crm.boxxfinance.co.uk/intake.php'; // new leads
const CRM_INTAKE_KEY = '83cb574fb096ff8c62df4e117ac969a5f601c1ec43d5e91f'; // must match config.php's 'intake_key'
const CRM_LOOKUP_URL = 'https://crm.boxxfinance.co.uk/lookup.php'; // resolves ?t=... to a name/email
const CRM_PROGRESS_SUBMIT_URL = 'https://crm.boxxfinance.co.uk/progress_submit.php'; // completes an existing case

const CurrencyInput = ({ label, name, value, onChange, placeholder, required }) => {
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
                required={required}
            />
        </div>
    );
};

const SECURITY_USE_OPTIONS = ['Main residence', 'Investment'];

// Shared "repossession fact find" form — same short field set (name, DOB, the security property,
// its value, what it's used for, what's owed against it, repossession/receivership threat, reason
// for funds, and credit history) whether reached via a client's personal chase link
// (ProgressApplication, enableTokenLookup) or a cold ad landing page with no prior contact
// (enableTokenLookup=false, always submits as a brand new lead). "Amount owed" is what stands in
// for a loan-amount figure on this form. Hero copy and SEO are passed in per page so each landing
// page can have its own headline while sharing one submission path, kept in sync in one place.
const ApplicationForm = ({
    heroTitle,
    heroSubtitle,
    seoTitle,
    seoDescription,
    seoImage = '/application_hero_bg.png',
    fundingTypeLabel,
    enableTokenLookup = true,
    showQuestionsLink = true,
    multiStep = false,
}) => {
    // Only meaningful when multiStep — page 1 asks contact details, page 2 asks everything else.
    // Splitting the fields across two native <form> submits (rather than one long form) means the
    // browser's own required-field validation still gates moving on, without extra JS validation.
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        fullName: '',
        dob: '',
        email: '',
        phone: '',
        securityAddress: '',
        securityValue: '',
        securityUse: '',
        amountOwed: '',
        repossessionThreat: '',
        reasonForFunds: '',
        hasAdverseCredit: '',
        adverseCreditDetails: '',
    });
    const [status, setStatus] = useState('idle'); // idle | sending | done | error
    const [token, setToken] = useState(null); // set once a valid ?t=... link is confirmed
    const [prefillStatus, setPrefillStatus] = useState('idle'); // idle | loading | found | not_found
    const { openChat } = useChatWidget();

    // If this page was opened via a client's unique link (?t=...), resolve it to their name/email
    // and pre-fill the form. An invalid/expired token just falls back to a normal blank form —
    // no error shown, since a client clicking an old link shouldn't hit a dead end. Cold ad landing
    // pages never carry a token, so they skip this entirely and always submit as a new lead.
    useEffect(() => {
        if (!enableTokenLookup) return;
        const t = new URLSearchParams(window.location.search).get('t');
        if (!t || !CRM_LOOKUP_URL) return;
        setPrefillStatus('loading');
        fetch(`${CRM_LOOKUP_URL}?t=${encodeURIComponent(t)}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => {
                if (!data.ok) throw new Error();
                setToken(t);
                setForm((f) => ({ ...f, fullName: data.full_name || '', email: data.email || '' }));
                setPrefillStatus('found');
            })
            .catch(() => setPrefillStatus('not_found'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enableTokenLookup]);

    const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    // Page 1 (contact details) just advances to page 2 — nothing is sent until the whole form is
    // actually complete, so Meta's pixel/CAPI "Lead" event (fired below, only on final success)
    // still tracks a fully completed form, not someone who only filled in their contact details.
    const onStep1Next = (e) => {
        e.preventDefault();
        setStep(2);
    };

    const buildCommonFields = () => ({
        security_address: form.securityAddress,
        security_value: form.securityValue,
        security_use: form.securityUse,
        amount_owed: form.amountOwed,
        repossession_threat: form.repossessionThreat === 'yes' ? '1' : '0',
        loan_purpose: form.reasonForFunds,
    });

    const onSubmit = async (e) => {
        e.preventDefault();
        setStatus('sending');

        // Opened via a client link: this completes that specific case in the CRM directly.
        // No new lead, no Google Sheet row — it's the same case being filled in, not a new one.
        if (token && CRM_PROGRESS_SUBMIT_URL) {
            try {
                const params = new URLSearchParams();
                params.append('t', token);
                params.append('full_name', form.fullName);
                params.append('client_dob', form.dob);
                params.append('client_email', form.email);
                params.append('client_phone', form.phone);
                params.append('adverse_credit', form.hasAdverseCredit === 'yes' ? '1' : '0');
                if (form.hasAdverseCredit === 'yes') params.append('adverse_credit_details', form.adverseCreditDetails);
                Object.entries(buildCommonFields()).forEach(([k, v]) => params.append(k, v));
                const res = await fetch(CRM_PROGRESS_SUBMIT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const data = await res.json();
                if (!data.ok) throw new Error(data.error || 'Submit failed');
                setStatus('done');
            } catch {
                setStatus('error');
            }
            return;
        }

        try {
            const summary = [
                `Security property: ${form.securityAddress} (£${form.securityValue ? Number(form.securityValue).toLocaleString() : 'n/a'}, ${form.securityUse || 'n/a'})`,
                `Amount owed on all mortgages/charges: £${form.amountOwed ? Number(form.amountOwed).toLocaleString() : 'n/a'}`,
                `Threat of repossession/receivership: ${form.repossessionThreat === 'yes' ? 'Yes' : 'No'}`,
                `Reason for funds: ${form.reasonForFunds || 'n/a'}`,
                `Adverse credit: ${form.hasAdverseCredit === 'yes' ? 'Yes — ' + form.adverseCreditDetails : 'No'}`,
                `DOB: ${form.dob}`,
            ].join(' | ');

            const params = new URLSearchParams();
            params.append('name', form.fullName);
            params.append('email', form.email);
            params.append('phone', form.phone);
            params.append('funding_type', fundingTypeLabel);
            params.append('funding_purpose', summary);
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
                crmParams.append('adverse_credit', form.hasAdverseCredit === 'yes' ? '1' : '0');
                if (form.hasAdverseCredit === 'yes') crmParams.append('adverse_credit_details', form.adverseCreditDetails);
                const landingPage = sessionStorage.getItem('boxx_landing_page');
                if (landingPage) crmParams.append('landing_page', landingPage);
                Object.entries(buildCommonFields()).forEach(([k, v]) => crmParams.append(k, v));
                fetch(CRM_INTAKE_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: crmParams.toString(),
                }).catch(() => { /* best-effort, Sheet already has the lead */ });
            }

            // Fires once the whole form (both steps, where applicable) has actually been
            // completed and submitted — same "Lead" event and same point in the flow every other
            // lead-capture form on the site fires it at, so Meta optimises ad delivery towards
            // people who finish the form, not just start it.
            if (typeof window.fbq === 'function') window.fbq('track', 'Lead');

            setStatus('done');
        } catch {
            setStatus('error');
        }
    };

    return (
        <div className="multi-step-page">
            <SEO title={seoTitle} description={seoDescription} image={seoImage} noIndex={true} />

            <div className="service-hero">
                <h1>{heroTitle}</h1>
                <p className="progress-hero-subtitle">{heroSubtitle}</p>
                {showQuestionsLink && (
                    <p className="progress-hero-subtitle">
                        <button
                            type="button"
                            onClick={openChat}
                            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
                        >
                            Do you have any questions?
                        </button>
                    </p>
                )}
            </div>

            <div className="service-layout single-column">
                <div className="multi-step-container">
                    {status === 'done' ? (
                        <div>
                            <h2>Thanks — we've got everything we need.</h2>
                            <p>A member of the team will be in touch shortly to progress your application.</p>
                        </div>
                    ) : prefillStatus === 'loading' ? (
                        <p>Loading your details…</p>
                    ) : (
                        <form onSubmit={multiStep && step === 1 ? onStep1Next : onSubmit}>
                            {multiStep && (
                                <p className="step-subtitle" style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.5rem' }}>
                                    Step {step} of 2
                                </p>
                            )}

                            {(!multiStep || step === 1) && (
                                <>
                                    <div className="quiz-input-group">
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Your name</label>
                                        <input type="text" name="fullName" className="quiz-input" required value={form.fullName} onChange={onChange} />
                                    </div>
                                    <div className="quiz-input-group">
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Your date of birth</label>
                                        <input type="date" name="dob" className="quiz-input" required value={form.dob} onChange={onChange} />
                                    </div>
                                    <div className="quiz-input-group">
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Email address</label>
                                        <input type="email" name="email" className="quiz-input" required value={form.email} onChange={onChange} />
                                    </div>
                                    {!token && (
                                        <div className="quiz-input-group">
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Phone number</label>
                                            <input type="tel" name="phone" className="quiz-input" required value={form.phone} onChange={onChange} />
                                        </div>
                                    )}
                                </>
                            )}

                            {(!multiStep || step === 2) && (
                                <>
                                    <div className="quiz-input-group">
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>The address of the property you're at risk of losing</label>
                                        <textarea name="securityAddress" className="quiz-input" rows="5" required value={form.securityAddress} onChange={onChange} />
                                    </div>
                                    <CurrencyInput label="Approximate current value" name="securityValue" value={form.securityValue} onChange={onChange} placeholder="e.g. £ 500,000" required />
                                    <div className="quiz-input-group">
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Is this your home, or a buy-to-let/investment property?</label>
                                        <div style={{ display: 'flex', gap: '2rem' }}>
                                            {SECURITY_USE_OPTIONS.map((o) => (
                                                <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                                                    <input type="radio" name="securityUse" value={o} checked={form.securityUse === o} onChange={onChange} required />
                                                    {o}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <CurrencyInput label="How much do you currently owe on it? (all mortgages and charges combined)" name="amountOwed" value={form.amountOwed} onChange={onChange} placeholder="e.g. £ 150,000" required />
                                    <div className="quiz-input-group">
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Are you facing repossession or receivership?</label>
                                        <div style={{ display: 'flex', gap: '2rem' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                                                <input type="radio" name="repossessionThreat" value="yes" checked={form.repossessionThreat === 'yes'} onChange={onChange} required />
                                                Yes
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                                                <input type="radio" name="repossessionThreat" value="no" checked={form.repossessionThreat === 'no'} onChange={onChange} required />
                                                No
                                            </label>
                                        </div>
                                    </div>
                                    <div className="quiz-input-group">
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>What would you use the funds for?</label>
                                        <textarea name="reasonForFunds" className="quiz-input" rows="4" required value={form.reasonForFunds} onChange={onChange} />
                                    </div>

                                    <h3>Credit history</h3>
                                    <div className="quiz-input-group">
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                                            Have you had any missed mortgage or loan payments, County Court Judgments (CCJs), or been declared bankrupt or subject to an IVA or administration in the last 3 years?
                                        </label>
                                        <div style={{ display: 'flex', gap: '2rem' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                                                <input type="radio" name="hasAdverseCredit" value="yes" checked={form.hasAdverseCredit === 'yes'} onChange={onChange} required />
                                                Yes
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                                                <input type="radio" name="hasAdverseCredit" value="no" checked={form.hasAdverseCredit === 'no'} onChange={onChange} required />
                                                No
                                            </label>
                                        </div>
                                    </div>
                                    {form.hasAdverseCredit === 'yes' && (
                                        <div className="quiz-input-group">
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Please give details</label>
                                            <textarea name="adverseCreditDetails" className="quiz-input" rows="3" required value={form.adverseCreditDetails} onChange={onChange} />
                                        </div>
                                    )}
                                </>
                            )}

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                {multiStep && step === 2 && (
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        disabled={status === 'sending'}
                                        style={{ background: 'none', border: '2px solid currentColor', borderRadius: '4px', padding: '0 1.5rem', cursor: 'pointer', font: 'inherit' }}
                                    >
                                        ← Back
                                    </button>
                                )}
                                <button type="submit" className="btn btn-primary" disabled={status === 'sending'} style={{ flex: 1 }}>
                                    {multiStep && step === 1 ? 'Next →' : status === 'sending' ? 'Sending…' : 'Submit details'}
                                </button>
                            </div>
                            {status === 'error' && <p style={{ color: '#a3271f', marginTop: '0.75rem' }}>Something went wrong — call <a href="tel:01236702070">01236 702070</a> instead.</p>}
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ApplicationForm;
