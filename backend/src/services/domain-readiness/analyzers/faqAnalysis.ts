import * as cheerio from 'cheerio';
import axios from 'axios';
import { TestResult, AnalyzerOptions } from '../types';

export async function analyzeFaq(url: string, options?: AnalyzerOptions): Promise<TestResult[]> {
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
        name: 'FAQ Analysis',
        status: 'fail',
        score: 0,
        message: 'Could not fetch HTML for analysis'
      }];
    }
  }

  const $ = cheerio.load(html as string);
  
  // Check schema
  let hasFaqSchema = false;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content && (content.includes('FAQPage') || content.includes('QAPage'))) {
        hasFaqSchema = true;
      }
    } catch (e) {}
  });

  // Check content patterns
  const bodyText = $('body').text().toLowerCase();
  const hasQuestionKeywords = bodyText.includes('frequently asked questions') || bodyText.includes('faq');
  const hasQuestionMarks = (bodyText.match(/\?/g) || []).length > 3;
  
  // Check for common accordion patterns
  const hasAccordions = $('.accordion, .faq, [class*="accordion"], [class*="faq"]').length > 0;
  const hasDetails = $('details').length > 0;

  const score = (hasFaqSchema ? 50 : 0) + (hasQuestionKeywords ? 20 : 0) + (hasAccordions || hasDetails ? 30 : 0);

  return [{
    name: 'FAQ Content & Schema',
    status: score > 60 ? 'pass' : (score > 20 ? 'info' : 'warning'),
    score: Math.min(100, score),
    message: hasFaqSchema 
      ? 'FAQ Schema detected' 
      : (hasQuestionKeywords ? 'FAQ section detected (content only)' : 'No obvious FAQ content found')
  }];
}
