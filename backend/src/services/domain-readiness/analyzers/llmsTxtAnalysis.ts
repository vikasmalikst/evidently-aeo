import axios from 'axios';
import { TestResult } from '../types';

export async function analyzeLlmsTxt(url: string): Promise<TestResult[]> {
  const paths = ['/llms.txt', '/llm.txt'];
  
  for (const path of paths) {
    try {
      const llmUrl = new URL(path, url).toString();
      const response = await axios.get(llmUrl, { timeout: 3000, validateStatus: () => true });
      
      if (response.status === 200 && response.data && response.data.length > 10) {
        return [{
          name: 'LLMs.txt Presence',
          status: 'pass',
          score: 100,
          message: `Found valid ${path}`,
          documentationUrl: 'https://llmstxt.org/'
        }];
      }
    } catch (e) {
      // Continue to next path
    }
  }

  return [{
    name: 'LLMs.txt Presence',
    status: 'fail', 
    score: 0,
    message: 'No llms.txt found. This file helps LLMs understand your site content.',
    documentationUrl: 'https://llmstxt.org/'
  }];
}
