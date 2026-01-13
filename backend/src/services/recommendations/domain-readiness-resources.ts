/**
 * Domain Readiness Test Resources
 * 
 * Maps each test to how-to-fix instructions for recommendations.
 * This is used to include actionable fix steps in domain readiness recommendations.
 */

export interface TestResourceInfo {
    learnMoreUrl: string;
    howToFix: string[];
}

export const TEST_RESOURCES: Record<string, TestResourceInfo> = {
    // Technical Crawlability
    'HTTPS Availability': {
        learnMoreUrl: 'https://web.dev/why-https-matters/',
        howToFix: [
            'Purchase an SSL certificate from your hosting provider',
            "Use Let's Encrypt for free SSL certificates",
            'Update all internal links to use https://',
            'Set up 301 redirects from HTTP to HTTPS'
        ]
    },
    'HTTP Status': {
        learnMoreUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status',
        howToFix: [
            'Check server configuration for errors',
            'Verify DNS settings are correct',
            'Ensure your hosting service is active',
            'Check for broken server-side code'
        ]
    },
    'Robots.txt Availability': {
        learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
        howToFix: [
            'Create a robots.txt file in your site root',
            'Add basic User-agent rules',
            'Test using Google Search Console',
            'Ensure file is accessible at /robots.txt'
        ]
    },
    'Robots.txt Valid Content': {
        learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt',
        howToFix: [
            'Add User-agent: * directive',
            'Specify Allow/Disallow rules',
            'Include Sitemap declaration',
            'Validate syntax using online tools'
        ]
    },
    'Sitemap Declaration': {
        learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap',
        howToFix: [
            'Add Sitemap: https://yourdomain.com/sitemap.xml to robots.txt',
            'Generate sitemap using tools or CMS plugins',
            'Submit sitemap to Google Search Console'
        ]
    },
    'Sitemap Availability': {
        learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview',
        howToFix: [
            'Generate XML sitemap of all important pages',
            'Place sitemap.xml at website root',
            'Ensure sitemap is under 50MB and has <50,000 URLs',
            'Update sitemap regularly as content changes'
        ]
    },
    'Sitemap Size': {
        learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap',
        howToFix: [
            'Add URLs to your sitemap',
            'Use sitemap index files for large sites',
            'Include lastmod dates for each URL',
            'Prioritize important pages'
        ]
    },
    'Canonical Tag': {
        learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
        howToFix: [
            'Add <link rel="canonical" href="https://yourdomain.com/page"> to <head>',
            'Ensure canonical URL is self-referencing or points to preferred version',
            'Use absolute URLs, not relative',
            'Implement canonical tags on all pages'
        ]
    },
    'LLMs.txt Presence': {
        learnMoreUrl: 'https://llmstxt.org/',
        howToFix: [
            'Create /llms.txt file in site root',
            'Add concise summary of your site/brand',
            'Include key facts and data points',
            'Format in plain text with clear sections'
        ]
    },

    // Content Quality
    'Content Freshness': {
        learnMoreUrl: 'https://developers.google.com/search/docs/appearance/structured-data/article',
        howToFix: [
            'Add datePublished and dateModified to schema markup',
            'Use <time datetime> tags in HTML',
            'Add article:published_time meta tag',
            'Update content regularly to maintain freshness'
        ]
    },
    'FAQ Content & Schema': {
        learnMoreUrl: 'https://developers.google.com/search/docs/appearance/structured-data/faqpage',
        howToFix: [
            'Add FAQ schema markup (FAQPage type)',
            'Structure content with clear questions and answers',
            'Use accordion/details elements for presentation',
            'Ensure Q&A format is scannable'
        ]
    },
    'Brand Consistency': {
        learnMoreUrl: 'https://schema.org/Organization',
        howToFix: [
            'Include brand name in page title',
            'Add brand name to H1 and meta description',
            'Mention brand in first paragraph',
            'Use consistent branding across all pages'
        ]
    },

    // Semantic Structure
    'Schema.org Markup': {
        learnMoreUrl: 'https://schema.org/docs/gs.html',
        howToFix: [
            'Add JSON-LD structured data to <head>',
            'Use Organization, Article, Product, or relevant types',
            'Include required properties for each type',
            'Validate with Google Rich Results Test'
        ]
    },
    'Heading Hierarchy': {
        learnMoreUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements',
        howToFix: [
            'Use exactly one H1 per page (usually page title)',
            'Structure content with H2, H3 subheadings',
            "Don't skip heading levels",
            'Make headings descriptive and keyword-rich'
        ]
    },
    'Semantic HTML Usage': {
        learnMoreUrl: 'https://developer.mozilla.org/en-US/docs/Glossary/Semantics',
        howToFix: [
            'Use <article>, <section>, <nav>, <aside> elements',
            'Wrap main content in <main> tag',
            'Use <header> and <footer> appropriately',
            'Replace generic <div> with semantic alternatives'
        ]
    },
    'Content Depth': {
        learnMoreUrl: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
        howToFix: [
            'Expand content to at least 500 words for depth',
            'Add comprehensive information and examples',
            'Include relevant details and context',
            'Break long content into scannable sections'
        ]
    },

    // Accessibility & Brand
    'Image Alt Text': {
        learnMoreUrl: 'https://web.dev/image-alt/',
        howToFix: [
            'Add descriptive alt attributes to all <img> tags',
            'Describe image content, not just "image" or filename',
            'Keep alt text concise (125 characters or less)',
            'Use empty alt="" for decorative images'
        ]
    },
    'ARIA Usage': {
        learnMoreUrl: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA',
        howToFix: [
            'Add aria-label to buttons and links without visible text',
            'Use role attributes for custom widgets',
            'Add aria-labelledby for form field associations',
            'Test with screen readers'
        ]
    },
    'Meta Description Quality': {
        learnMoreUrl: 'https://developers.google.com/search/docs/appearance/snippet',
        howToFix: [
            'Write unique meta description for each page',
            'Keep between 50-160 characters',
            'Include primary keywords naturally',
            'Make it compelling and action-oriented'
        ]
    },
    'Mobile Viewport': {
        learnMoreUrl: 'https://web.dev/viewport/',
        howToFix: [
            'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
            'Place in <head> section',
            'Test on mobile devices',
            'Ensure responsive design works'
        ]
    },
    'Canonical URL': {
        learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
        howToFix: [
            'Add canonical link tag to all pages',
            'Use absolute URLs',
            'Point to the preferred version of content',
            'Be consistent across duplicate pages'
        ]
    },
    'Language Declaration': {
        learnMoreUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang',
        howToFix: [
            'Add lang attribute to <html> tag',
            'Use valid language codes (e.g., "en", "es", "fr")',
            'Specify regional variants if needed (e.g., "en-US")',
            'Update for each language version of your site'
        ]
    },
    'Open Graph Tags': {
        learnMoreUrl: 'https://ogp.me/',
        howToFix: [
            'Add og:title, og:description, og:image meta tags',
            'Use high-quality images (1200x630px recommended)',
            'Include og:type and og:url',
            'Test with social media debuggers'
        ]
    },

    // AEO Optimization
    'Entity Confidence': {
        learnMoreUrl: 'https://schema.org/Organization',
        howToFix: [
            'Add Organization schema with complete details',
            'Include sameAs links to Wikipedia, LinkedIn, Crunchbase',
            'Add logo, address, and contact information',
            'Link to social media profiles'
        ]
    },
    'List & Table Usage': {
        learnMoreUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/ul',
        howToFix: [
            'Use bulleted lists (<ul>) for related items',
            'Use numbered lists (<ol>) for sequential steps',
            'Add tables for data comparisons',
            'Make lists and tables easy to scan'
        ]
    },
    'Definition Structure': {
        learnMoreUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dl',
        howToFix: [
            'Use <dl>, <dt>, <dd> for glossaries',
            'Format Q&A sections with definition lists',
            'Keep definitions concise and clear',
            'Use consistently throughout site'
        ]
    },
    'Image Dimension Hints': {
        learnMoreUrl: 'https://web.dev/cls/',
        howToFix: [
            'Add width and height attributes to all <img> tags',
            'Use aspect-ratio CSS property',
            'Reserve space for images before they load',
            'Test with PageSpeed Insights'
        ]
    },
    'Lazy Loading': {
        learnMoreUrl: 'https://web.dev/browser-level-image-lazy-loading/',
        howToFix: [
            'Add loading="lazy" to below-fold images',
            'Keep above-fold images with eager loading',
            'Test image loading behavior',
            'Use for images, iframes, and videos'
        ]
    }
};

/**
 * Look up how-to-fix steps for a test name
 * Tries exact match first, then partial match
 */
export function getHowToFixSteps(testName: string): string[] {
    // Exact match
    if (TEST_RESOURCES[testName]) {
        return TEST_RESOURCES[testName].howToFix;
    }

    // Partial match
    const lowerTestName = testName.toLowerCase();
    for (const [key, value] of Object.entries(TEST_RESOURCES)) {
        if (key.toLowerCase().includes(lowerTestName) || lowerTestName.includes(key.toLowerCase())) {
            return value.howToFix;
        }
    }

    // No match - return generic steps
    return [
        'Review the test results for specific issues',
        'Consult documentation for best practices',
        'Implement the recommended changes',
        'Re-run the audit to verify improvements'
    ];
}
