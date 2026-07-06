import React from 'react';

// React 19 natively hoists <title>, <meta> and <link> rendered anywhere in the
// component tree into <head> (and removes them on unmount), so no helmet
// library is needed. JSON-LD <script> tags render in place, which Google
// parses anywhere in the document.
// (react-helmet-async v2 silently rendered nothing under React 19.)

const SITE_URL = 'https://boxxfinance.co.uk';
const DEFAULT_OG_IMAGE = `${SITE_URL}/header_bg.png`;

const SEO = ({
    title,
    description = "Boxx Commercial Finance arranges tailored business funding across the UK. Commercial mortgages, bridging finance, asset finance, invoice finance and more — structured for growth.",
    keywords,
    name,
    type,
    schema,
    image,
    canonical,
    noIndex = false,
}) => {
    const fullTitle = `${title} | Boxx Commercial Finance`;
    const canonicalUrl = canonical
        ? (canonical.startsWith('http') ? canonical : `${SITE_URL}${canonical}`)
        : `${SITE_URL}${typeof window !== 'undefined' ? (window.location.pathname.replace(/\/$/, '') || '/') : '/'}`;
    const ogImage = image
        ? (image.startsWith('http') ? image : `${SITE_URL}${image}`)
        : DEFAULT_OG_IMAGE;

    const keywordsContent = Array.isArray(keywords) ? keywords.join(', ') : keywords;

    return (
        <>
            {/* Standard metadata */}
            <title>{fullTitle}</title>
            <meta name='description' content={description} />
            {noIndex && <meta name='robots' content='noindex, nofollow' />}
            {keywordsContent && <meta name='keywords' content={keywordsContent} />}
            <link rel='canonical' href={canonicalUrl} />

            {/* Open Graph */}
            <meta property="og:type"        content={type || 'website'} />
            <meta property="og:title"       content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:url"         content={canonicalUrl} />
            <meta property="og:image"       content={ogImage} />
            <meta property="og:site_name"   content="Boxx Commercial Finance" />

            {/* Twitter */}
            <meta name="twitter:card"        content="summary_large_image" />
            <meta name="twitter:creator"     content={name || "Boxx Commercial Finance"} />
            <meta name="twitter:title"       content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image"       content={ogImage} />

            {/* Schema.org — accepts a single object/string or an array of schemas */}
            {schema && (Array.isArray(schema) ? schema : [schema]).map((s, i) => (
                <script
                    key={i}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: typeof s === 'string' ? s : JSON.stringify(s) }}
                />
            ))}
        </>
    );
};

export default SEO;
