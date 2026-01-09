import axios from 'axios';
import { BotAccessStatus, AnalyzerOptions } from '../types';

export async function analyzeBotAccess(url: string, options?: AnalyzerOptions): Promise<BotAccessStatus[]> {
  const bots = [
    { name: 'GPTBot', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)' },
    { name: 'ClaudeBot', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' },
    { name: 'PerplexityBot', ua: 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)' },
    { name: 'CCBot', ua: 'CCBot/2.0 (https://commoncrawl.org/faq/)' },
    { name: 'Google-Extended', ua: 'Google-Extended' },
    { name: 'Bingbot', ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' }
  ];

  const results: BotAccessStatus[] = [];

  // We run these in parallel
  const promises = bots.map(async (bot) => {
    try {
      const response = await axios.head(url, {
        headers: { 'User-Agent': bot.ua },
        timeout: 5000,
        validateStatus: () => true
      });
      
      const allowed = response.status < 403;
      
      return {
        botName: bot.name,
        userAgent: bot.ua,
        httpStatus: response.status,
        allowed,
        allowedInRobotsTxt: true, // We don't parse robots.txt rules here yet, would need complex parsing logic
        message: allowed ? 'Accessible' : `Blocked (HTTP ${response.status})`
      };
    } catch (e: any) {
      return {
        botName: bot.name,
        userAgent: bot.ua,
        httpStatus: null,
        allowed: false,
        allowedInRobotsTxt: true,
        message: `Connection failed: ${e.message}`
      };
    }
  });

  return Promise.all(promises);
}
