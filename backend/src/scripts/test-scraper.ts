import { websiteScraperService } from '../services/website-scraper.service';

async function main() {
  const websiteUrl = process.argv[2] || 'https://agicap.com';
  const brandName = process.argv[3] || 'Agicap';

  console.log('🧪 Testing website scraper:', { websiteUrl, brandName });

  const result = await websiteScraperService.scrapeHomepage(websiteUrl, {
    brandName,
    timeoutMs: 8000,
    maxChars: 3500,
    maxKeywords: 25,
  });

  console.log('✅ Scrape result (preview):');
  console.log(
    JSON.stringify(
      {
        resolvedUrl: result.resolvedUrl,
        title: result.title,
        metaDescription: result.metaDescription,
        headings: {
          h1: result.headings.h1.slice(0, 5),
          h2: result.headings.h2.slice(0, 8),
          h3: result.headings.h3.slice(0, 8),
        },
        navItems: result.navItems.slice(0, 15),
        brandKeywords: result.brandKeywords,
        industryKeywords: result.industryKeywords,
        websiteContentPreview: result.websiteContent.slice(0, 600),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('❌ test-scraper failed:', err);
  process.exit(1);
});

