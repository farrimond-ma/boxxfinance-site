import React from 'react';
import { Link } from 'react-router-dom';
import ArticleBody, { CanWeHelp, EndCta } from '../ArticleCtas';
import TableOfContents from './TableOfContents';
import FaqAccordion from './FaqAccordion';
import FundingCards from './FundingCards';
import PopularLocations from './PopularLocations';
import GuidesList from './GuidesList';
import './ResourcePage.css';

const CONTENT_ID = 'resource-article-body';

// The single presentation layer for every generated page — blog articles and
// location pages both render through here. Layout follows the pattern of the
// best-performing broker content sites (single centered readable column,
// hero with image + trust signals, jump-box ToC at the top of the article,
// in-content CTAs, full-width trust/linking sections below, one floating
// CTA). No sidebar — sidebars measurably underperform in-content CTAs.
const ResourcePage = ({
    title,
    heroDescription,
    heroImage,          // per-article generated image, or brand fallback
    service,
    dateLabel,          // pre-formatted "Updated July 2026"
    readingMinutes,
    author,             // { name, title, image, bio, email, linkedIn } | null
    contentHtml,        // article body HTML (may be null while loading)
    faqSchema,          // { mainEntity: [...] } | null
    videoId,            // optional YouTube id (blog only)
    relatedSlug,        // current guide's slug — suppresses self-link in GuidesList
    currentLocationSlug, // suppresses self-link in PopularLocations
}) => {
    const loading = !contentHtml;

    // Title treatment: last two words get the gold highlight
    const words = (title || '').split(' ');
    const titleMain = words.length > 2 ? words.slice(0, -2).join(' ') : '';
    const titleGold = words.length > 2 ? words.slice(-2).join(' ') : title;

    return (
        <div className="resource-page">
            {/* ── Hero: text + image (ABC Finance pattern) ── */}
            <div className="resource-hero">
                <div className="container resource-hero-grid">
                    <div className="resource-hero-text">
                        <h1>
                            {titleMain && <>{titleMain} </>}
                            <span className="text-highlight">{titleGold}</span>
                        </h1>
                        {heroDescription && <p className="resource-hero-lead">{heroDescription}</p>}

                        <ul className="resource-hero-trust" aria-label="Why choose Boxx">
                            <li>Independent broker</li>
                            <li>Whole of market</li>
                            <li>Fast decisions</li>
                        </ul>

                        <div className="resource-hero-actions">
                            <Link to="/chat-about-funding" className="btn btn-primary">Start your enquiry</Link>
                            <a href="tel:03300431612" className="resource-hero-phone">or call 0330 043 1612</a>
                        </div>

                        <div className="resource-hero-meta">
                            {author?.name && <span>By {author.name}</span>}
                            {dateLabel && <span>{dateLabel}</span>}
                            {readingMinutes ? <span>{readingMinutes} min read</span> : null}
                        </div>
                    </div>

                    {heroImage && (
                        <div className="resource-hero-media">
                            <img
                                src={heroImage}
                                alt={title}
                                onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Single centered column ── */}
            <div className="resource-column">
                <div className="resource-main-card">
                    <TableOfContents containerId={CONTENT_ID} ready={!loading} />

                    {loading ? (
                        <div className="resource-skeleton" aria-busy="true" />
                    ) : (
                        <div id={CONTENT_ID} className="blog-post-content">
                            <ArticleBody html={contentHtml} service={service} />
                        </div>
                    )}

                    {videoId && (
                        <div className="resource-video">
                            <div className="video-embed">
                                <iframe
                                    src={`https://www.youtube.com/embed/${videoId}`}
                                    width="100%"
                                    height="100%"
                                    frameBorder="0"
                                    allowFullScreen
                                    loading="lazy"
                                    title="Related video"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {!loading && (
                    <>
                        <CanWeHelp service={service} />
                        <FaqAccordion faqSchema={faqSchema} />
                        <FundingCards currentService={service} />
                        <GuidesList service={service} currentSlug={relatedSlug} />
                        <PopularLocations currentSlug={currentLocationSlug} />

                        {author && (
                            <div className="resource-author">
                                <img src={author.image} alt={author.name} className="resource-author-photo" />
                                <div className="resource-author-info">
                                    <h3>{author.name}</h3>
                                    {author.title && <p className="resource-author-title">{author.title}</p>}
                                    {author.bio && <p className="resource-author-bio">{author.bio}</p>}
                                    <div className="resource-author-links">
                                        {author.email && (
                                            <a href={`mailto:${author.email}`} className="gold-link">{author.email}</a>
                                        )}
                                        <a href="tel:03300431612" className="gold-link">0330 043 1612</a>
                                        {author.linkedIn && (
                                            <a href={author.linkedIn} target="_blank" rel="noopener noreferrer" className="gold-link">
                                                Connect on LinkedIn
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <EndCta />
                    </>
                )}
            </div>

            {/* ── Final CTA band ── */}
            <div className="resource-final-cta">
                <div className="container">
                    <h2>Ready to discuss your funding?</h2>
                    <p>
                        Whether you're purchasing property, refinancing or raising working capital,
                        we'll help you find the right lender for your timescales and objectives.
                    </p>
                    <div className="resource-final-cta-actions">
                        <Link to="/chat-about-funding" className="btn btn-primary">Start your enquiry</Link>
                        <span>or call <a href="tel:03300431612">0330 043 1612</a></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResourcePage;
