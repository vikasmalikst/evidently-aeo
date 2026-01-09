import axios from 'axios';
import { TestResult } from '../types';

export async function analyzeRobotsTxt(url: string): Promise<TestResult[]> {
  try {
    const robotsUrl = new URL('/robots.txt', url).toString();
    const response = await axios.get(robotsUrl, { timeout: 5000, validateStatus: () => true });
    
    if (response.status >= 400) {
      return [{
        name: 'Robots.txt Availability',
        status: 'warning',
        score: 0,
        message: 'robots.txt not found or inaccessible',
      }];
    }

    const content = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const hasUserAgent = /User-agent:/i.test(content);
    const hasSitemap = /Sitemap:/i.test(content);

    return [{
      name: 'Robots.txt Availability',
      status: 'pass',
      score: 100,
      message: 'robots.txt is accessible',
    }, {
      name: 'Robots.txt Valid Content',
      status: hasUserAgent ? 'pass' : 'warning',
      score: hasUserAgent ? 100 : 50,
      message: hasUserAgent ? 'Contains User-agent rules' : 'No User-agent rules found',
    }, {
      name: 'Sitemap Declaration',
      status: hasSitemap ? 'pass' : 'info',
      score: hasSitemap ? 100 : 0,
      message: hasSitemap ? 'Sitemap declared in robots.txt' : 'No Sitemap declared in robots.txt',
    }];
  } catch (error: any) {
    return [{
      name: 'Robots.txt Availability',
      status: 'fail',
      score: 0,
      message: `Error fetching robots.txt: ${error.message}`
    }];
  }
}
