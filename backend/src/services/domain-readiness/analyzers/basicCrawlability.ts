import axios from 'axios';
import { TestResult } from '../types';

export async function analyzeBasicCrawlability(url: string): Promise<TestResult[]> {
  try {
    const response = await axios.head(url, { 
      timeout: 10000, 
      validateStatus: () => true,
      headers: { 'User-Agent': 'EvidentlyAEO-Auditor/1.0' }
    });
    
    const isHttps = url.startsWith('https');
    const status = response.status;
    
    const httpsTest: TestResult = {
      name: 'HTTPS Availability',
      status: isHttps ? 'pass' : 'fail',
      score: isHttps ? 100 : 0,
      message: isHttps ? 'Site is served over HTTPS' : 'Site is not using HTTPS',
    };

    const statusTest: TestResult = {
      name: 'HTTP Status',
      status: status < 400 ? 'pass' : 'fail',
      score: status < 400 ? 100 : 0,
      message: `Returned HTTP ${status}`,
    };

    return [httpsTest, statusTest];
  } catch (error: any) {
    return [{
      name: 'Site Reachability',
      status: 'fail',
      score: 0,
      message: `Could not reach site: ${error.message}`
    }];
  }
}
