import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import './BridgingCalculator.css';

/**
 * Bridging loan cost calculator.
 *
 * Deliberately models the things the site's own article
 * (/insights/bridging-loan-calculator-uk) criticises basic calculators for
 * leaving out: arrangement, valuation and legal fees, and the three ways
 * interest can be charged. A loan × rate × term box would contradict our own
 * content, which says "there are the fees that most calculators simply don't
 * include".
 *
 * Ranges come from that article: monthly rates commonly 0.4%–1.5% depending on
 * lender, LTV and exit strength; arrangement fees typically 1–2%. Nothing here
 * is a quoted rate — the user sets every input, and the output is labelled
 * indicative throughout. This is a working illustration, not a decision in
 * principle, and the copy must never imply otherwise.
 */

const INTEREST_TYPES = [
    {
        id: 'serviced',
        label: 'Serviced',
        blurb: 'You pay the interest monthly, like a standard loan.',
    },
    {
        id: 'retained',
        label: 'Retained',
        blurb: 'Interest for the full term is deducted from the advance up front.',
    },
    {
        id: 'rolled',
        label: 'Rolled up',
        blurb: 'Interest is added to the balance and settled in full at the end.',
    },
];

const money = (n) =>
    n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

const BridgingCalculator = () => {
    const [amount, setAmount] = useState(250000);
    const [rate, setRate] = useState(0.75);      // % per month
    const [months, setMonths] = useState(12);
    const [interestType, setInterestType] = useState('rolled');
    const [arrangementPct, setArrangementPct] = useState(2);
    const [otherFees, setOtherFees] = useState(2500); // valuation + legals, indicative

    const result = useMemo(() => {
        const gross = Math.max(0, Number(amount) || 0);
        const r = Math.max(0, Number(rate) || 0) / 100;
        const n = Math.max(1, Number(months) || 1);
        const arrangementFee = gross * (Math.max(0, Number(arrangementPct) || 0) / 100);
        const fees = arrangementFee + Math.max(0, Number(otherFees) || 0);

        // Rolled-up interest compounds monthly — the balance itself grows, which
        // is what makes it cost more than the simple figure people expect.
        const totalInterest = interestType === 'rolled'
            ? gross * (Math.pow(1 + r, n) - 1)
            : gross * r * n;

        // What actually reaches you on day one.
        const netAdvance = interestType === 'retained'
            ? gross - totalInterest - fees
            : gross - fees;

        // What you clear on exit. Serviced interest has already been paid
        // monthly, so only the principal remains.
        const redemption = interestType === 'rolled' ? gross + totalInterest : gross;

        return {
            gross,
            arrangementFee,
            fees,
            totalInterest,
            monthlyPayment: interestType === 'serviced' ? gross * r : 0,
            netAdvance,
            redemption,
            totalCost: totalInterest + fees,
        };
    }, [amount, rate, months, interestType, arrangementPct, otherFees]);

    const active = INTEREST_TYPES.find((t) => t.id === interestType);
    const shortfall = result.netAdvance < 0;

    return (
        <section className="calc-section" id="bridging-calculator">
            <div className="container">
                <div className="calc-head">
                    <h2>Bridging Loan <span className="text-highlight">Calculator</span></h2>
                    <p>
                        Most bridging calculators show interest and nothing else. This one includes
                        the fees and shows what actually reaches your account — because that is the
                        number that decides whether a deal works.
                    </p>
                </div>

                <div className="calc-grid">
                    <div className="calc-inputs">
                        <label className="calc-field">
                            <span>Loan amount</span>
                            <div className="calc-input-wrap">
                                <em>£</em>
                                <input
                                    type="number" min="0" step="5000" value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    aria-label="Loan amount in pounds"
                                />
                            </div>
                        </label>

                        <label className="calc-field">
                            <span>Monthly interest rate</span>
                            <div className="calc-input-wrap">
                                <input
                                    type="number" min="0" max="5" step="0.05" value={rate}
                                    onChange={(e) => setRate(e.target.value)}
                                    aria-label="Monthly interest rate as a percentage"
                                />
                                <em>%</em>
                            </div>
                            <small>Typically 0.4%–1.5%, depending on lender, LTV and exit.</small>
                        </label>

                        <label className="calc-field">
                            <span>Term</span>
                            <div className="calc-input-wrap">
                                <input
                                    type="number" min="1" max="36" step="1" value={months}
                                    onChange={(e) => setMonths(e.target.value)}
                                    aria-label="Term in months"
                                />
                                <em>months</em>
                            </div>
                        </label>

                        <fieldset className="calc-field calc-types">
                            <legend>How the interest is charged</legend>
                            <div className="calc-type-buttons">
                                {INTEREST_TYPES.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        className={interestType === t.id ? 'is-active' : ''}
                                        onClick={() => setInterestType(t.id)}
                                        aria-pressed={interestType === t.id}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                            <small>{active.blurb}</small>
                        </fieldset>

                        <div className="calc-row">
                            <label className="calc-field">
                                <span>Arrangement fee</span>
                                <div className="calc-input-wrap">
                                    <input
                                        type="number" min="0" max="10" step="0.25" value={arrangementPct}
                                        onChange={(e) => setArrangementPct(e.target.value)}
                                        aria-label="Arrangement fee as a percentage of the loan"
                                    />
                                    <em>%</em>
                                </div>
                                <small>Usually 1%–2%.</small>
                            </label>

                            <label className="calc-field">
                                <span>Valuation &amp; legal fees</span>
                                <div className="calc-input-wrap">
                                    <em>£</em>
                                    <input
                                        type="number" min="0" step="250" value={otherFees}
                                        onChange={(e) => setOtherFees(e.target.value)}
                                        aria-label="Valuation and legal fees in pounds"
                                    />
                                </div>
                                <small>Varies with property type and value.</small>
                            </label>
                        </div>
                    </div>

                    <div className="calc-results" aria-live="polite">
                        <div className="calc-headline">
                            <span>Money you receive on day one</span>
                            <strong className={shortfall ? 'is-negative' : ''}>{money(result.netAdvance)}</strong>
                            {shortfall && (
                                <p className="calc-warning">
                                    The fees and retained interest exceed the loan. Increase the loan,
                                    shorten the term, or choose a different interest option.
                                </p>
                            )}
                        </div>

                        <dl className="calc-breakdown">
                            <div><dt>Gross loan</dt><dd>{money(result.gross)}</dd></div>
                            {interestType === 'serviced' && (
                                <div><dt>Monthly payment</dt><dd>{money(result.monthlyPayment)}</dd></div>
                            )}
                            <div><dt>Interest over {months} month{Number(months) === 1 ? '' : 's'}</dt><dd>{money(result.totalInterest)}</dd></div>
                            <div><dt>Arrangement fee</dt><dd>{money(result.arrangementFee)}</dd></div>
                            <div><dt>Valuation &amp; legals</dt><dd>{money(Math.max(0, Number(otherFees) || 0))}</dd></div>
                            <div className="calc-total"><dt>Total cost of borrowing</dt><dd>{money(result.totalCost)}</dd></div>
                            <div className="calc-total"><dt>To repay at exit</dt><dd>{money(result.redemption)}</dd></div>
                        </dl>

                        <p className="calc-disclaimer">
                            Indicative only. These figures are worked from the numbers you have
                            entered — they are not a quote, a rate we have offered, or a decision in
                            principle. Actual terms depend on the property, your exit plan and the
                            lender. Speak to a broker before relying on any of it.
                        </p>

                        <div className="calc-actions">
                            <Link to="/chat-about-funding/bridging-loans" className="btn btn-primary">
                                Discuss your bridging loan
                            </Link>
                            <Link to="/insights/bridging-loan-calculator-uk" className="calc-link">
                                How bridging costs really work &rarr;
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default BridgingCalculator;
