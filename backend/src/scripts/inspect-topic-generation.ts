/**
 * Inspection script to see:
 * 1. What we get from scraping the brand's website
 * 2. What context we pass to the LLM (without actually calling it)
 * 
 * Usage:
 *   npm run inspect:topics -- <brand_url> <brand_name> [industry] [competitors...]
 * 
 * Or directly:
 *   ts-node --transpile-only src/scripts/inspect-topic-generation.ts <brand_url> <brand_name> [industry] [competitors...]
 * 
 * Example:
 *   ts-node --transpile-only src/scripts/inspect-topic-generation.ts https://agicap.com Agicap "Financial Software" Float QuickBooks
 */

import 'dotenv/config';
import { websiteScraperService } from '../services/website-scraper.service';

// Color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function logSection(title: string, color: string = colors.cyan) {
  console.log(`\n${color}${colors.bright}${'='.repeat(80)}${colors.reset}`);
  console.log(`${color}${colors.bright}${title}${colors.reset}`);
  console.log(`${color}${colors.bright}${'='.repeat(80)}${colors.reset}\n`);
}

function logSubsection(title: string) {
  console.log(`\n${colors.yellow}${colors.bright}▶ ${title}${colors.reset}`);
  console.log(`${colors.dim}${'-'.repeat(78)}${colors.reset}`);
}

function logData(data: any, label?: string) {
  if (label) {
    console.log(`${colors.blue}${label}:${colors.reset}`);
  }
  console.log(JSON.stringify(data, null, 2));
}

