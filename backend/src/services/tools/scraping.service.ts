import puppeteer from 'puppeteer';

export class ScrapingService {
    /**
     * Search for a specific data point for a competitor.
     * Uses a headless browser to perform a search and extract the answer snippet.
     */
    async findCompetitorData(competitorName: string, dataPoint: string): Promise<{ value: string; source: string; confidence: number }> {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();

            // Construct a search query (e.g., "Jira pricing", "Asics rating")
            const query = `${competitorName} ${dataPoint}`;

            // We will use DuckDuckGo implies less blocking/captchas than Google for automated access
            await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2' });

            // Extract the "Quick Answer" or first result snippet
            let result = await page.evaluate(() => {
                // @ts-ignore
                const abstract = document.querySelector('.Abstract');
                // @ts-ignore
                if (abstract) return { text: abstract.textContent?.trim(), source: 'DuckDuckGo Instant Answer' };

                // Try generic result snippet
                // @ts-ignore
                const snippet = document.querySelector('.result__snippet');
                // @ts-ignore
                const link = document.querySelector('.result__a');
                if (snippet && link) {
                    return {
                        // @ts-ignore
                        text: snippet.textContent?.trim(),
                        // @ts-ignore
                        source: link.href
                    };
                }
                return null;
            });

            if (!result || !result.text) {
                return { value: 'Not found', source: 'Web Search', confidence: 0 };
            }

            // Formatting logic based on data type
            let extractedValue = result.text;

            // Heuristics for "Price"
            if (dataPoint.toLowerCase().includes('price') || dataPoint.toLowerCase().includes('cost')) {
                const priceMatch = result.text.match(/(\$\d+(?:\.\d{2})?(?:\/mo|\/year)?)/i);
                if (priceMatch) extractedValue = priceMatch[0];
            }

            // Heuristics for "Rating"
            if (dataPoint.toLowerCase().includes('rating') || dataPoint.toLowerCase().includes('review')) {
                const ratingMatch = result.text.match(/(\d\.\d)\/5|\d\.\d stars/i);
                if (ratingMatch) extractedValue = ratingMatch[0];
            }

            return {
                value: extractedValue.substring(0, 100) + (extractedValue.length > 100 ? '...' : ''),
                source: new URL(result.source).hostname.replace('www.', ''),
                confidence: 85
            };

        } catch (error) {
            console.error('Scraping error:', error);
            return { value: 'Error fetching data', source: 'System', confidence: 0 };
        } finally {
            if (browser) await browser.close();
        }
    }
}

export const scrapingService = new ScrapingService();
