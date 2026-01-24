import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title: string;
    description: string;
    canonical?: string;
    name?: string;
    type?: string;
    structuredData?: Record<string, any>;
}

export const SEO: React.FC<SEOProps> = ({
    title,
    description,
    canonical,
    name = 'EvidentlyAEO',
    type = 'website',
    structuredData
}) => {
    return (
        <Helmet>
            {/* Basic metadata */}
            <title>{title}</title>
            <meta name="description" content={description} />

            {/* Canonical URL */}
            {canonical && <link rel="canonical" href={canonical} />}

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            {/* <meta property="og:image" content={image} /> */}

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:creator" content={name} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            {/* <meta name="twitter:image" content={image} /> */}

            {/* Structured Data (JSON-LD) for AEO */}
            {structuredData && (
                <script type="application/ld+json">
                    {JSON.stringify(structuredData)}
                </script>
            )}
        </Helmet>
    );
};
