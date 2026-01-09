import * as cheerio from 'cheerio';
import axios from 'axios';
import { TestResult, AnalyzerOptions } from '../types';

export async function analyzeMetadata(url: string, options?: AnalyzerOptions): Promise<TestResult[]> {
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
        name: 'Metadata Analysis',
        status: 'fail',
        score: 0,
        message: 'Could not fetch HTML for analysis'
      }];
    }
  }

  const $ = cheerio.load(html as string);
  const title = $('title').text().trim();
  const description = $('meta[name="description"]').attr('content');
  const viewport = $('meta[name="viewport"]').attr('content');
  const canonical = $('link[rel="canonical"]').attr('href');
  const lang = $('html').attr('lang');
  
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDesc = $('meta[property="og:description"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');

  const tests: TestResult[] = [];

  // Meta Description
  tests.push({
    name: 'Meta Description Quality',
    status: description && description.length > 50 && description.length < 160 ? 'pass' : 'warning',
    score: description ? (description.length >= 50 && description.length <= 160 ? 100 : 70) : 0,
    message: description ? `Description length: ${description.length} chars` : 'Missing meta description'
  });

  // Viewport
  tests.push({
    name: 'Mobile Viewport',
    status: viewport && viewport.includes('width=device-width') ? 'pass' : 'fail',
    score: viewport && viewport.includes('width=device-width') ? 100 : 0,
    message: viewport ? 'Viewport tag present' : 'Missing viewport tag (not mobile friendly)'
  });

  // Canonical
  tests.push({
    name: 'Canonical URL',
    status: canonical ? 'pass' : 'warning',
    score: canonical ? 100 : 0,
    message: canonical ? 'Canonical URL present' : 'Missing canonical tag'
  });

  // Language
  tests.push({
    name: 'Language Declaration',
    status: lang ? 'pass' : 'warning',
    score: lang ? 100 : 50,
    message: lang ? `Language set to "${lang}"` : 'Missing html lang attribute'
  });

  // Open Graph
  const ogScore = (ogTitle ? 33 : 0) + (ogDesc ? 33 : 0) + (ogImage ? 34 : 0);
  tests.push({
    name: 'Open Graph Tags',
    status: ogScore > 80 ? 'pass' : (ogScore > 0 ? 'warning' : 'fail'),
    score: ogScore,
    message: `Found: ${[ogTitle && 'Title', ogDesc && 'Desc', ogImage && 'Image'].filter(Boolean).join(', ') || 'None'}`
  });

  return tests;
}
