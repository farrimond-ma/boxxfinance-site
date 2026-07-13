import React from 'react';
import ArticleBody, { CanWeHelp, EndCta } from '../ArticleCtas';
import { ResourceHero, FinalCtaBand, FloatingCta } from './ResourceHero';
import { serviceCtaTo } from './serviceSlug';
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
    author,             // { name, title, image, bio, email, linkedIn } | null — author card only
    contentHtml,        // article body HTML (may be null while loading)
    faqSchema,          // { mainEntity: [...] } | null
    videoId,            // optional YouTube id (blog only)
    relatedSlug,        // current guide's slug — suppresses self-link in GuidesList
    currentLocationSlug, // suppresses self-link in PopularLocations
}) => {
    const loading = !contentHtml;
    // Every CTA on the page routes to this service's own enquiry form (not
    // the generic form) so the visitor's context carries through.
    const ctaTo = serviceCtaTo(service);

    return (
        <div className="resource-page">
            <ResourceHero title={title} description={heroDescription} heroImage={heroImage} primaryCtaTo={ctaTo} />

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

                        <EndCta service={service} />
                    </>
                )}
            </div>

            <FinalCtaBand ctaTo={ctaTo} />
            <FloatingCta ctaTo={ctaTo} />
        </div>
    );
};

export default ResourcePage;
