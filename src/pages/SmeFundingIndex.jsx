import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams, useNavigate } from 'react-router-dom';
import smeFundingData from '../data/smeFundingData.json';
import './SmeFundingIndex.css';

const SmeFundingIndex = () => {
    const { archiveSlug } = useParams();
    const navigate = useNavigate();
    const [currentData, setCurrentData] = useState(smeFundingData[0]); // Default to latest
    const [isArchive, setIsArchive] = useState(false);

    useEffect(() => {
        if (archiveSlug) {
            const foundData = smeFundingData.find(item => item.slug === archiveSlug);
            if (foundData) {
                setCurrentData(foundData);
                setIsArchive(true);
            } else {
                // Redirect to main index if archive slug doesn't exist
                navigate('/uk-sme-funding-index');
            }
        } else {
            setCurrentData(smeFundingData[0]); // Always show the latest data on the main route
            setIsArchive(false);
        }
    }, [archiveSlug, navigate]);

    const handleArchiveChange = (e) => {
        const selectedSlug = e.target.value;
        if (selectedSlug === 'latest') {
            navigate('/uk-sme-funding-index');
        } else {
            navigate(`/uk-sme-funding-index/${selectedSlug}`);
        }
    };

    const lastUpdated = currentData.monthYear;


    // Structured Data for SEO
    const structuredData = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Article",
                "headline": "UK SME Funding Index | Business Loan & Asset Finance Rates",
                "description": "Live UK SME funding data including business loan rates, asset finance trends and approval statistics — updated monthly.",
                "image": "https://www.boxxfinance.co.uk/images/og/sme-index.jpg",
                "author": {
                    "@type": "Person",
                    "name": "Mark Farrimond",
                    "url": "https://www.boxxfinance.co.uk/about"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "Boxx Commercial Finance",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://www.boxxfinance.co.uk/logo.webp"
                    }
                },
                "datePublished": "2026-01-01",
                "dateModified": new Date().toISOString()
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": "What is the average SME loan interest rate in the UK?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "The average interest rate for an unsecured SME loan in the UK typically ranges between 9% and 15%, depending on credit profile, trading history and lender risk appetite. Secured loans and asset-backed facilities often carry lower rates, typically between 6% and 10%."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Why are SME business loans rejected?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Common reasons include declining or inconsistent revenue, poor director credit history, high existing debt levels, insufficient security, or sector risk (e.g. hospitality volatility)."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "What should I do if my business loan application is declined?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Request detailed feedback, review your financial statements, consider asset-backed funding options, and explore refinance or restructuring solutions. Many businesses secure funding successfully on a second application with a specialist broker."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "Are asset finance rates lower than unsecured business loans?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "In most cases, yes. Asset finance facilities are typically priced lower than unsecured loans because the lender has security over the asset being financed."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "How often is the UK SME Funding Index updated?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "The UK SME Funding Index is updated monthly to reflect changes in lender appetite, interest rate movements and sector funding trends."
                        }
                    }
                ]
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://www.boxxfinance.co.uk/"
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "UK SME Funding Index",
                        "item": "https://www.boxxfinance.co.uk/uk-sme-funding-index/"
                    }
                ]
            }
        ]
    };

    return (
        <div className="sme-index-page">
            <Helmet>
                <title>{isArchive ? `UK SME Funding Index - ${lastUpdated} Archive` : 'UK SME Funding Index | Business Loan & Asset Finance Rates'}</title>
                <meta name="description" content={`UK SME funding data for ${lastUpdated}: business loan rates, asset finance trends, approval statistics by Boxx Commercial Finance.`} />
                <meta name="keywords" content="SME funding index UK, business loan rates, asset finance trends, SME lending statistics, UK business finance data" />
                <link rel="canonical" href={`https://www.boxxfinance.co.uk/uk-sme-funding-index${isArchive ? `/${currentData.slug}` : ''}`} />
                <script type="application/ld+json">
                    {JSON.stringify(structuredData)}
                </script>
            </Helmet>

            {/* Hero Section */}
            <header className="sme-index-hero">
                <div className="container">
                    <h1>{isArchive ? `UK SME Funding Index: ${lastUpdated}` : 'UK SME Funding Index'}</h1>
                    <p className="lead">The definitive guide to UK business lending rates, approval trends, and market insights.</p>
                    <div className="index-meta-controls">
                        <div className="last-updated">
                            {isArchive ? (
                                <span className="archive-badge">Historical Archive: {lastUpdated}</span>
                            ) : (
                                <span>Live Data: {lastUpdated}</span>
                            )}
                        </div>
                        <div className="archive-selector">
                            <label htmlFor="archive-dropdown">View Historical Data:</label>
                            <select
                                id="archive-dropdown"
                                value={isArchive ? currentData.slug : 'latest'}
                                onChange={handleArchiveChange}
                                className="archive-dropdown"
                            >
                                <option value="latest">Latest Report</option>
                                <optgroup label="Archives">
                                    {smeFundingData.map((item, index) => {
                                        // Skip the first item as it's the 'latest'
                                        if (index === 0) return null;
                                        return (
                                            <option key={item.slug} value={item.slug}>
                                                {item.monthYear}
                                            </option>
                                        );
                                    })}
                                </optgroup>
                            </select>
                        </div>
                    </div>
                    {isArchive && (
                        <div className="archive-notice" style={{ marginTop: '15px', color: '#ffb347', fontSize: '0.9rem' }}>
                            Note: You are viewing an archived report. Rates and figures shown reflect market conditions during {lastUpdated} and may not represent current funding availability. <Link style={{ color: '#fff', textDecoration: 'underline' }} to="/uk-sme-funding-index">View the latest report here.</Link>
                        </div>
                    )}
                </div>
            </header>

            <div className="container">

                {/* 1. Live Snapshot – UK SME Funding Overview */}
                <section className="sme-section">
                    <h2>Live Snapshot – UK SME Funding Overview</h2>
                    <p>Current market conditions show a stabilisation in base rates, with increased lender appetite for secured asset finance. Below represents the current pulse of the UK SME lending market.</p>

                    <div className="snapshot-grid">
                        <div className="stat-card">
                            <span className="stat-label">Avg. Unsecured Rate</span>
                            <span className="stat-value">{currentData.unsecuredRate}</span>
                            <span className={`stat-change ${currentData.unsecuredRateChange.includes('▼') ? 'negative' : 'positive'}`}>
                                {currentData.unsecuredRateChange}
                            </span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Approval Rate (Specialist)</span>
                            <span className="stat-value">{currentData.approvalRate}</span>
                            <span className={`stat-change ${currentData.approvalRateChange.includes('▼') ? 'negative' : 'positive'}`}>
                                {currentData.approvalRateChange}
                            </span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Asset Finance Volume</span>
                            <span className="stat-value">{currentData.assetFinanceVolume}</span>
                            <span className={`stat-change ${currentData.assetFinanceVolumeChange.includes('▼') ? 'negative' : 'positive'}`}>
                                {currentData.assetFinanceVolumeChange}
                            </span>
                        </div>
                    </div>
                </section>

                {/* 2. Average Business Loan Rates in the UK */}
                <section className="sme-section">
                    <h2>Average Business Loan Rates in the UK</h2>
                    <p>Interest rates vary significantly based on security, trading history, and sector. High street banks offer the lowest rates but with the strictest criteria.</p>

                    <h3>Unsecured vs Secured Loan Rates</h3>
                    <div className="data-table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Product Type</th>
                                    <th>Interest Rate Range</th>
                                    <th>Typical Term</th>
                                    <th>Decision Speed</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>High Street Bank Loan (Secured)</td>
                                    <td className="rate-cell">{currentData.rates.highStreetSecured}</td>
                                    <td>1 - 10 Years</td>
                                    <td>2 - 4 Weeks</td>
                                </tr>
                                <tr>
                                    <td>Challenger Bank Loan (Unsecured)</td>
                                    <td className="rate-cell">{currentData.rates.challengerUnsecured}</td>
                                    <td>1 - 5 Years</td>
                                    <td>2 - 5 Days</td>
                                </tr>
                                <tr>
                                    <td>Alternative Lender (Unsecured)</td>
                                    <td className="rate-cell">{currentData.rates.alternativeUnsecured}</td>
                                    <td>6 Months - 3 Years</td>
                                    <td>24 - 48 Hours</td>
                                </tr>
                                <tr>
                                    <td><Link to="/funding-solutions/commercial-mortgages">Commercial Mortgage</Link></td>
                                    <td className="rate-cell">{currentData.rates.commercialMortgage}</td>
                                    <td>5 - 25 Years</td>
                                    <td>4 - 8 Weeks</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <h3>Short-Term vs Long-Term Funding Costs</h3>
                    <p>Short-term liquidity solutions generally carry a higher annualized percentage rate (APR) but offer speed and flexibility, crucial for seizing immediate opportunities or managing <Link to="/funding-solutions/working-capital">working capital</Link> gaps.</p>
                </section>

                {/* 3. Asset Finance Rates by Industry */}
                <section className="sme-section">
                    <h2>Asset Finance Rates by Industry</h2>
                    <p>Asset finance remains one of the most cost-effective ways to fund growth. Rates are heavily influenced by the resale value (residual stickiness) of the asset.</p>

                    <div className="chart-container">
                        <div className="bar-chart">
                            <div className="bar-item">
                                <span className="bar-label">Construction & Plant</span>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: '92%' }}>Low Risk (Tier 1 Rates)</div>
                                </div>
                            </div>
                            <div className="bar-item">
                                <span className="bar-label">Transport & Logistics</span>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: '88%' }}>Low-Med Risk</div>
                                </div>
                            </div>
                            <div className="bar-item">
                                <span className="bar-label">Manufacturing</span>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: '85%' }}>Medium Risk</div>
                                </div>
                            </div>
                            <div className="bar-item">
                                <span className="bar-label">Technology & IT</span>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: '65%' }}>Higher Depreciation Risk</div>
                                </div>
                            </div>
                            <div className="bar-item">
                                <span className="bar-label">Hospitality Fit-out</span>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: '55%' }}>Review Required</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p>For a detailed breakdown of equipment funding options, visit our <Link to="/funding-solutions/asset-finance">asset finance solutions</Link> page.</p>
                </section>

                {/* 4. SME Loan Approval & Rejection Statistics */}
                <section className="sme-section">
                    <h2>SME Loan Approval & Rejection Statistics</h2>
                    <div className="data-split">
                        <div>
                            <h3>UK First-Time Approval Rates</h3>
                            <p>Recent data indicates that nearly 40% of first-time applications to high street banks are declined. However, the alternative lending market approves over 65% of viable applications.</p>

                            <h3>Common Reasons for Business Loan Rejection</h3>
                            <ul className="styled-list">
                                <li><strong>Poor Credit History:</strong> Defaults or CCJs against the business or directors.</li>
                                <li><strong>Lack of Security:</strong> Insufficient assets to secure the loan.</li>
                                <li><strong>Sector Risk:</strong> High-risk industries (e.g., hospitality) face stricter criteria.</li>
                                <li><strong>Weak Cash Flow:</strong> Inability to demonstrate serviceability of the debt.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* 5. Regional SME Funding Trends */}
                <section className="sme-section">
                    <h2>Regional SME Funding Trends</h2>
                    <div className="regional-grid">
                        <div className="region-card">
                            <h3>London & South East</h3>
                            <p><strong>Trend:</strong> High uptake in Tech and Fintech funding. Invoice finance demand increasing due to extended payment terms from large corporates.</p>
                        </div>
                        <div className="region-card">
                            <h3>North West & Midlands</h3>
                            <p><strong>Trend:</strong> Strong manufacturing and industrial asset finance growth. Construction finance remains resilient despite broader market slowdowns.</p>
                        </div>
                        <div className="region-card">
                            <h3>Scotland & North</h3>
                            <p><strong>Trend:</strong> Energy sector supply chain funding rising. Renewable energy asset finance seeing double-digit growth.</p>
                        </div>
                    </div>
                </section>

                {/* 6. Monthly SME Market Commentary */}
                <section className="sme-section">
                    <h2>Monthly SME Market Commentary</h2>
                    <div className="commentary-box">
                        <p>{currentData.commentary}</p>
                    </div>
                </section>

                {/* 7. What To Do If Your Business Loan Is Rejected */}
                <section className="sme-section">
                    <h2>What To Do If Your Business Loan Is Rejected</h2>
                    <p>A rejection from a bank is not the end of the road. It usually means you didn't fit that specific lender's rigid criteria.</p>

                    <ol className="rejection-guide-steps">
                        <li><strong>Diagnose the Reason:</strong> Ask the lender for specific details on the decline.</li>
                        <li><strong>Review Your Credit File:</strong> Check for errors or outdated information on your business credit report.</li>
                        <li><strong>Consider Asset-Backed Options:</strong> Leveraging assets often bypasses standard credit scoring.</li>
                        <li><strong>Explore Specialists:</strong> Niche lenders often understand sector-specific risks better than generalists.</li>
                        <li><strong>Consult a Broker:</strong> We can match your profile to the right lender.</li>
                    </ol>

                    <div className="cta-box">
                        <p>Need to discuss your options? <Link to="/chat-about-funding">Talk to a funding specialist today</Link>.</p>
                    </div>
                </section>

                {/* 8. FAQ Section */}
                <section className="sme-section">
                    <h2>Frequently Asked Questions About UK SME Funding</h2>

                    <div className="sme-faq-item">
                        <h3>What is the average SME loan interest rate in the UK?</h3>
                        <p>The average interest rate for an <Link to="/funding-solutions/business-loans">unsecured SME loan</Link> in the UK typically ranges between 9% and 15%, depending on credit profile, trading history and lender risk appetite. Secured loans and asset-backed facilities often carry lower rates, typically between 6% and 10%, as they provide lenders with additional security.</p>
                        <p>Rates vary significantly depending on sector, financial performance and the type of funding facility used.</p>
                    </div>

                    <div className="sme-faq-item">
                        <h3>Why are SME business loans rejected?</h3>
                        <p>Common reasons for SME loan rejection in the UK include:</p>
                        <ul>
                            <li>Declining or inconsistent revenue</li>
                            <li>Poor director credit history</li>
                            <li>High existing debt levels</li>
                            <li>Insufficient security for larger facilities</li>
                            <li>Sector risk (e.g. hospitality volatility)</li>
                        </ul>
                        <p>Working with a specialist broker can improve approval chances by presenting applications strategically and exploring alternative funding structures.</p>
                    </div>

                    <div className="sme-faq-item">
                        <h3>What should I do if my business loan application is declined?</h3>
                        <p>If your loan application is declined, you should:</p>
                        <ul>
                            <li>Request detailed feedback from the lender</li>
                            <li>Review your financial statements and cash flow forecasts</li>
                            <li>Consider <Link to="/funding-solutions/asset-finance">asset-backed funding options</Link></li>
                            <li>Explore <Link to="/funding-solutions/asset-refinance">refinance</Link> or restructuring solutions</li>
                            <li>Seek guidance from a commercial finance broker</li>
                        </ul>
                        <p>Many businesses secure funding successfully on a second application once adjustments are made.</p>
                    </div>

                    <div className="sme-faq-item">
                        <h3>Are asset finance rates lower than unsecured business loans?</h3>
                        <p>In most cases, yes. <Link to="/funding-solutions/asset-finance">Asset finance facilities</Link> such as hire purchase or equipment finance are typically priced lower than unsecured loans because the lender has security over the asset being financed. This reduces lender risk and can improve approval likelihood.</p>
                    </div>

                    <div className="sme-faq-item">
                        <h3>How often is the UK SME Funding Index updated?</h3>
                        <p>The UK SME Funding Index is updated monthly to reflect changes in lender appetite, interest rate movements and sector funding trends. Commentary is revised regularly to reflect market developments.</p>
                    </div>
                </section>

                {/* 9. Methodology & Data Sources */}
                <section className="sme-section">
                    <h2>Methodology & Data Sources</h2>
                    <p>This index aggregates data from over 50 UK lenders, including high street banks, challenger banks, and alternative finance providers.</p>
                    <p>Rates and approval statistics are based on anonymized application data and publicly available lender indices, including the <a href="https://www.bankofengland.co.uk/statistics" target="_blank" rel="noopener noreferrer">Bank of England</a> and <a href="https://www.ukfinance.org.uk/" target="_blank" rel="noopener noreferrer">UK Finance</a>.</p>
                    <p><em>Disclaimer: All rates and figures are for indicative purposes only and subject to status, credit check, and business performance.</em></p>
                </section>

                {/* Author Bio */}
                <div className="author-bio">
                    <img src="/andrew-farrimond.webp" alt="Andrew Farrimond — Managing Partner, Boxx Commercial Finance" className="author-img" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none' }} />
                    <div className="author-info">
                        <h4>Andrew Farrimond</h4>
                        <span className="author-role">Managing Partner, Commercial Finance</span>
                        <p>Andrew is a commercial finance specialist with extensive experience helping UK SMEs access the right funding. He leads on invoice finance, asset finance and working capital solutions, and is happy to discuss any funding requirements directly.</p>
                        <p><a href="mailto:andrew@boxxfinance.co.uk" style={{ color: 'var(--color-secondary)' }}>andrew@boxxfinance.co.uk</a></p>
                    </div>
                </div>

                {/* Press Enquiries */}

            </div>
        </div>
    );
};

export default SmeFundingIndex;
