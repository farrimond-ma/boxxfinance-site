import React, { useState } from 'react';
import SEO from './SEO';
import AmountBandSelect from './AmountBandSelect';
import { useChatWidget } from './chat/ChatWidgetContext';
import '../pages/MultiStepForm.css';

/**
 * Two-service enquiry form: /bridging-enquiry and /development-finance-enquiry.
 *
 * Shape borrowed from the Polished Insurance quote form, which works: ask for as
 * little as possible, then let the visitor choose what happens next rather than
 * forcing a long form on everyone.
 *
 *   Step 1  Amount + name + phone + email. Posted to the Sheet immediately, so a
 *           drop-out at the choice below is still a lead staff can see.
 *   Step 2  The choice: have an adviser call, or answer more questions now.
 *   Step 3  The deal questions, all optional, service-specific.
 *
 * The CRM is posted ONCE, at the end of whichever path the visitor takes, because
 * intake.php INSERTs a new application on every call (no dedupe) — posting at both
 * step 1 and step 3 would create two applications for one person.
 *
 * Deliberately NOT the fact find at /progress-your-application. That page mirrors
 * the CRM's Fact Find tab and is used for repossession cases and chase links;
 * Mark's instruction was to leave it alone. This form maps onto intake.php's own
 * columns instead, so neither the CRM nor the Fact Find needs changing.
 */

// Same Apps Script endpoint every other form on the site posts to.
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwF7_EU1ekXaviBoRU_Xay1P4uzAhIm7t_Ded9j73jh9B_fpObwNdspWtSji8YLrpHFag/exec';
const CRM_INTAKE_URL = 'https://crm.boxxfinance.co.uk/intake.php';
const CRM_INTAKE_KEY = '83cb574fb096ff8c62df4e117ac969a5f601c1ec43d5e91f';

// Below this, the panel has nothing to place, so the visitor is sent to the assistant
// rather than into the CRM. Mirrors MultiStepForm and the homepage figures band.
const BELOW_MINIMUM_BAND = '0-49,999';

const SERVICES = {
    bridging: {
        label: 'Bridging Loan',
        seoTitle: 'Bridging Loan Enquiry',
        seoDescription: 'Tell us what you need and a bridging specialist will come back to you with realistic terms.',
        heroTitle: 'Bridging Loan Enquiry',
        heroSubtitle: 'Four quick questions to start. You choose what happens next.',
        amountLabel: 'How much do you need to borrow?',
    },
    development: {
        label: 'Development Finance',
        seoTitle: 'Development Finance Enquiry',
        seoDescription: 'Tell us about your scheme and a development finance specialist will come back to you with realistic terms.',
        heroTitle: 'Development Finance Enquiry',
        heroSubtitle: 'Four quick questions to start. You choose what happens next.',
        amountLabel: 'How much funding do you need?',
    },
};

const BLANK = {
    amount: '', contactName: '', phone: '', email: '',
    // Bridging
    purposeType: '', propertyType: '', securityAddress: '', securityValue: '',
    purchasePrice: '', chargeType: '', existingLoan: '', speed: '',
    exitStrategy: '', exitNotes: '', applicantType: '', adverseCredit: '',
    // Development
    schemeType: '', planningStatus: '', gdv: '', buildCosts: '', units: '', experience: '',
};

const Field = ({ label, name, value, onChange, type = 'text', placeholder, options, required, hint }) => (
    <div className="quiz-input-group">
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            {label}{required && ' *'}
        </label>
        {options ? (
            <select name={name} className="quiz-input" value={value} onChange={onChange} required={required}>
                <option value="">Please choose</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
        ) : (
            <input
                type={type}
                name={name}
                className="quiz-input"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                required={required}
            />
        )}
        {hint && <p style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: '#777' }}>{hint}</p>}
    </div>
);

