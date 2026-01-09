import * as cheerio from 'cheerio';
import axios from 'axios';
import { TestResult, AnalyzerOptions } from '../types';

export async function analyzeCanonical(url: string, options?: AnalyzerOptions): Promise<TestResult[]> {
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
        name: 'Canonical Analysis',
        status: 'fail',
        score: 0,
        message: 'Could not fetch HTML for analysis'
      }];
    }
  }

  const $ = cheerio.load(html as string);
  const canonical = $('link[rel="canonical"]').attr('href');
  
  if (!canonical) {
    return [{
      name: 'Canonical Tag',
      status: 'warning',
      score: 0,
      message: 'No canonical tag found. This can lead to duplicate content issues.'
    }];
  }

  // Basic validation
  let isValid = false;
  try {
    const canonicalUrl = new URL(canonical, url).toString(); // Resolve relative URLs
    const currentUrl = new URL(url).toString();
    
    // Check if self-referencing (simple check)
    // Note: In a real crawler, we'd check if this page IS the canonical one or points to another.
    // For this audit, we just check existence and format.
    isValid = true;

    return [{
      name: 'Canonical Tag',
      status: 'pass',
      score: 100,
      message: `Canonical tag present: ${canonical}`,
      details: { canonical: canonicalUrl }
    }];
  } catch (e) {
    return [{
      name: 'Canonical Tag',
      status: 'fail',
      score: 0,
      message: `Invalid canonical URL: ${canonical}`
    }];
  }
}
