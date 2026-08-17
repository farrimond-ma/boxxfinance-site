import React from 'react';
import { Link } from 'react-router-dom';
import './CaseStudies.css';

const caseStudies = [
    {
        category: 'Bridging Loans | Buy-to-Let Refurbishment',
        title: 'Glasgow Portfolio Expansion',
        loanAmount: '£95,000',
        ltv: '68% LTV',
        completionTime: '11 days',
        narrative: [
            'A landlord in Glasgow identified an opportunity to purchase a two-bedroom flat that had been discounted because it required extensive refurbishment. Traditional lenders were unable to provide funding within the seller\'s timescale, putting the purchase at risk.',
            'A bridging facility of £95,000 was arranged at 68% loan-to-value, enabling the client to complete the purchase and begin refurbishment immediately — a new kitchen, bathroom and heating system. Once the improvements were complete, the property\'s value increased significantly.'
        ],
        exitStrategy: 'Refinance onto a long-term buy-to-let mortgage following completion of the refurbishment.',
        outcome: 'The landlord added another income-producing property to an existing portfolio while preserving cash reserves for future investments.'
    },
    {
        category: 'Bridging Loans | Portfolio Acquisition',
        title: 'Manchester Buy-to-Let Acquisition',
        loanAmount: '£245,000',
        ltv: '72% LTV',
        completionTime: '14 days',
        narrative: [
            'An experienced landlord in Manchester was given the opportunity to acquire a four-property package from a retiring investor. The transaction needed to complete quickly to prevent the properties being marketed more widely.',
            'A bridging loan of £245,000 was arranged at 72% loan-to-value, allowing the client to secure all four properties within the required timeframe. Because the properties were already tenanted, the landlord generated rental income immediately after completion.'
        ],
        exitStrategy: 'Portfolio refinance through a specialist buy-to-let lender.',
        outcome: 'The client expanded their rental portfolio in a single transaction and secured several properties below current market value.'
    },
    {
        category: 'Bridging Loans | Property Conversion',
        title: 'Liverpool Property Conversion Project',
        loanAmount: '£425,000',
        ltv: '70% LTV',
        completionTime: '9 days',
        narrative: [
            'A landlord in Liverpool acquired a large residential property intending to convert it into multiple self-contained apartments. Although the project was commercially viable, the property\'s condition made it unsuitable for conventional mortgage funding.',
            'A bridging facility of £425,000 was arranged at 70% loan-to-value, providing the speed and flexibility required to complete the purchase. The conversion took six months and created four modern apartments, quickly let to long-term tenants.'
        ],
        exitStrategy: 'Refinancing onto a specialist investment mortgage based on the completed development\'s higher valuation.',
        outcome: 'The landlord transformed an underutilised property into a high-yielding rental investment, substantially increasing both rental income and portfolio value.'
    }
];

const CaseStudies = () => {
    return (
        <section className="section case-studies" id="case-studies">
            <div className="container">
                <div className="section-header">
                    <h2>Proven Results. <span className="text-highlight">Real Outcomes.</span></h2>
                    <p>We're judged by outcomes. Here's how we've helped UK property investors, developers and businesses secure structured bridging loans and commercial finance when it mattered most.</p>
                </div>

                <div className="case-studies-grid">
                    {caseStudies.map((study, index) => (
                        <div className="case-study-card" key={index}>
                            <div className="cs-category">{study.category}</div>
                            <h3 className="cs-title">{study.title}</h3>

                            <div className="cs-stats">
                                <div className="cs-stat">
                                    <span className="cs-stat-value">{study.loanAmount}</span>
                                    <span className="cs-stat-label">Loan amount</span>
                                </div>
                                <div className="cs-stat">
                                    <span className="cs-stat-value">{study.ltv}</span>
                                    <span className="cs-stat-label">Loan-to-value</span>
                                </div>
                                <div className="cs-stat">
                                    <span className="cs-stat-value">{study.completionTime}</span>
                                    <span className="cs-stat-label">Completion</span>
                                </div>
                            </div>

                            <div className="cs-details">
                                {study.narrative.map((para, i) => (
                                    <p className="cs-narrative" key={i}>{para}</p>
                                ))}
                                <div className="cs-section">
                                    <h4>Exit strategy:</h4>
                                    <p>{study.exitStrategy}</p>
                                </div>
                                <div className="cs-section cs-outcome">
                                    <h4>Outcome:</h4>
                                    <p>{study.outcome}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="cs-cta">
                    <Link to="/chat-about-funding" className="btn btn-primary">Speak to a Funding Specialist</Link>
                </div>
            </div>
        </section>
    );
};

export default CaseStudies;
