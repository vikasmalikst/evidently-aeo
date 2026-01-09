import * as cheerio from 'cheerio';
import axios from 'axios';
import { TestResult, AnalyzerOptions } from '../types';

export async function analyzeHtmlStructure(url: string, options?: AnalyzerOptions): Promise<TestResult[]> {
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
        name: 'HTML Structure',
        status: 'fail',
        score: 0,
        message: 'Could not fetch HTML for analysis'
      }];
    }
  }

  const $ = cheerio.load(html as string);
  const h1Count = $('h1').length;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;
  
  const semanticTags = ['article', 'section', 'main', 'nav', 'aside', 'header', 'footer'];
  const semanticCount = semanticTags.reduce((acc, tag) => acc + $(tag).length, 0);
  
  // Word count (rough estimation excluding scripts/styles)
  $('script').remove();
  $('style').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText.split(' ').length;

  return [
    {
      name: 'Heading Hierarchy',
      status: h1Count === 1 ? 'pass' : (h1Count === 0 ? 'fail' : 'warning'),
      score: h1Count === 1 ? 100 : (h1Count === 0 ? 0 : 50),
      message: h1Count === 1 ? 'Single H1 found' : `Found ${h1Count} H1 tags (should be 1)`,
      details: { h1: h1Count, h2: h2Count, h3: h3Count }
    },
    {
      name: 'Semantic HTML Usage',
      status: semanticCount > 5 ? 'pass' : 'warning',
      score: Math.min(100, semanticCount * 10),
      message: `Found ${semanticCount} semantic tags`,
      details: { count: semanticCount }
    },
    {
      name: 'Content Depth',
      status: wordCount > 1500 ? 'pass' : (wordCount > 500 ? 'pass' : 'warning'),
      score: Math.min(100, (wordCount / 1500) * 100),
      message: `Approx. ${wordCount} words found`
    }
  ];
}
