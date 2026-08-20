import React from 'react';
import { Link } from 'react-router-dom';
import { serviceCtaTo } from './resource/serviceSlug';

// Conversion blocks injected into article pages at RENDER time (not baked into
// generated content) so every article — existing and future — gets identical,
// centrally-editable CTAs. Copy lives here and nowhere else.

const PHONE_DISPLAY = '01236 702070';
const PHONE_HREF = 'tel:01236702070';

const isBridging = (service) => (service || '').toLowerCase().includes('bridging');

// ── 1. Soft CTA — after the introduction ─────────────────────────────────────
export const SoftCta = ({ service }) => (
    <aside className="article-cta article-cta-soft">
        <h3>Need to move quickly?</h3>
        <p>
            The right funding structure can make the difference between securing an
            opportunity and missing out. Our commercial finance specialists can assess
            your situation and identify lenders who understand it.
        </p>
        <Link to={serviceCtaTo(service)} className="article-cta-link">
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
        <Link to={serviceCtaTo(service)} className="btn btn-primary">
            Start your enquiry
        </Link>
    </aside>
);

// ── 3. End CTA — after the article ───────────────────────────────────────────
export const EndCta = ({ service }) => (
    <aside className="article-cta article-cta-end">
        <h3>Discuss your project</h3>
        <p>
            Every case is different — the choice of lender, structure and exit strategy
            can significantly affect both the cost of borrowing and the outcome. Our
            team works with a wide panel of specialist lenders and will help you secure
            funding that fits your timescales and objectives.
        </p>
        <div className="article-cta-actions">
            <Link to={serviceCtaTo(service)} className="btn btn-primary">
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
        <p>We commonly arrange {isBridging(service) ? 'bridging loans' : 'funding'} for:</p>
        <ul className="can-we-help-grid">
            {(isBridging(service) ? BRIDGING_USES : GENERAL_USES).map((use) => (
                <li key={use}>{use}</li>
            ))}
        </ul>
        <p>
            If your circumstances are different, we can still help.{' '}
            <Link to={serviceCtaTo(service)} className="article-cta-link">
                Tell us what you need &rarr;
            </Link>{' '}
            or explore our <Link to="/funding-solutions" className="article-cta-link">funding solutions</Link>.
        </p>
    </aside>
);

// Every generated article (blog, location, county) is prompted to end with
// its own written-out "Frequently Asked Questions" H2 section, matching the
// separate faqSchema the page also carries — needed so the FAQ is genuinely
// visible on the page, not schema-only (a Google rich-result requirement).
// FaqAccordion (rendered by ResourcePage below the article body) ALSO renders
// that same faqSchema, visibly, as an interactive accordion — so the FAQ has
// been appearing twice on every single page: once as flat inline copy here,
// once again in the accordion. Stripping the inline copy at render time
// (not touching the stored content) makes the accordion the one visible FAQ,
// site-wide, retroactively, without editing hundreds of stored HTML strings.
const stripInlineFaq = (html) =>
    (html || '').replace(/<h2[^>]*>\s*Frequently Asked Questions\s*<\/h2>[\s\S]*$/i, '');

// ── Article body with CTAs injected at section boundaries ────────────────────
// Splits the generated HTML at <h2> headings: soft CTA after the intro,
// mid CTA at the halfway section. Falls back gracefully for short articles.
const ArticleBody = ({ html, service }) => {
    const sections = React.useMemo(() => stripInlineFaq(html).split(/(?=<h2[\s>])/i), [html]);

    if (sections.length < 4) {
        return (
            <>
                <div dangerouslySetInnerHTML={{ __html: sections.join('') }} />
                <MidCta service={service} />
            </>
        );
    }

    const midIndex = Math.ceil((sections.length + 1) / 2);
    return (
        <>
            <div dangerouslySetInnerHTML={{ __html: sections[0] }} />
            <SoftCta service={service} />
            <div dangerouslySetInnerHTML={{ __html: sections.slice(1, midIndex).join('') }} />
            <MidCta service={service} />
            <div dangerouslySetInnerHTML={{ __html: sections.slice(midIndex).join('') }} />
        </>
    );
};

export default ArticleBody;
