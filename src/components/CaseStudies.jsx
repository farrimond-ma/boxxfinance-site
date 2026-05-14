import React from 'react';
import { Link } from 'react-router-dom';
import './CaseStudies.css';

const caseStudies = [
    {
        category: 'Asset Finance | Logistics Sector',
        title: 'Warehouse Expansion Funding After High Street Decline',
        situation: 'Our client, a national logistics firm, required funding to support the expansion of their warehouse operations.',
        challenge: 'Their existing high street bank declined the application due to internal criteria.',
        approach: 'We structured a proposal aligned to projected cash flow and sourced a specialist lender suited to the asset profile.',
        outcome: 'Funding secured promptly, allowing expansion to proceed without disruption.',
        client: 'J. Miller, Managing Director'
    },
    {
        category: 'Invoice Finance | Technology Sector',
        title: 'Unlocking Cash Flow to Support Larger Contracts',
        situation: 'A specialist technology firm needed improved working capital flexibility to support rapid growth.',
        challenge: 'Cash flow constraints were limiting growth opportunities.',
        approach: 'We structured an invoice finance facility aligned with their sales cycle and client base.',
        outcome: 'Cash flow improved significantly, enabling the business to take on larger contracts.',
        client: 'A. Patel, Managing Director'
    },
    {
        category: 'Bridging Finance | Property Development',
        title: 'Time-Sensitive Commercial Property Acquisition',
        situation: 'Our client, an established property developer, needed to secure a mixed-use acquisition quickly.',
        challenge: 'Existing lenders could not meet the required completion timeline.',
        approach: 'We structured a short-term bridging facility aligned with the exit strategy and engaged a specialist lender.',
        outcome: 'Funding secured within tight timescales, protecting the acquisition opportunity.',
        client: 'R. Dawson, Managing Director'
    }
];

const CaseStudies = () => {
    return (
        <section className="section case-studies" id="case-studies">
            <div className="container">
                <div className="section-header">
                    <h2>Proven Results. <span className="text-highlight">Real Business Outcomes.</span></h2>
                    <p>We’re judged by outcomes. Here’s how we’ve helped UK businesses secure structured commercial finance when it mattered most.</p>
                </div>

                <div className="case-studies-grid">
                    {caseStudies.map((study, index) => (
                        <div className="case-study-card" key={index}>
                            <div className="cs-category">{study.category}</div>
                            <h3 className="cs-title">{study.title}</h3>

                            <div className="cs-details">
                                <div className="cs-section">
                                    <h4>Situation:</h4>
                                    <p>{study.situation}</p>
                                </div>
                                <div className="cs-section">
                                    <h4>Challenge:</h4>
                                    <p>{study.challenge}</p>
                                </div>
                                <div className="cs-section">
                                    <h4>Our Approach:</h4>
                                    <p>{study.approach}</p>
                                </div>
                                <div className="cs-section cs-outcome">
                                    <h4>Outcome:</h4>
                                    <p>{study.outcome}</p>
                                </div>
                            </div>

                            <div className="cs-client">
                                <p>{study.client}</p>
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