const EnquiryForm = ({ service }) => {
    const cfg = SERVICES[service];
    const isBridging = service === 'bridging';
    const { openChat } = useChatWidget();

    const [step, setStep] = useState(1);
    const [data, setData] = useState(BLANK);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(null); // 'call' | 'details'

    const isBelowMinimum = isBridging && data.amount === BELOW_MINIMUM_BAND;
    const change = (e) => setData((d) => ({ ...d, [e.target.name]: e.target.value }));

    const referral = () => (typeof window !== 'undefined'
        && (sessionStorage.getItem('boxx_ref') || new URLSearchParams(window.location.search).get('ref'))) || '';

    const postSheet = async (stage) => {
        const p = new URLSearchParams();
        p.append('source', `${cfg.label} Enquiry (${stage})`);
        p.append('name', data.contactName);
        p.append('email', data.email);
        p.append('phone', data.phone);
        p.append('funding_amount', data.amount);
        p.append('funding_type', cfg.label);
        p.append('funding_purpose', [
            isBelowMinimum && 'Below £50,000 bridging minimum — routed to the assistant, not sent to CRM',
            data.purposeType && `Purpose: ${data.purposeType}`,
            data.schemeType && `Scheme: ${data.schemeType}`,
            data.planningStatus && `Planning: ${data.planningStatus}`,
            data.gdv && `GDV: ${data.gdv}`,
            data.buildCosts && `Build costs: ${data.buildCosts}`,
            data.units && `Units: ${data.units}`,
            data.securityAddress && `Property: ${data.securityAddress}`,
            data.securityValue && `Value: ${data.securityValue}`,
            data.purchasePrice && `Purchase price: ${data.purchasePrice}`,
            data.chargeType && `Charge: ${data.chargeType}`,
            data.existingLoan && `Existing borrowing: ${data.existingLoan}`,
            data.speed && `Needed: ${data.speed}`,
            data.exitStrategy && `Exit: ${data.exitStrategy}${data.exitNotes ? ` (${data.exitNotes})` : ''}`,
            data.applicantType && `Borrower: ${data.applicantType}`,
            data.experience && `Experience: ${data.experience}`,
            data.adverseCredit && `Adverse credit: ${data.adverseCredit}`,
        ].filter(Boolean).join(' | '));
        const ref = referral();
        if (ref) p.append('referral_code', ref);
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: p.toString(),
        });
    };

    // Maps onto intake.php's own columns wherever one exists, so nothing has to change in
    // the CRM or its Fact Find tab. Anything without a column goes into notes as readable
    // text rather than being dropped.
    const postCrm = () => {
        if (isBelowMinimum) return;
        const p = new URLSearchParams();
        p.append('intake_key', CRM_INTAKE_KEY);
        p.append('full_name', data.contactName);
        p.append('client_email', data.email);
        p.append('client_phone', data.phone);
        // loan_amount_band holds the CRM's own band strings and is reported on alongside ad
        // leads, so only the bridging form (which uses AmountBandSelect) may write to it.
        // Development amounts are free text, so they go to the numeric column instead.
        if (isBridging) p.append('loan_amount_band', data.amount);
        else p.append('loan_amount_required', data.amount.replace(/[^0-9]/g, ''));
        if (data.propertyType) p.append('property_type', data.propertyType);
        if (data.securityAddress) p.append('security_address', data.securityAddress.slice(0, 255));
        if (data.securityValue) p.append('security_value', data.securityValue.replace(/[^0-9]/g, ''));
        if (data.purchasePrice) p.append('purchase_price', data.purchasePrice.replace(/[^0-9]/g, ''));
        if (data.chargeType) p.append('charge_type', data.chargeType);
        if (data.existingLoan) p.append('existing_loan_outstanding', data.existingLoan.replace(/[^0-9]/g, ''));
        if (data.speed) p.append('speed_required', data.speed);
        if (data.purposeType) p.append('loan_purpose_type', data.purposeType);
        if (data.applicantType) p.append('applicant_type', data.applicantType);
        if (data.adverseCredit) p.append('adverse_credit', data.adverseCredit);
        if (data.experience) p.append('investment_experience', data.experience);
        // exit_strategy only accepts refinance/sale/other; anything else is dropped at the CRM.
        if (data.exitStrategy) p.append('exit_strategy', data.exitStrategy.toLowerCase());
        if (data.exitNotes) p.append('exit_strategy_notes', data.exitNotes);
        if (!isBridging) {
            const summary = [
                data.schemeType && `Scheme: ${data.schemeType}`,
                data.planningStatus && `Planning: ${data.planningStatus}`,
                data.gdv && `GDV: ${data.gdv}`,
                data.buildCosts && `Build costs: ${data.buildCosts}`,
                data.units && `Units: ${data.units}`,
            ].filter(Boolean).join(' | ').slice(0, 1000);
            if (summary) p.append('project_summary', summary);
        }
        const ref = referral();
        const landing = typeof window !== 'undefined' ? sessionStorage.getItem('boxx_landing_page') : '';
        if (landing) p.append('landing_page', landing);
        p.append('notes', [
            `Web enquiry: ${cfg.label}`,
            done === 'call' || step === 2 ? 'Asked for a call back' : 'Completed the detail questions',
            ref && `Referral: ${ref}`,
        ].filter(Boolean).join(' | '));
        // Best-effort: the Sheet already holds the lead, so a CRM failure never blocks the
        // thank-you screen.
        fetch(CRM_INTAKE_URL, {
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: p.toString(),
        }).catch(() => {});
    };

    const submitStep1 = async (e) => {
        e.preventDefault();
        setBusy(true); setError('');
        try {
            await postSheet('brief');
            setStep(2);
            window.scrollTo(0, 0);
        } catch {
            setError('Something went wrong sending that. Please try again, or call 01236 702070.');
        } finally {
            setBusy(false);
        }
    };

    const finish = async (mode) => {
        setBusy(true); setError('');
        try {
            if (mode === 'details') await postSheet('detail');
            postCrm();
            // Meta optimises towards whatever is reported as a Lead, so an enquiry the panel
            // cannot place is deliberately not counted.
            if (!isBelowMinimum && typeof window.fbq === 'function') window.fbq('track', 'Lead');
            setDone(mode);
            window.scrollTo(0, 0);
        } catch {
            setError('Something went wrong sending that. Please try again, or call 01236 702070.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="multi-step-page">
            <SEO
                title={cfg.seoTitle}
                description={cfg.seoDescription}
                image="/og-boxx.png"
                /* Conversion page, not a search landing page: the service hubs rank for these
                   terms and shouldn't compete with a form. */
                noIndex={true}
            />

            <div className="service-hero">
                <h1>{cfg.heroTitle}</h1>
                <p className="progress-hero-subtitle">{cfg.heroSubtitle}</p>
            </div>

            <div className="service-layout single-column">
                <div className="multi-step-container">
                    {done ? (
                        <div>
                            <h2>Thanks, {data.contactName.split(' ')[0] || 'we have that'}.</h2>
                            <p>
                                {done === 'call'
                                    ? 'A specialist will call you shortly to talk it through.'
                                    : 'A specialist will review what you have sent and come back to you with realistic terms.'}
                            </p>
                            <p style={{ color: '#666', fontSize: '0.9375rem' }}>
                                If it is urgent, call <a href="tel:01236702070">01236 702070</a>.
                            </p>
                        </div>
                    ) : step === 1 ? (
                        <form onSubmit={submitStep1}>
                            <h2 className="step-title">Tell us the essentials</h2>
                            <p className="step-subtitle" style={{ fontSize: '0.9rem', color: '#666', marginBottom: '2rem' }}>
                                All information is handled confidentially and reviewed by a funding specialist.
                                We do not share details without your consent.
                            </p>

                            {isBridging ? (
                                <AmountBandSelect
                                    label={cfg.amountLabel}
                                    name="amount"
                                    value={data.amount}
                                    onChange={change}
                                />
                            ) : (
                                <Field
                                    label={cfg.amountLabel}
                                    name="amount"
                                    value={data.amount}
                                    onChange={change}
                                    placeholder="e.g. £750,000"
                                    required
                                />
                            )}

                            {isBelowMinimum && (
                                <div className="quiz-input-group" style={{ background: '#fff8e6', border: '1px solid #f0d488', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
                                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                        Bridging lenders on our panel start at <strong>£50,000</strong>, so we cannot place a loan
                                        below that. A secured loan or second charge may suit instead, and our assistant can tell
                                        you in a couple of minutes.
                                    </p>
                                    <button type="button" className="btn btn-primary" onClick={openChat} style={{ fontSize: '0.9rem' }}>
                                        Ask the assistant
                                    </button>
                                </div>
                            )}

                            <Field label="Your name" name="contactName" value={data.contactName} onChange={change} required />
                            <Field label="Phone number" name="phone" type="tel" value={data.phone} onChange={change} required />
                            <Field label="Email address" name="email" type="email" value={data.email} onChange={change} required />

                            {error && <p style={{ color: '#b00020' }}>{error}</p>}
                            <button type="submit" className="btn btn-primary" disabled={busy}>
                                {busy ? 'Sending…' : 'Continue'}
                            </button>
                        </form>
                    ) : step === 2 ? (
                        <div>
                            <h2 className="step-title">How would you like to go on?</h2>
                            <p className="step-subtitle" style={{ fontSize: '0.9rem', color: '#666', marginBottom: '2rem' }}>
                                We have your details either way. Answering a few more questions means the adviser
                                can come back with realistic terms rather than a general chat.
                            </p>

                            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => { setStep(3); window.scrollTo(0, 0); }}
                                    style={{ textAlign: 'left', padding: '1rem 1.25rem' }}
                                >
                                    <strong style={{ display: 'block' }}>Answer a few more questions</strong>
                                    <span style={{ fontWeight: 400, fontSize: '0.875rem' }}>About two minutes. Nothing is compulsory.</span>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => finish('call')}
                                    disabled={busy}
                                    style={{ textAlign: 'left', padding: '1rem 1.25rem' }}
                                >
                                    <strong style={{ display: 'block' }}>{busy ? 'Sending…' : 'I would prefer a call first'}</strong>
                                    <span style={{ fontWeight: 400, fontSize: '0.875rem' }}>A specialist will ring you to talk it through.</span>
                                </button>
                            </div>
                            {error && <p style={{ color: '#b00020' }}>{error}</p>}
                        </div>
                    ) : (
                        <form onSubmit={(e) => { e.preventDefault(); finish('details'); }}>
                            <h2 className="step-title">{isBridging ? 'About the property and the plan' : 'About the scheme'}</h2>
                            <p className="step-subtitle" style={{ fontSize: '0.9rem', color: '#666', marginBottom: '2rem' }}>
                                Everything here is optional. Answer what you know and leave the rest.
                            </p>

                            {isBridging ? (
                                <>
                                    <Field label="What is the loan for?" name="purposeType" value={data.purposeType} onChange={change}
                                        options={['Purchase', 'Auction purchase', 'Refinance an existing bridge', 'Raising capital', 'Refurbishment', 'Stopping a repossession', 'Something else']} />
                                    <Field label="Property type" name="propertyType" value={data.propertyType} onChange={change}
                                        options={['Residential', 'Buy to let', 'HMO', 'Semi-commercial', 'Commercial', 'Land', 'Other']} />
                                    <Field label="Property address or area" name="securityAddress" value={data.securityAddress} onChange={change}
                                        placeholder="e.g. Glasgow G1, or the full address" />
                                    <Field label="Property value" name="securityValue" value={data.securityValue} onChange={change} placeholder="e.g. £450,000" />
                                    <Field label="Purchase price, if you are buying" name="purchasePrice" value={data.purchasePrice} onChange={change} placeholder="e.g. £400,000" />
                                    <Field label="Is there a mortgage on it already?" name="chargeType" value={data.chargeType} onChange={change}
                                        options={['No, it is owned outright', 'Yes, I need a first charge loan to repay it', 'Yes, I need a second charge behind it']} />
                                    <Field label="Roughly how much is outstanding?" name="existingLoan" value={data.existingLoan} onChange={change} placeholder="e.g. £120,000" />
                                    <Field label="When do you need the money?" name="speed" value={data.speed} onChange={change}
                                        options={['As soon as possible', 'Within 2 weeks', 'Within a month', '1 to 3 months', 'Just researching']} />
                                    <Field label="How will the loan be repaid?" name="exitStrategy" value={data.exitStrategy} onChange={change}
                                        options={['Sale', 'Refinance', 'Other']} hint="Lenders call this the exit. It matters more than almost anything else." />
                                    <Field label="Anything to add about the exit?" name="exitNotes" value={data.exitNotes} onChange={change}
                                        placeholder="e.g. selling another property, refinancing onto a buy to let" />
                                    <Field label="Who is borrowing?" name="applicantType" value={data.applicantType} onChange={change}
                                        options={['An individual', 'A limited company or SPV', 'A partnership or trust', 'Not decided yet']} />
                                    <Field label="Any credit issues we should know about?" name="adverseCredit" value={data.adverseCredit} onChange={change}
                                        options={['No', 'Some, historic', 'Yes, recent', 'Not sure']}
                                        hint="It rarely stops a bridging loan. Knowing early means we go to the right lender." />
                                </>
                            ) : (
                                <>
                                    <Field label="What kind of scheme is it?" name="schemeType" value={data.schemeType} onChange={change}
                                        options={['Ground-up development', 'Conversion', 'Permitted development', 'Heavy refurbishment', 'Part-built or stalled site', 'Something else']} />
                                    <Field label="Site address or area" name="securityAddress" value={data.securityAddress} onChange={change}
                                        placeholder="e.g. Glasgow G1, or the full address" />
                                    <Field label="Planning status" name="planningStatus" value={data.planningStatus} onChange={change}
                                        options={['Full planning granted', 'Outline planning granted', 'Application submitted', 'No planning yet', 'Permitted development rights']} />
                                    <Field label="Purchase price or current site value" name="purchasePrice" value={data.purchasePrice} onChange={change} placeholder="e.g. £400,000" />
                                    <Field label="Expected value once finished (GDV)" name="gdv" value={data.gdv} onChange={change} placeholder="e.g. £1,600,000" />
                                    <Field label="Estimated build costs" name="buildCosts" value={data.buildCosts} onChange={change} placeholder="e.g. £750,000" />
                                    <Field label="How many units?" name="units" value={data.units} onChange={change} placeholder="e.g. 6 flats" />
                                    <Field label="Schemes completed before" name="experience" value={data.experience} onChange={change}
                                        options={['This is my first', '1 to 2', '3 to 5', 'More than 5']}
                                        hint="Lenders price experience heavily, so it is worth saying." />
                                    <Field label="When do you need the funding?" name="speed" value={data.speed} onChange={change}
                                        options={['As soon as possible', 'Within a month', '1 to 3 months', 'Just researching']} />
                                    <Field label="How will the facility be repaid?" name="exitStrategy" value={data.exitStrategy} onChange={change}
                                        options={['Sale', 'Refinance', 'Other']} />
                                    <Field label="Who is borrowing?" name="applicantType" value={data.applicantType} onChange={change}
                                        options={['An individual', 'A limited company or SPV', 'A partnership or trust', 'Not decided yet']} />
                                </>
                            )}

                            {error && <p style={{ color: '#b00020' }}>{error}</p>}
                            <button type="submit" className="btn btn-primary" disabled={busy}>
                                {busy ? 'Sending…' : 'Send my details'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EnquiryForm;
