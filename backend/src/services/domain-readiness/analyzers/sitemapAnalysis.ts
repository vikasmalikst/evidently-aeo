import axios from 'axios';
import { TestResult, AnalyzerOptions } from '../types';

export async function analyzeSitemap(url: string, options?: AnalyzerOptions): Promise<TestResult[]> {
  const sitemapUrl = new URL('/sitemap.xml', url).toString();
  
  try {
    const response = await axios.get(sitemapUrl, { 
      timeout: options?.timeout || 10000,
      validateStatus: () => true 
    });

    if (response.status >= 400) {
      return [{
        name: 'Sitemap Availability',
        status: 'warning',
        score: 0,
        message: 'sitemap.xml not found at root (common location)'
      }];
    }

    const content = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const urlCount = (content.match(/<loc>/g) || []).length;

    return [{
      name: 'Sitemap Availability',
      status: 'pass',
      score: 100,
      message: 'sitemap.xml is accessible'
    }, {
      name: 'Sitemap Size',
      status: urlCount > 0 ? 'pass' : 'warning',
      score: urlCount > 0 ? 100 : 0,
      message: `Found ${urlCount} URLs in sitemap`
    }];

  } catch (error: any) {
    return [{
      name: 'Sitemap Availability',
      status: 'fail',
      score: 0,
      message: `Error fetching sitemap.xml: ${error.message}`
    }];
  }
}
