import React from 'react';
import { Link } from 'react-router-dom';

// Conversion blocks injected into article pages at RENDER time (not baked into
// generated content) so every article — existing and future — gets identical,
// centrally-editable CTAs. Copy lives here and nowhere else.

const PHONE_DISPLAY = '0330 043 1612';
const PHONE_HREF = 'tel:03300431612';

const isBridging = (service) => (service || '').toLowerCase().includes('bridging');

// ── 1. Soft CTA — after the introduction ─────────────────────────────────────
export const SoftCta = () => (
    <aside className="article-cta article-cta-soft">
        <h3>Need to move quickly?</h3>
        <p>
            The right funding structure can make the difference between securing an
            opportunity and missing out. Our commercial finance specialists can assess
            your situation and identify lenders who understand it.
        </p>
        <Link to="/chat-about-funding" className="article-cta-link">
            Talk to an expert today &rarr;
        </Link>
    </aside>
);

// ── 2. Mid-article CTA — around the halfway point ────────────────────────────
export const MidCta = ({ service }) => (
    <aside className="article-cta article-cta-mid">
        <h3>{isBridging(service) ? 'Considering a bridging loan?' : 'Looking at your funding options?'}</h3>
        <p>
            Whether you're purchasing property, releasing capital or funding growth,
            we can help structure the right solution for your timescales.
        </p>
        <ul className="article-cta-ticks">
            <li>Whole-of-market access to specialist lenders</li>
            <li>Terms structured around your exit strategy</li>
            <li>Decisions in days, not weeks</li>
        </ul>
        <Link to="/chat-about-funding" className="btn btn-primary">
            Start your enquiry
        </Link>
    </aside>
);

// ── 3. End CTA — after the article ───────────────────────────────────────────
export const EndCta = () => (
    <aside className="article-cta article-cta-end">
        <h3>Discuss your project</h3>
        <p>
            Every case is different — the choice of lender, structure and exit strategy
            can significantly affect both the cost of borrowing and the outcome. Our
            team works with a wide panel of specialist lenders and will help you secure
            funding that fits your timescales and objectives.
        </p>
        <div className="article-cta-actions">
            <Link to="/chat-about-funding" className="btn btn-primary">
                Start your enquiry
            </Link>
            <span className="article-cta-or">
                or call <a href={PHONE_HREF}>{PHONE_DISPLAY}</a>
            </span>
        </div>
    </aside>
);

// ── "Can we help?" box ───────────────────────────────────────────────────────
const BRIDGING_USES = [
    'Land purchases with planning potential',
    'Auction acquisitions',
    'Commercial-to-residential conversions',
    'Development exit finance',
    'Chain break funding',
    'Refurbishment projects',
];

const GENERAL_USES = [
    'Property purchases and refinancing',
    'Working capital and cashflow',
    'Asset and equipment funding',
    'Invoice and trade finance',
    'Development and refurbishment projects',
    'Management buyouts and acquisitions',
];

export const CanWeHelp = ({ service }) => (
    <aside className="article-cta can-we-help">
        <h3>Is this suitable for your situation?</h3>
        <p>We commonly arrange {isBridging(service) ? 'bridging finance' : 'funding'} for:</p>
        <ul className="can-we-help-grid">
            {(isBridging(service) ? BRIDGING_USES : GENERAL_USES).map((use) => (
                <li key={use}>{use}</li>
            ))}
        </ul>
        <p>
            If your circumstances are different, we can still help.{' '}
            <Link to="/chat-about-funding" className="article-cta-link">
                Speak to a specialist &rarr;
            </Link>{' '}
            or explore our <Link to="/funding-solutions" className="article-cta-link">funding solutions</Link>.
        </p>
    </aside>
);

// ── Article body with CTAs injected at section boundaries ────────────────────
// Splits the generated HTML at <h2> headings: soft CTA after the intro,
// mid CTA at the halfway section. Falls back gracefully for short articles.
const ArticleBody = ({ html, service }) => {
    const sections = React.useMemo(() => (html || '').split(/(?=<h2[\s>])/i), [html]);

    if (sections.length < 4) {
        return (
            <>
                <div dangerouslySetInnerHTML={{ __html: html }} />
                <MidCta service={service} />
            </>
        );
    }

    const midIndex = Math.ceil((sections.length + 1) / 2);
    return (
        <>
            <div dangerouslySetInnerHTML={{ __html: sections[0] }} />
            <SoftCta />
            <div dangerouslySetInnerHTML={{ __html: sections.slice(1, midIndex).join('') }} />
            <MidCta service={service} />
            <div dangerouslySetInnerHTML={{ __html: sections.slice(midIndex).join('') }} />
        </>
    );
};

export default ArticleBody;
