import React from 'react';

// Loan-amount bands, matching the Facebook lead forms and the Boxx CRM exactly.
// VALUES ARE THE CRM'S OWN STRINGS — do not reformat them (no £, no spaces, no
// en dashes). Ad leads and website leads must land in the same field with the
// same value, otherwise they cannot be reported on together. The label is the
// only part meant to be readable; change that freely, never the value.
export const AMOUNT_BANDS = [
    { value: '0-49,999', label: 'Up to £49,999' },
    { value: '50,000-99,000', label: '£50,000 – £99,000' },
    { value: '100,000-249,999', label: '£100,000 – £249,999' },
    { value: '250,000+', label: '£250,000+' },
];

const AmountBandSelect = ({
    label = 'Loan amount required',
    name = 'amount',
    value,
    onChange,
    id,
    required = false,
    className = 'quiz-input',
}) => (
    <div className="quiz-input-group">
        <label htmlFor={id || name} style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>{label}</label>
        <select id={id || name} name={name} className={className} value={value || ''} onChange={onChange} required={required}>
            <option value="">Select amount...</option>
            {AMOUNT_BANDS.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
            ))}
        </select>
    </div>
);

export default AmountBandSelect;