async function inspectTopicGeneration() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error(`${colors.red}Error: Missing required argument${colors.reset}`);
    console.log(`\nUsage: ts-node --transpile-only src/scripts/inspect-topic-generation.ts <brand_url> [brand_name] [industry] [competitors...]`);
    console.log(`\nExamples:`);
    console.log(`  ts-node --transpile-only src/scripts/inspect-topic-generation.ts https://agicap.com`);
    console.log(`  ts-node --transpile-only src/scripts/inspect-topic-generation.ts https://agicap.com Agicap`);
    console.log(`  ts-node --transpile-only src/scripts/inspect-topic-generation.ts https://agicap.com Agicap "Financial Software" Float QuickBooks`);
    process.exit(1);
  }

  const [websiteUrl, brandName, industry, ...competitors] = args;

  logSection('TOPIC GENERATION INSPECTION', colors.magenta);
  console.log(`${colors.bright}URL:${colors.reset} ${websiteUrl}`);
  if (brandName) {
    console.log(`${colors.bright}Brand Name:${colors.reset} ${brandName} (provided)`);
  } else {
    console.log(`${colors.dim}Brand Name:${colors.reset} Will be extracted from scraped data`);
  }
  if (industry) console.log(`${colors.bright}Industry:${colors.reset} ${industry}`);
  if (competitors.length > 0) console.log(`${colors.bright}Competitors:${colors.reset} ${competitors.join(', ')}`);

  // ============================================================================
  // STEP 1: Website Scraping
  // ============================================================================
  logSection('STEP 1: WEBSITE SCRAPING OUTPUT', colors.green);

  let scrapeResult = null;
  let extractedBrandName = brandName;
  
  try {
    logSubsection('Scraping website...');
    scrapeResult = await websiteScraperService.scrapeHomepage(websiteUrl, {
      brandName: brandName,
      timeoutMs: 10000,
      maxKeywords: 25,
      maxChars: 5000,
    });
    
    // Extract brand name from title if not provided
    if (!extractedBrandName && scrapeResult.title) {
      // Try patterns like "Product | Brand" or "Product - Brand"
      const titlePatterns = [
        /\|\s*([^|]+)$/,  // "Product | Brand"
        /–\s*([^–]+)$/,   // "Product – Brand"
        /-\s*([^-]+)$/,   // "Product - Brand"
      ];
      
      for (const pattern of titlePatterns) {
        const match = scrapeResult.title.match(pattern);
        if (match && match[1]) {
          extractedBrandName = match[1].trim();
          console.log(`\n${colors.yellow}ℹ️  Extracted brand name from title: "${extractedBrandName}"${colors.reset}`);
          break;
        }
      }
      
      // If still not found, try extracting from domain
      if (!extractedBrandName) {
        try {
          const urlObj = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
          const hostname = urlObj.hostname.replace('www.', '');
          const domainParts = hostname.split('.');
          if (domainParts.length > 0) {
            extractedBrandName = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
            console.log(`\n${colors.yellow}ℹ️  Extracted brand name from domain: "${extractedBrandName}"${colors.reset}`);
          }
        } catch {
          // Fallback to first word of title
          const titleParts = scrapeResult.title.split(/[|–—:]/)[0].trim();
          extractedBrandName = titleParts.split(/\s+/)[0];
          console.log(`\n${colors.yellow}ℹ️  Extracted brand name from title (fallback): "${extractedBrandName}"${colors.reset}`);
        }
      }
    } else if (!extractedBrandName) {
      // Extract from domain if no title available
      try {
        const urlObj = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
        const hostname = urlObj.hostname.replace('www.', '');
        const domainParts = hostname.split('.');
        if (domainParts.length > 0) {
          extractedBrandName = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
          console.log(`\n${colors.yellow}ℹ️  Extracted brand name from domain: "${extractedBrandName}"${colors.reset}`);
        }
      } catch {
        extractedBrandName = 'Unknown Brand';
        console.log(`\n${colors.yellow}⚠️  No brand name provided or found. Using "Unknown Brand" for context preview.${colors.reset}`);
      }
    }

    logSubsection('Full Scraping Result');
    logData(scrapeResult, 'Scrape Result');

    logSubsection('Key Extracted Data');
    console.log(`${colors.bright}Resolved URL:${colors.reset} ${scrapeResult.resolvedUrl}`);
    console.log(`${colors.bright}Title:${colors.reset} ${scrapeResult.title || 'N/A'}`);
    console.log(`${colors.bright}Meta Description:${colors.reset} ${scrapeResult.metaDescription || 'N/A'}`);
    
    console.log(`\n${colors.bright}H1 Headings (${scrapeResult.headings.h1.length}):${colors.reset}`);
    scrapeResult.headings.h1.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));
    
    console.log(`\n${colors.bright}H2 Headings (${scrapeResult.headings.h2.length}):${colors.reset}`);
    scrapeResult.headings.h2.slice(0, 10).forEach((h, i) => console.log(`  ${i + 1}. ${h}`));
    if (scrapeResult.headings.h2.length > 10) {
      console.log(`  ... and ${scrapeResult.headings.h2.length - 10} more`);
    }
    
    console.log(`\n${colors.bright}Navigation Items (${scrapeResult.navItems.length}):${colors.reset}`);
    scrapeResult.navItems.slice(0, 15).forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
    if (scrapeResult.navItems.length > 15) {
      console.log(`  ... and ${scrapeResult.navItems.length - 15} more`);
    }

    console.log(`\n${colors.bright}Brand Keywords (${scrapeResult.brandKeywords.length}):${colors.reset}`);
    scrapeResult.brandKeywords.forEach((kw, i) => console.log(`  ${i + 1}. ${kw}`));

    console.log(`\n${colors.bright}Industry Keywords (${scrapeResult.industryKeywords.length}):${colors.reset}`);
    scrapeResult.industryKeywords.forEach((kw, i) => console.log(`  ${i + 1}. ${kw}`));

    console.log(`\n${colors.bright}Website Content (sent to LLM):${colors.reset}`);
    console.log(`${colors.dim}${scrapeResult.websiteContent || '(empty)'}${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}❌ Scraping failed:${colors.reset}`, error);
    console.log(`${colors.yellow}⚠️  Continuing without scraping data...${colors.reset}`);
  }

  // ============================================================================
  // STEP 2: LLM Context/Prompt
  // ============================================================================
  logSection('STEP 2: CONTEXT PASSED TO LLM', colors.blue);

  // Build the request object that would be passed to the service
  const request = {
    brandName: extractedBrandName || 'Unknown Brand',
    industry: industry || 'General',
    competitors: competitors.length > 0 ? competitors : undefined,
    description: undefined, // Would come from database in real flow
    websiteContent: scrapeResult?.websiteContent,
    brandKeywords: scrapeResult?.brandKeywords,
    industryKeywords: scrapeResult?.industryKeywords,
    maxTopics: 20,
  };

  logSubsection('Request Object (Input to Topic Generation Service)');
  logData(request, 'Request');

  // Reconstruct the prompt based on the service's logic
  logSubsection('Generated Prompt (What LLM Actually Sees)');
  
  const competitorList = request.competitors?.slice(0, 5).join(', ') || '';
  const brandKw = request.brandKeywords?.slice(0, 5).join(', ') || '';
  const industryKw = request.industryKeywords?.slice(0, 12).join(', ') || '';
  const aspectList = ['pricing', 'integrations', 'implementation', 'reporting', 'AP/AR automation', 'forecasting', 'security', 'user experience'].join(', ');

  const prompt = scrapeResult ? `Generate topics and trending keywords for "${request.brandName}".

INPUT:
- Brand: ${request.brandName}
${request.industry ? `- Industry: ${request.industry}` : ''}
${competitorList ? `- Competitors: ${competitorList}` : ''}
${request.websiteContent ? `- ${request.websiteContent}` : ''}
${brandKw ? `- Brand keywords: ${brandKw}` : ''}
${industryKw ? `- Industry keywords: ${industryKw}` : ''}

OUTPUT TWO ARRAYS IN JSON:

1. "topics" (20-25 items): AI-generated topic phrases grouped by intent.
   Intent categories: awareness, comparison, purchase, support
   
   RULES:
   - 2-5 words each (max 6 for "X vs Y" comparisons)
   - NO question marks
   - Do NOT start with: what/how/why/when/where/who/which
   - Neutral tone (not promotional)
   - For comparison: MUST include an aspect (${aspectList})
     Example: "${request.brandName} vs ${request.competitors?.[0] || 'Competitor'} pricing" NOT just "${request.brandName} vs ${request.competitors?.[0] || 'Competitor'}"
   - Mix brand-specific + industry terms

2. "trending" (6-8 items): Short trending keyword phrases users search now.
   RULES:
   - 1-4 words each
   - Keyword-like (nouns), not questions
   - Categories: Trending, Comparison, Features, Pricing, Support, Alternatives

RETURN ONLY THIS JSON (no markdown, no explanation):
{
  "primaryDomain": "1 sentence about brand's main value",
  "topics": [
    {"intentArchetype": "awareness|comparison|purchase|support", "topic": "short phrase"}
  ],
  "trending": [
    {"keyword": "short phrase", "category": "Trending|Comparison|Features|Pricing|Support|Alternatives"}
  ]
}` : '(No prompt - scraping failed or no data available)';

  console.log(`${colors.dim}${prompt}${colors.reset}`);

  // Show prompt statistics
  logSubsection('Prompt Statistics');
  console.log(`${colors.bright}Total prompt length:${colors.reset} ${prompt.length} characters`);
  console.log(`${colors.bright}Website content length:${colors.reset} ${request.websiteContent?.length || 0} characters`);
  console.log(`${colors.bright}Brand keywords count:${colors.reset} ${request.brandKeywords?.length || 0}`);
  console.log(`${colors.bright}Industry keywords count:${colors.reset} ${request.industryKeywords?.length || 0}`);

  // ============================================================================
  // ANALYSIS & RECOMMENDATIONS
  // ============================================================================
  logSection('ANALYSIS & RECOMMENDATIONS', colors.cyan);

  logSubsection('Data Quality Assessment');
  
  if (!scrapeResult) {
    console.log(`${colors.red}❌ No scraping data available${colors.reset}`);
  } else {
    const issues: string[] = [];
    const strengths: string[] = [];

    if (scrapeResult.headings.h1.length === 0) {
      issues.push('No H1 headings found');
    } else {
      strengths.push(`${scrapeResult.headings.h1.length} H1 headings extracted`);
    }

    if (scrapeResult.headings.h2.length < 3) {
      issues.push('Very few H2 headings (< 3)');
    } else {
      strengths.push(`${scrapeResult.headings.h2.length} H2 headings extracted`);
    }

    if (scrapeResult.brandKeywords.length === 0) {
      issues.push('No brand-specific keywords extracted');
    } else {
      strengths.push(`${scrapeResult.brandKeywords.length} brand keywords found`);
    }

    if (scrapeResult.industryKeywords.length < 5) {
      issues.push('Few industry keywords (< 5)');
    } else {
      strengths.push(`${scrapeResult.industryKeywords.length} industry keywords found`);
    }

    if (scrapeResult.websiteContent.length < 50) {
      issues.push('Website content string is very short (< 50 chars)');
    }

    if (strengths.length > 0) {
      console.log(`${colors.green}✅ Strengths:${colors.reset}`);
      strengths.forEach(s => console.log(`   • ${s}`));
    }

    if (issues.length > 0) {
      console.log(`\n${colors.yellow}⚠️  Potential Issues:${colors.reset}`);
      issues.forEach(i => console.log(`   • ${i}`));
    }
  }

  logSection('INSPECTION COMPLETE', colors.green);
}

inspectTopicGeneration().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
