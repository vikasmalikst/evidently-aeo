import 'dotenv/config';
import { brandSentimentService } from '../services/scoring/sentiment/brand-sentiment.service';
import { competitorSentimentService } from '../services/scoring/sentiment/competitor-sentiment.service';

function getArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const withEquals = args.find((a) => a.startsWith(`${name}=`));
  if (withEquals) return withEquals.split('=')[1];
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}

async function main() {
  const brandId =
    process.env.BRAND_ID ||
    getArg('--brandId') ||
    '0fa491bf-3b62-45a3-b498-8241b6bf689d';
  const customerId =
    process.env.CUSTOMER_ID ||
    getArg('--customerId') ||
    '157c845c-9e87-4146-8479-cb8d045212bf';
  const since = process.env.SINCE || getArg('--since');
  const limitRaw = process.env.SENTIMENT_LIMIT || getArg('--limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;

  if (!brandId || !customerId) {
    console.error('Usage: --brandId=<id> --customerId=<id> [--since=ISO] [--limit=150]');
    process.exit(1);
  }

  const options = { brandIds: [brandId], customerId, since, limit };

  console.log('\n🎯 Sentiment-only run (extracted_positions)');
  console.log(`   ▶ brandId: ${brandId}`);
  console.log(`   ▶ customerId: ${customerId}`);
  if (since) console.log(`   ▶ since: ${since}`);
  if (limit) console.log(`   ▶ limit: ${limit}`);

  const brandCount = await brandSentimentService.scoreBrandSentiment(options);
  const competitorCount = await competitorSentimentService.scoreCompetitorSentiment(options);

  console.log('\n✅ Done');
  console.log(`   ▶ Brand sentiment rows updated: ${brandCount}`);
  console.log(`   ▶ Competitor sentiment rows updated: ${competitorCount}`);
}

main().catch((err) => {
  console.error('Fatal error during sentiment scoring:', err);
  process.exit(1);
});
