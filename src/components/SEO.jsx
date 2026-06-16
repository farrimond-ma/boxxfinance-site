import React from 'react';
import { Helmet } from 'react-helmet-async';

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

    return (
        <Helmet>
            {/* Standard metadata */}
            <title>{fullTitle}</title>
            <meta name='description' content={description} />
            {noIndex && <meta name='robots' content='noindex, nofollow' />}
            {keywords && <meta name='keywords' content={keywords} />}
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
                <script key={i} type="application/ld+json">
                    {typeof s === 'string' ? s : JSON.stringify(s)}
                </script>
            ))}
        </Helmet>
    );
};

export default SEO;
