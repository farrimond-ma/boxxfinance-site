import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({
    title,
    description = "Boxx Commercial Finance arranges tailored business funding across the UK. Commercial mortgages, bridging finance, asset finance, invoice finance and more — structured for growth.",
    keywords,
    name,
    type,
    schema
}) => {
    return (
        <Helmet>
            {/* Standard metadata tags */}
            <title>{title} | Boxx Commercial Finance</title>
            <meta name='description' content={description} />
            {keywords && <meta name='keywords' content={keywords} />}

            {/* Open Graph tags */}
            <meta property="og:type" content={type || 'website'} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />

            {/* Twitter tags */}
            <meta name="twitter:creator" content={name || "Boxx Commercial Finance"} />
            <meta name="twitter:card" content={type || 'summary'} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />

            {/* Schema.org markup */}
            {schema && (
                <script type="application/ld+json">
                    {typeof schema === 'string' ? schema : JSON.stringify(schema)}
                </script>
            )}
        </Helmet>
    );
};

export default SEO;
