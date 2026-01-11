import * as cheerio from 'cheerio';
import axios from 'axios';
import { TestResult, AnalyzerOptions } from '../types';

export async function analyzeEntityConfidence(url: string, options?: AnalyzerOptions): Promise<TestResult[]> {
    let html = options?.html;
    if (!html) {
        try {
            const response = await axios.get(url, {
                timeout: options?.timeout || 10000,
                headers: { 'User-Agent': 'EvidentlyAEO-Auditor/1.0' }
            });
            html = response.data;
        } catch (e: any) {
            return [{
                name: 'Entity Confidence',
                status: 'fail',
                score: 0,
                message: 'Could not fetch HTML for analysis'
            }];
        }
    }

    const $ = cheerio.load(html as string);
    const jsonLdScripts = $('script[type="application/ld+json"]');

    let hasOrganizationSchema = false;
    const sameAsLinks: string[] = [];

    jsonLdScripts.each((_, el) => {
        try {
            const content = $(el).html();
            if (!content) return;
            const data = JSON.parse(content);

            const checkEntity = (obj: any) => {
                if (!obj) return;

                // Check for Organization or LocalBusiness
                const type = obj['@type'];
                if (type === 'Organization' || type === 'LocalBusiness' ||
                    (Array.isArray(type) && (type.includes('Organization') || type.includes('LocalBusiness')))) {
                    hasOrganizationSchema = true;

                    // Extract sameAs links
                    if (obj.sameAs) {
                        if (Array.isArray(obj.sameAs)) {
                            sameAsLinks.push(...obj.sameAs);
                        } else {
                            sameAsLinks.push(obj.sameAs);
                        }
                    }
                }

                // Check in @graph array
                if (obj['@graph'] && Array.isArray(obj['@graph'])) {
                    obj['@graph'].forEach(checkEntity);
                }
            };

            if (Array.isArray(data)) {
                data.forEach(checkEntity);
            } else {
                checkEntity(data);
            }
        } catch (e) {
            // Ignore parse errors
        }
    });

    // Calculate score
    let score = 0;
    let status: 'pass' | 'fail' | 'warning' = 'fail';
    let message = '';

    if (hasOrganizationSchema) {
        score += 40;
        const uniqueLinks = [...new Set(sameAsLinks)];
        const linkScore = Math.min(60, uniqueLinks.length * 20);
        score += linkScore;

        if (score >= 80) {
            status = 'pass';
            message = `Strong entity presence with ${uniqueLinks.length} authoritative link(s)`;
        } else if (score >= 40) {
            status = 'warning';
            message = `Organization schema found, but only ${uniqueLinks.length} sameAs link(s). Add more to strengthen entity confidence.`;
        }
    } else {
        status = 'fail';
        message = 'No Organization or LocalBusiness schema found. AI engines need this to understand your brand identity.';
    }

    return [{
        name: 'Entity Confidence',
        status,
        score,
        message,
        details: {
            hasOrganizationSchema,
            sameAsCount: [...new Set(sameAsLinks)].length,
            sameAsLinks: [...new Set(sameAsLinks)].slice(0, 5) // Show first 5
        },
        documentationUrl: 'https://schema.org/Organization'
    }];
}
