import * as cheerio from 'cheerio';
import axios from 'axios';
import { TestResult, AnalyzerOptions } from '../types';

export async function analyzeFreshness(url: string, options?: AnalyzerOptions): Promise<TestResult[]> {
  let html = options?.html;
  let lastModifiedHeader: string | undefined;

  if (!html) {
    try {
      const response = await axios.get(url, { 
        timeout: options?.timeout || 10000,
        headers: { 'User-Agent': 'EvidentlyAEO-Auditor/1.0' }
      });
      html = response.data;
      lastModifiedHeader = response.headers['last-modified'];
    } catch (e: any) {
      return [{
        name: 'Content Freshness',
        status: 'fail',
        score: 0,
        message: 'Could not fetch HTML for analysis'
      }];
    }
  }

  const $ = cheerio.load(html as string);
  
  // Try to find a date
  const dates: Date[] = [];
  
  // Meta tags
  const metaDate = $('meta[property="article:published_time"]').attr('content') ||
                   $('meta[name="publish_date"]').attr('content') ||
                   $('meta[name="date"]').attr('content');
  if (metaDate) dates.push(new Date(metaDate));

  // Time tags
  $('time[datetime]').each((_, el) => {
    const dt = $(el).attr('datetime');
    if (dt) dates.push(new Date(dt));
  });

  // JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      const data = JSON.parse(content);
      const findDate = (obj: any) => {
        if (!obj) return;
        if (obj.datePublished) dates.push(new Date(obj.datePublished));
        if (obj.dateModified) dates.push(new Date(obj.dateModified));
        if (Array.isArray(obj['@graph'])) obj['@graph'].forEach(findDate);
      };
      if (Array.isArray(data)) data.forEach(findDate);
      else findDate(data);
    } catch (e) {}
  });

  if (lastModifiedHeader) dates.push(new Date(lastModifiedHeader));

  // Find most recent valid date
  const validDates = dates.filter(d => !isNaN(d.getTime()));
  if (validDates.length === 0) {
    return [{
      name: 'Content Freshness',
      status: 'warning',
      score: 50, // Unknown freshness
      message: 'Could not detect content publication date'
    }];
  }

  const mostRecent = new Date(Math.max(...validDates.map(d => d.getTime())));
  const now = new Date();
  const diffDays = (now.getTime() - mostRecent.getTime()) / (1000 * 3600 * 24);

  let status: 'pass' | 'warning' | 'info' = 'info';
  let score = 50;
  let message = '';

  if (diffDays < 30) {
    status = 'pass';
    score = 100;
    message = `Content is very fresh (${Math.floor(diffDays)} days old)`;
  } else if (diffDays < 180) {
    status = 'pass';
    score = 80;
    message = `Content is reasonably fresh (${Math.floor(diffDays)} days old)`;
  } else if (diffDays < 365) {
    status = 'warning';
    score = 60;
    message = `Content is somewhat old (${Math.floor(diffDays)} days old)`;
  } else {
    status = 'warning';
    score = 40;
    message = `Content is stale (>1 year old)`;
  }

  return [{
    name: 'Content Freshness',
    status,
    score,
    message,
    details: { date: mostRecent.toISOString() }
  }];
}
