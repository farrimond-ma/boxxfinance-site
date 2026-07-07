import React from 'react';
import { Link } from 'react-router-dom';
import ArticleBody, { CanWeHelp, EndCta } from '../ArticleCtas';
import TableOfContents from './TableOfContents';
import FaqAccordion from './FaqAccordion';
import ResourceSidebar from './ResourceSidebar';
import FundingCards from './FundingCards';
import './ResourcePage.css';

const CONTENT_ID = 'resource-article-body';

// The single presentation layer for every generated page — blog articles and
// location pages both render through here (ChatGPT's ResourcePage idea). The
// data differs; the skeleton, CTAs, internal linking, schema hooks and trust
// blocks stay identical, so every content type feels cohesive and future
// layout changes land everywhere at once.
const ResourcePage = ({
    title,
    heroDescription,
    service,
    date,
    dateLabel,          // pre-formatted "Updated July 2026"
    readingMinutes,
    author,             // { name, title, image, bio, email, linkedIn } | null
    contentHtml,        // article body HTML (may be null while loading)
    faqSchema,          // { mainEntity: [...] } | null
    videoId,            // optional YouTube id (blog only)
    relatedSlug,        // slug passed to RelatedArticles
    RelatedArticles,    // component injected by the caller
}) => {
    const loading = !contentHtml;

    // Title treatment: last two words get the gold highlight
    const words = (title || '').split(' ');
    const titleMain = words.length > 2 ? words.slice(0, -2).join(' ') : '';
    const titleGold = words.length > 2 ? words.slice(-2).join(' ') : title;

    return (
        <div className="resource-page">
            {/* ── Hero ── */}
            <div className="resource-hero">
                <div className="container">
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
                        <div className="resource-hero-meta">
                            {author?.name && <span>By {author.name}</span>}
                            {dateLabel && <span>{dateLabel}</span>}
                            {readingMinutes ? <span>{readingMinutes} min read</span> : null}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Body: ToC · content · sidebar ── */}
            <div className="container resource-layout">
                <div className="resource-toc-col">
                    <TableOfContents containerId={CONTENT_ID} ready={!loading} />
                </div>

                <div className="resource-main">
                    <div className="resource-main-card">
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
                            <FundingCards currentService={service} />
                            <FaqAccordion faqSchema={faqSchema} />
                            <EndCta />

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

                            {RelatedArticles && relatedSlug && <RelatedArticles currentSlug={relatedSlug} />}
                        </>
                    )}
                </div>

                <div className="resource-sidebar-col">
                    <ResourceSidebar />
                </div>
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
