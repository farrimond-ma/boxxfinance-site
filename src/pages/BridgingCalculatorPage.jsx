import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import BridgingCalculator from '../components/BridgingCalculator';
import ResourceHero, { FinalCtaBand } from '../components/resource/ResourceHero';
import FundingCards from '../components/resource/FundingCards';
import { pickHero } from '../components/resource/heroPool';
import '../components/resource/ResourcePage.css';

/**
 * Dedicated bridging calculator page.
 *
 * Positioning matters here. The site already has two articles titled as
 * calculators — /insights/bridging-loan-calculator-uk and
 * /insights/bridging-finance-calculator — which were already competing with
 * each other for the same query. This page is deliberately the TOOL: short,
 * calculator first, and it links out to those articles for the detail rather
 * than restating it. They in turn link here.
 *
 * That split is the point. If this page duplicated their explanation it would
 * be a third competitor for one term, which is the cannibalisation the
 * .htaccess consolidation redirects exist to clean up.
 */
const CALCULATOR_FAQ = [
    {
        q: 'How is bridging loan interest calculated?',
        a: 'Bridging interest is quoted as a monthly rate rather than an annual one. '
            + 'It can be serviced (paid monthly), retained (deducted from the advance up front) '
            + 'or rolled up (added to the balance and settled at the end). Rolled-up interest '
            + 'compounds each month, so it costs more than the same rate paid monthly.',
    },
    {
        q: 'Why is the money I receive less than the loan amount?',
        a: 'The arrangement fee, valuation and legal costs come out of the advance, and with '
            + 'retained interest the whole term of interest is deducted up front too. On a '
            + '£250,000 facility that gap can be well over £20,000, which is why the net '
            + 'advance matters more than the headline loan.',
    },
    {
        q: 'Are these figures a quote?',
        a: 'No. The calculator works from the numbers you enter, so it is an illustration only. '
            + 'It is not a quote, a rate we have offered, or a decision in principle. Actual '
            + 'terms depend on the property, your exit plan and the lender.',
    },
];

const BridgingCalculatorPage = () => {
    const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: CALCULATOR_FAQ.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
    };

    return (
        <div className="resource-page">
            <SEO
                title="Bridging Loan Calculator"
                description="Work out what a bridging loan actually costs — including arrangement, valuation and legal fees, and the difference between serviced, retained and rolled-up interest. See what reaches your account on day one."
                keywords="bridging loan calculator, bridging finance calculator, bridging loan cost, rolled up interest, retained interest"
                schema={faqSchema}
            />

            <ResourceHero
                title="Bridging Loan Calculator"
                description="Most calculators show interest and stop there. This one includes the fees and shows the net advance — what actually reaches your account on day one."
                heroImage={pickHero('bridging-loan-calculator')}
                primaryCtaTo="/chat-about-funding/bridging-loans"
            />

            <BridgingCalculator />

            <div className="resource-column">
                <div className="resource-main-card">
                    <div className="blog-post-content">
                        <h2>What the calculator is doing</h2>
                        <p>
                            Bridging interest is quoted monthly, not annually, and how it is charged
                            changes the cost more than most people expect. There are three structures,
                            and the calculator models all of them.
                        </p>
                        <ul>
                            <li>
                                <strong>Serviced</strong> — you pay the interest monthly, like a
                                standard loan, and repay the principal at exit.
                            </li>
                            <li>
                                <strong>Retained</strong> — interest for the whole term is deducted
                                from the advance up front. Your monthly outgoings are nil, but you
                                receive considerably less on day one.
                            </li>
                            <li>
                                <strong>Rolled up</strong> — interest is added to the balance and
                                settled in full at exit. It compounds monthly, so the total is higher
                                than the same rate serviced.
                            </li>
                        </ul>

                        <h2>Why the net advance is the number that matters</h2>
                        <p>
                            The arrangement fee, valuation and legal costs come out of the loan, and
                            with retained interest the full term of interest does too. A £250,000
                            facility can put well under £230,000 in your account. If your purchase
                            needs the full amount, that gap is the thing that breaks the deal, and it
                            is the figure this calculator leads on.
                        </p>

                        <h2>Read more</h2>
                        <p>
                            These go into the detail the calculator summarises:
                        </p>
                        <ul>
                            <li>
                                <Link to="/insights/bridging-loan-calculator-uk">
                                    How bridging loan costs really work
                                </Link>{' '}
                                — fees, rates and the mistakes people make with online calculators.
                            </li>
                            <li>
                                <Link to="/insights/how-bridging-loan-interest-is-calculated">
                                    How bridging loan interest is calculated
                                </Link>{' '}
                                — monthly rates, compounding, and the three interest structures.
                            </li>
                            <li>
                                <Link to="/funding-solutions/bridging-loans">
                                    Bridging loans explained
                                </Link>{' '}
                                — what they are for, timescales, and how we arrange them.
                            </li>
                        </ul>

                        <h2>Frequently asked questions</h2>
                        {CALCULATOR_FAQ.map((f) => (
                            <div key={f.q}>
                                <h3>{f.q}</h3>
                                <p>{f.a}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <FundingCards currentService="bridging-loans" />
            </div>

            <FinalCtaBand ctaTo="/chat-about-funding/bridging-loans" />
        </div>
    );
};

export default BridgingCalculatorPage;
