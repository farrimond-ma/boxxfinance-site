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
        category: 'Bridging Loans | Auction Purchase',
        title: 'Securing an Auction Property Within a 28-Day Deadline',
        situation: 'A property investor won a residential property at auction and needed to complete within the standard 28-day deadline, with a £34,000 deposit already at risk.',
        challenge: 'A high street mortgage could not be arranged in time to meet the completion date.',
        approach: 'We arranged a bridging loan at 65% LTV secured against the property, with a clear exit onto a buy-to-let mortgage once purchased.',
        outcome: 'Funds released in 12 working days — well inside the auction deadline — protecting both the property and the deposit.',
        client: 'S. Bell, Property Investor'
    },
    {
        category: 'Bridging Loans | Property Development',
        title: 'Time-Sensitive Mixed-Use Property Acquisition',
        situation: 'An established property developer needed to secure a £1.2m mixed-use acquisition, with the seller requiring completion within three weeks.',
        challenge: 'A standard commercial mortgage application could not be underwritten in the time available.',
        approach: 'We structured a bridging facility at 65% LTV aligned with the developer\'s refinance exit and engaged a specialist lender used to fast turnarounds.',
        outcome: 'Funding completed in 14 working days, securing the acquisition ahead of a competing buyer.',
        client: 'R. Dawson, Managing Director'
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
