import React, { useEffect, useState } from 'react';
import SEO from '../components/SEO';
import './MultiStepForm.css';

// Same Apps Script endpoint every other form on the site posts to.
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwF7_EU1ekXaviBoRU_Xay1P4uzAhIm7t_Ded9j73jh9B_fpObwNdspWtSji8YLrpHFag/exec';

// Boxx applications CRM endpoints (see boxx_webapp/INTAKE.md and GOOGLE_SHEET_SYNC.md in the CRM
// project). Fill these in once the CRM is deployed to SiteGround; until then these calls are
// skipped so the Google Sheet remains the only destination, and links with ?t=... just show a
// blank form (no pre-fill, submits as a normal new lead).
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

const EXIT_OPTIONS = ['Sale of the security property', 'Refinance onto a mortgage', 'Sale of another property', 'Other'];
const APPLICANT_TYPE_OPTIONS = ['UK Resident', 'UK Company', 'Non-UK Resident', 'Non-UK Company'];
const SECURITY_TYPE_OPTIONS = ['Residential', 'Semi-commercial', 'Commercial', 'Land'];
const TENURE_OPTIONS = ['Freehold', 'Leasehold'];

// Generic, un-personalised page — anyone with the link can submit, no lookup of an existing
// enquiry. Mirrors the fields on Boxx's standard bridging enquiry form (applicant type, broker,
// security details, purchase-or-refinance loan purpose, loan amount, exit strategy, adverse
// credit, plus a project summary and experience free-text).
const ProgressApplication = () => {
    const [form, setForm] = useState({
        fullName: '',
        dob: '',
        email: '',
        phone: '',
        applicantType: '',
        securityAddress: '',
        securityType: '',
        securityValue: '',
        chargeType: '',
        tenure: '',
        leaseholdYearsRemaining: '',
        loanPurposeType: '', // Purchase | Refinance
        purchaseAddress: '',
        purchasePrice: '',
        existingLenderName: '',
        existingLoanOutstanding: '',
        loanAmount: '',
        loanAmountBasis: '', // Net | Gross
        exitStrategy: '',
        projectSummary: '',
        investmentExperience: '',
        hasAdverseCredit: '',
        adverseCreditDetails: '',
    });
    const [status, setStatus] = useState('idle'); // idle | sending | done | error
    const [token, setToken] = useState(null); // set once a valid ?t=... link is confirmed
    const [prefillStatus, setPrefillStatus] = useState('idle'); // idle | loading | found | not_found

    // If this page was opened via a client's unique link (?t=...), resolve it to their name/email
    // and pre-fill the form. An invalid/expired token just falls back to a normal blank form —
    // no error shown, since a client clicking an old link shouldn't hit a dead end.
    useEffect(() => {
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
    }, []);

    const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const buildCommonFields = () => ({
        applicant_type: form.applicantType,
        security_address: form.securityAddress,
        security_type: form.securityType,
        security_value: form.securityValue,
        charge_type: form.chargeType,
        tenure: form.tenure,
        leasehold_years_remaining: form.tenure === 'Leasehold' ? form.leaseholdYearsRemaining : '',
        loan_purpose_type: form.loanPurposeType,
        purchase_address: form.loanPurposeType === 'Purchase' ? form.purchaseAddress : '',
        purchase_price: form.loanPurposeType === 'Purchase' ? form.purchasePrice : '',
        existing_lender_name: form.loanPurposeType === 'Refinance' ? form.existingLenderName : '',
        existing_loan_outstanding: form.loanPurposeType === 'Refinance' ? form.existingLoanOutstanding : '',
        loan_amount_required: form.loanAmount,
        loan_amount_basis: form.loanAmountBasis,
        exit_strategy: form.exitStrategy,
        project_summary: form.projectSummary,
        investment_experience: form.investmentExperience,
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
                `Applicant type: ${form.applicantType || 'n/a'}`,
                `Loan amount required: £${form.loanAmount ? Number(form.loanAmount).toLocaleString() : 'n/a'} (${form.loanAmountBasis || 'n/a'})`,
                form.loanPurposeType === 'Refinance'
                    ? `Refinance: existing lender ${form.existingLenderName || 'n/a'}, balance £${form.existingLoanOutstanding ? Number(form.existingLoanOutstanding).toLocaleString() : 'n/a'}`
                    : `Purchase property: ${form.purchaseAddress} (£${form.purchasePrice ? Number(form.purchasePrice).toLocaleString() : 'n/a'})`,
                `Security property: ${form.securityAddress} (£${form.securityValue ? Number(form.securityValue).toLocaleString() : 'n/a'}, ${form.securityType || 'n/a'}, ${form.chargeType || 'n/a'}, ${form.tenure || 'n/a'}${form.tenure === 'Leasehold' ? ' - ' + (form.leaseholdYearsRemaining || 'n/a') + ' yrs remaining' : ''})`,
                `Exit strategy: ${form.exitStrategy}`,
                `Project summary: ${form.projectSummary || 'n/a'}`,
                `Experience: ${form.investmentExperience || 'n/a'}`,
                `Adverse credit: ${form.hasAdverseCredit === 'yes' ? 'Yes — ' + form.adverseCreditDetails : 'No'}`,
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
                crmParams.append('adverse_credit', form.hasAdverseCredit === 'yes' ? '1' : '0');
                if (form.hasAdverseCredit === 'yes') crmParams.append('adverse_credit_details', form.adverseCreditDetails);
                Object.entries(buildCommonFields()).forEach(([k, v]) => crmParams.append(k, v));
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
                <p className="progress-hero-subtitle">We just need a few more details so we can move your bridging loan forward.</p>
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
                        <form onSubmit={onSubmit}>
                            <h3 style={{ marginTop: 0 }}>Your details</h3>
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
                            {!token && (
                                <div className="quiz-input-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Phone</label>
                                    <input type="tel" name="phone" className="quiz-input" required value={form.phone} onChange={onChange} />
                                </div>
                            )}
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Which best describes you?</label>
                                <select name="applicantType" className="quiz-input" required value={form.applicantType} onChange={onChange}>
                                    <option value="" disabled>Select an option</option>
                                    {APPLICANT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            <h3>Security</h3>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Property security address</label>
                                <textarea name="securityAddress" className="quiz-input" rows="5" required value={form.securityAddress} onChange={onChange} />
                            </div>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Security type</label>
                                <select name="securityType" className="quiz-input" required value={form.securityType} onChange={onChange}>
                                    <option value="" disabled>Select an option</option>
                                    {SECURITY_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            <CurrencyInput label="Estimated value" name="securityValue" value={form.securityValue} onChange={onChange} placeholder="e.g. £ 500,000" required />
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Charge type</label>
                                <div style={{ display: 'flex', gap: '2rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                                        <input type="radio" name="chargeType" value="1st charge" checked={form.chargeType === '1st charge'} onChange={onChange} required />
                                        1st charge
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                                        <input type="radio" name="chargeType" value="2nd charge" checked={form.chargeType === '2nd charge'} onChange={onChange} required />
                                        2nd charge
                                    </label>
                                </div>
                            </div>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Tenure</label>
                                <div style={{ display: 'flex', gap: '2rem' }}>
                                    {TENURE_OPTIONS.map((o) => (
                                        <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                                            <input type="radio" name="tenure" value={o} checked={form.tenure === o} onChange={onChange} required />
                                            {o}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            {form.tenure === 'Leasehold' && (
                                <div className="quiz-input-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Years remaining on term</label>
                                    <input type="number" min="0" name="leaseholdYearsRemaining" className="quiz-input" required value={form.leaseholdYearsRemaining} onChange={onChange} />
                                </div>
                            )}

                            <h3>Loan purpose</h3>
                            <div className="quiz-input-group">
                                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                                        <input type="radio" name="loanPurposeType" value="Purchase" checked={form.loanPurposeType === 'Purchase'} onChange={onChange} required />
                                        Borrowing to purchase
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                                        <input type="radio" name="loanPurposeType" value="Refinance" checked={form.loanPurposeType === 'Refinance'} onChange={onChange} required />
                                        Borrowing to refinance and/or raise capital
                                    </label>
                                </div>
                            </div>
                            {form.loanPurposeType === 'Purchase' && (
                                <>
                                    <div className="quiz-input-group">
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Address of the property you want to buy</label>
                                        <textarea name="purchaseAddress" className="quiz-input" rows="5" required value={form.purchaseAddress} onChange={onChange} />
                                    </div>
                                    <CurrencyInput label="Purchase price" name="purchasePrice" value={form.purchasePrice} onChange={onChange} placeholder="e.g. £ 350,000" required />
                                </>
                            )}
                            {form.loanPurposeType === 'Refinance' && (
                                <>
                                    <div className="quiz-input-group">
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Name of existing lender</label>
                                        <input type="text" name="existingLenderName" className="quiz-input" required value={form.existingLenderName} onChange={onChange} />
                                    </div>
                                    <CurrencyInput label="Current loan outstanding" name="existingLoanOutstanding" value={form.existingLoanOutstanding} onChange={onChange} placeholder="e.g. £ 150,000" required />
                                </>
                            )}

                            <h3>Loan details</h3>
                            <CurrencyInput label="Loan amount required" name="loanAmount" value={form.loanAmount} onChange={onChange} placeholder="e.g. £ 250,000" required />
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Net or gross?</label>
                                <div style={{ display: 'flex', gap: '2rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                                        <input type="radio" name="loanAmountBasis" value="Net" checked={form.loanAmountBasis === 'Net'} onChange={onChange} required />
                                        Net
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal' }}>
                                        <input type="radio" name="loanAmountBasis" value="Gross" checked={form.loanAmountBasis === 'Gross'} onChange={onChange} required />
                                        Gross
                                    </label>
                                </div>
                            </div>

                            <h3>Further details</h3>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Project summary — any details to help us understand the project</label>
                                <textarea name="projectSummary" className="quiz-input" rows="4" value={form.projectSummary} onChange={onChange} />
                            </div>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Experience — property investment experience, previous projects, current portfolio, any professional qualifications etc.</label>
                                <textarea name="investmentExperience" className="quiz-input" rows="4" value={form.investmentExperience} onChange={onChange} />
                            </div>

                            <h3>How will you exit the bridge?</h3>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Exit strategy</label>
                                <select name="exitStrategy" className="quiz-input" required value={form.exitStrategy} onChange={onChange}>
                                    <option value="" disabled>Select an option</option>
                                    {EXIT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>

                            <h3>Credit history</h3>
                            <div className="quiz-input-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                                    Have you had any missed mortgage or loan payments, County Court Judgments (CCJs), or been subject to bankruptcy, an IVA or administration proceedings in the last 3 years?
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
