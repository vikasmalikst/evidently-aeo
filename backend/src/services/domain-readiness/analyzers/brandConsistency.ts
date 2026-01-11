import * as cheerio from 'cheerio';
import axios from 'axios';
import { TestResult, AnalyzerOptions } from '../types';

export async function analyzeBrandConsistency(url: string, options?: AnalyzerOptions): Promise<TestResult[]> {
  const brandName = options?.brandName;

  if (!brandName) {
    return [{
      name: 'Brand Consistency',
      status: 'info',
      score: 0,
      message: 'Brand name not provided for analysis'
    }];
  }

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
        name: 'Brand Consistency',
        status: 'fail',
        score: 0,
        message: 'Could not fetch HTML for analysis'
      }];
    }
  }

  const $ = cheerio.load(html as string);
  const brandRegex = new RegExp(`\\b${brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

  const h1Text = $('h1').first().text();
  const titleText = $('title').text();
  const descText = $('meta[name="description"]').attr('content') || '';
  const firstP = $('p').first().text();

  const inH1 = brandRegex.test(h1Text);
  const inTitle = brandRegex.test(titleText);
  const inDesc = brandRegex.test(descText);
  const inFirstP = brandRegex.test(firstP);

  const score = (inTitle ? 40 : 0) + (inH1 ? 20 : 0) + (inDesc ? 20 : 0) + (inFirstP ? 20 : 0);

  return [{
    name: 'Brand Consistency',
    status: score > 60 ? 'pass' : (score > 0 ? 'warning' : 'fail'),
    score,
    message: `Brand "${brandName}" found in: ${[inTitle && 'Title', inH1 && 'H1', inDesc && 'Description', inFirstP && 'First Paragraph'].filter(Boolean).join(', ') || 'None'}`
  }];
}
