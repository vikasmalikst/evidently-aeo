import * as cheerio from 'cheerio';
import axios from 'axios';
import { TestResult, AnalyzerOptions } from '../types';

export async function analyzeSchema(url: string, options?: AnalyzerOptions): Promise<TestResult[]> {
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
        name: 'Schema Analysis',
        status: 'fail',
        score: 0,
        message: 'Could not fetch HTML for analysis'
      }];
    }
  }

  const $ = cheerio.load(html as string);
  const jsonLdScripts = $('script[type="application/ld+json"]');
  const foundTypes: string[] = [];
  
  const highValueTypes = ['Article', 'NewsArticle', 'BlogPosting', 'Product', 'FAQPage', 'QAPage', 'BreadcrumbList', 'Organization', 'LocalBusiness'];

  jsonLdScripts.each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      const data = JSON.parse(content);
      
      const checkType = (obj: any) => {
        if (!obj) return;
        if (obj['@type']) {
          const type = Array.isArray(obj['@type']) ? obj['@type'][0] : obj['@type'];
          foundTypes.push(type);
        }
        if (obj['@graph'] && Array.isArray(obj['@graph'])) {
          obj['@graph'].forEach(checkType);
        }
      };
      
      if (Array.isArray(data)) {
        data.forEach(checkType);
      } else {
        checkType(data);
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  const uniqueTypes = [...new Set(foundTypes)];
  const importantTypesFound = uniqueTypes.filter(t => highValueTypes.includes(t));

  return [{
    name: 'Schema.org Markup',
    status: importantTypesFound.length > 0 ? 'pass' : (uniqueTypes.length > 0 ? 'info' : 'warning'),
    score: Math.min(100, (importantTypesFound.length * 20) + (uniqueTypes.length * 5)),
    message: importantTypesFound.length > 0 
      ? `Found high-value schemas: ${importantTypesFound.join(', ')}`
      : (uniqueTypes.length > 0 ? `Found schemas: ${uniqueTypes.join(', ')}` : 'No JSON-LD schema found'),
    details: { allTypes: uniqueTypes }
  }];
}
