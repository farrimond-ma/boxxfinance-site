import React from 'react';
import { Link } from 'react-router-dom';
import smeData from '../data/smeFundingData.json';
import './SmeFundingIndex.css';

// UK SME Funding Index — rebuilt 2026-07-15 on real Bank of England data.
//
// The previous version of this page generated every figure with Math.random()
// while claiming to aggregate "over 50 UK lenders" and citing the Bank of
// England as a source. It was deleted outright. This rebuild renders ONLY what
// scripts/fetch-sme-index.js pulled from the Bank's Interactive Database, and
// every figure is shown with its series code and observation date.
//
// RULE: never render a number that is not present in smeFundingData.json, and
// never present a stale observation as the current month.

const SITE = 'https://boxxfinance.co.uk';

const byKey = (key) => smeData.series.find((s) => s.key === key) || null;

const fmtMonth = (iso) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
        month: 'short', year: 'numeric', timeZone: 'UTC',
    });

// Direction arrow derived from two real observations — never invented.
const Change = ({ series }) => {
    if (!series || series.changeVsPrevious === null) return null;
    const d = series.changeVsPrevious;
    if (d === 0) return <span className="sme-change flat">no change vs {fmtMonth(series.previous.date)}</span>;
    const up = d > 0;
    return (
        <span className={`sme-change ${up ? 'up' : 'down'}`}>
            {up ? '▲' : '▼'} {Math.abs(d).toFixed(2)} pp vs {fmtMonth(series.previous.date)}
        </span>
    );
};

// Minimal dependency-free line chart of real observations.
const Sparkline = ({ observations, months = 36 }) => {
    const pts = observations.slice(-months);
    if (pts.length < 2) return null;
    const W = 680, H = 180, P = 28;
    const vals = pts.map((p) => p.value);
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const x = (i) => P + (i * (W - P * 2)) / (pts.length - 1);
    const y = (v) => H - P - ((v - min) / span) * (H - P * 2);
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

    return (
        <figure className="sme-chart">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" width="100%">
                <title>Effective interest rate on new loans to UK SMEs, last {pts.length} months</title>
                <desc>
                    Bank of England series {smeData.series.find((s) => s.headline)?.code}. Ranges from {min.toFixed(2)}% to {max.toFixed(2)}%
                    between {fmtMonth(pts[0].date)} and {fmtMonth(pts[pts.length - 1].date)}.
                </desc>
                <line x1={P} y1={H - P} x2={W - P} y2={H - P} className="sme-axis" />
                <path d={d} className="sme-line" fill="none" />
                <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].value)} r="4" className="sme-dot" />
                <text x={P} y={y(max) - 8} className="sme-tick">{max.toFixed(2)}%</text>
                <text x={P} y={y(min) + 16} className="sme-tick">{min.toFixed(2)}%</text>
                <text x={P} y={H - 8} className="sme-tick">{fmtMonth(pts[0].date)}</text>
                <text x={W - P} y={H - 8} className="sme-tick" textAnchor="end">{fmtMonth(pts[pts.length - 1].date)}</text>
            </svg>
            <figcaption>
                Effective interest rate on new loans to UK SMEs, {fmtMonth(pts[0].date)} – {fmtMonth(pts[pts.length - 1].date)}.
                Source: Bank of England series {smeData.series.find((s) => s.headline)?.code}.
            </figcaption>
        </figure>
    );
};

