import * as cheerio from 'cheerio';
import axios from 'axios';
import { TestResult, AnalyzerOptions } from '../types';

export async function analyzeAccessibility(url: string, options?: AnalyzerOptions): Promise<TestResult[]> {
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
        name: 'Accessibility Analysis',
        status: 'fail',
        score: 0,
        message: 'Could not fetch HTML for analysis'
      }];
    }
  }

  const $ = cheerio.load(html as string);
  
  // Image Alt Text
  const images = $('img');
  const totalImages = images.length;
  let imagesWithAlt = 0;
  images.each((_, el) => {
    if ($(el).attr('alt')) imagesWithAlt++;
  });
  
  const altScore = totalImages === 0 ? 100 : (imagesWithAlt / totalImages) * 100;
  
  // ARIA usage
  const ariaElements = $('[aria-label], [aria-labelledby], [role]').length;

  return [
    {
      name: 'Image Alt Text',
      status: altScore > 80 ? 'pass' : (altScore > 50 ? 'warning' : 'fail'),
      score: Math.round(altScore),
      message: totalImages === 0 
        ? 'No images found' 
        : `${imagesWithAlt}/${totalImages} images have alt text`
    },
    {
      name: 'ARIA Usage',
      status: ariaElements > 0 ? 'pass' : 'info',
      score: ariaElements > 0 ? 100 : 50, // Not strictly required but good for AEO
      message: ariaElements > 0 ? `Found ${ariaElements} elements with ARIA attributes` : 'No explicit ARIA attributes found'
    }
  ];
}