const SmeFundingIndex = () => {
    const headline = byKey('smeNewLoanRate');
    const bankRate = byKey('bankRate');
    const breakdown = ['smeNewLoanFloating', 'smeNewLoanBankRateLinked', 'smeNewLoanFixed']
        .map(byKey)
        .filter(Boolean);

    // Spread over Bank Rate is arithmetic on two real observations, not a claim.
    const spread =
        headline && bankRate ? Number((headline.latest.value - bankRate.latest.value).toFixed(2)) : null;

    const title = 'UK SME Funding Index | Bank of England SME Lending Rates';
    const description = `The effective interest rate on new loans to UK SMEs was ${headline.latest.value}% in ${smeData.dataAsOfLabel}, per Bank of England data. Updated monthly by Boxx Commercial Finance.`;

    // Dataset schema with explicit attribution, so machines cite the Bank as the
    // source of the figures and Boxx as the publisher of the summary.
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: 'UK SME Funding Index',
        description,
        url: `${SITE}/uk-sme-funding-index`,
        temporalCoverage: `${headline.observations[0].date}/${headline.latest.date}`,
        dateModified: smeData.retrievedAt,
        license: smeData.source.licenceUrl,
        isBasedOn: { '@type': 'Dataset', name: smeData.source.name, url: smeData.source.url },
        creator: { '@type': 'Organization', name: 'Boxx Commercial Finance', url: SITE },
        sourceOrganization: { '@type': 'Organization', name: 'Bank of England', url: 'https://www.bankofengland.co.uk' },
        variableMeasured: smeData.series.map((s) => ({
            '@type': 'PropertyValue',
            name: s.label,
            value: s.latest.value,
            unitText: 'percent',
            measurementTechnique: `Bank of England IADB series ${s.code}`,
            observationDate: s.latest.date,
        })),
    };

    return (
        <div className="sme-page">
            <title>{title}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={`${SITE}/uk-sme-funding-index`} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

            <header className="sme-hero">
                <div className="container">
                    <h1>UK SME Funding <span className="text-highlight">Index</span></h1>
                    <p className="sme-sub">
                        What UK small and medium-sized businesses actually pay to borrow — taken directly from
                        Bank of England published statistics, not our own estimates.
                    </p>
                    <p className="sme-asof">
                        Latest available data: <strong>{smeData.dataAsOfLabel}</strong>. The Bank of England
                        publishes effective interest rates in arrears, so this is the most recent month released —
                        not the current month.
                    </p>
                </div>
            </header>

            <div className="container sme-body">
                <section className="sme-section">
                    <div className="sme-stats">
                        <div className="sme-stat headline">
                            <span className="sme-stat-label">Effective rate on new SME loans</span>
                            <span className="sme-stat-value">{headline.latest.value}%</span>
                            <Change series={headline} />
                            <span className="sme-stat-src">
                                BoE series {headline.code} · {fmtMonth(headline.latest.date)}
                            </span>
                        </div>
                        <div className="sme-stat">
                            <span className="sme-stat-label">Official Bank Rate</span>
                            <span className="sme-stat-value">{bankRate.latest.value}%</span>
                            <Change series={bankRate} />
                            <span className="sme-stat-src">
                                BoE series {bankRate.code} · {fmtMonth(bankRate.latest.date)}
                            </span>
                        </div>
                        <div className="sme-stat">
                            <span className="sme-stat-label">Spread over Bank Rate</span>
                            <span className="sme-stat-value">{spread} pp</span>
                            <span className="sme-change flat">calculated from the two figures shown</span>
                            <span className="sme-stat-src">
                                {headline.latest.value}% − {bankRate.latest.value}%
                            </span>
                        </div>
                    </div>
                </section>

                <section className="sme-section">
                    <h2>The trend</h2>
                    <Sparkline observations={headline.observations} />
                </section>

                <section className="sme-section">
                    <h2>How new SME lending breaks down</h2>
                    <p>
                        The Bank reports the headline SME rate alongside its components. Fixed-rate borrowing is
                        priced separately from floating-rate borrowing, which is why the figures differ.
                    </p>
                    <div className="sme-table-wrap">
                        <table className="sme-table">
                            <thead>
                                <tr>
                                    <th>Measure</th>
                                    <th>Rate</th>
                                    <th>As of</th>
                                    <th>BoE series</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[headline, ...breakdown].map((s) => (
                                    <tr key={s.code} className={s.headline ? 'is-headline' : ''}>
                                        <td>
                                            {s.label}
                                            <span className="sme-note">{s.note}</span>
                                        </td>
                                        <td className="num">{s.latest.value}%</td>
                                        <td className="num">{fmtMonth(s.latest.date)}</td>
                                        <td className="num"><code>{s.code}</code></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="sme-section">
                    <h2>What this means if you're borrowing</h2>
                    <p>
                        The headline figure is an <em>average across all reporting lenders</em>. It is a useful
                        benchmark for judging whether a quote you have been given is competitive, but it is not a
                        rate you can apply for. Your actual rate depends on security, term, sector, trading history
                        and the lender's appetite on the day.
                    </p>
                    <p>
                        Bridging and other short-term property lending is priced very differently from the term
                        lending captured here — typically monthly rather than annually — so this index is not a
                        guide to <Link to="/funding-solutions/bridging-loans">bridging loan</Link> pricing.
                    </p>
                    <p>
                        If you want to know what your business would actually be offered,{' '}
                        <Link to="/chat-about-funding">talk to us about your funding requirements</Link> and we will
                        compare the whole market for you.
                    </p>
                </section>

                <section className="sme-section sme-methodology">
                    <h2>Methodology &amp; data sources</h2>
                    <p>
                        Every figure on this page is pulled directly from the{' '}
                        <a href={smeData.source.url} target="_blank" rel="noopener noreferrer">
                            {smeData.source.name}
                        </a>{' '}
                        by an automated job, and is shown with the Bank's own series code and observation date so it
                        can be checked at source. Boxx Commercial Finance does not estimate, model or adjust any of
                        these numbers.
                    </p>
                    <p>{smeData.definition}</p>
                    <p>
                        The Bank publishes effective interest rates in arrears. The most recent month available at
                        the time of writing is <strong>{smeData.dataAsOfLabel}</strong>; data was last retrieved on{' '}
                        {new Date(smeData.retrievedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                    </p>
                    <p className="sme-series-list">
                        Series used:{' '}
                        {smeData.series.map((s, i) => (
                            <React.Fragment key={s.code}>
                                {i > 0 && ', '}
                                <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer"><code>{s.code}</code></a>
                            </React.Fragment>
                        ))}
                        .
                    </p>
                    <p className="sme-licence">{smeData.source.licence} —{' '}
                        <a href={smeData.source.licenceUrl} target="_blank" rel="noopener noreferrer">OGL v3.0</a>.
                    </p>
                    <p className="sme-disclaimer">
                        <em>
                            These are published market averages for information only. They are not a quote, not an
                            offer of finance, and not a prediction of the rate available to any individual business.
                            Boxx Commercial Finance is a commercial finance broker, not a lender.
                        </em>
                    </p>
                </section>
            </div>
        </div>
    );
};

export default SmeFundingIndex;
