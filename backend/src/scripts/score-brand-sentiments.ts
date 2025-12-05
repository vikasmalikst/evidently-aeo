/**
 * Run brand + competitor sentiment scoring for a single brand from the terminal.
 *
 * Usage:
 *   ts-node --transpile-only src/scripts/score-brand-sentiments.ts --brandId=<id> --customerId=<id> [--since=ISO] [--positionLimit=50] [--sentimentLimit=30] [--parallel=false]
 *
 * Env overrides:
 *   BRAND_ID, CUSTOMER_ID, SINCE, POSITION_LIMIT, SENTIMENT_LIMIT, PARALLEL
 */

import { brandScoringService } from '../services/scoring/brand-scoring.orchestrator';

function getArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const withEquals = args.find((a) => a.startsWith(`${name}=`));
  if (withEquals) return withEquals.split('=')[1];

  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

async function main() {
  const brandId = process.env.BRAND_ID || getArg('--brandId');
  const customerId = process.env.CUSTOMER_ID || getArg('--customerId');
  const since = process.env.SINCE || getArg('--since');

  const positionLimitRaw = process.env.POSITION_LIMIT || getArg('--positionLimit');
  const sentimentLimitRaw = process.env.SENTIMENT_LIMIT || getArg('--sentimentLimit');
  const parallelRaw = process.env.PARALLEL || getArg('--parallel');

  if (!brandId || !customerId) {
    console.error('Usage: --brandId=<id> --customerId=<id> [--since=ISO] [--positionLimit=50] [--sentimentLimit=30] [--parallel=false]');
    process.exit(1);
  }

  const positionLimit = positionLimitRaw ? parseInt(positionLimitRaw, 10) : undefined;
  const sentimentLimit = sentimentLimitRaw ? parseInt(sentimentLimitRaw, 10) : undefined;
  const parallel = parallelRaw ? parallelRaw.toLowerCase() === 'true' : false;

  console.log('\n🎯 Starting brand scoring (positions + sentiments + competitor sentiments)...');
  console.log(`   ▶ brandId: ${brandId}`);
  console.log(`   ▶ customerId: ${customerId}`);
  if (since) console.log(`   ▶ since: ${since}`);
  if (positionLimit) console.log(`   ▶ positionLimit: ${positionLimit}`);
  if (sentimentLimit) console.log(`   ▶ sentimentLimit: ${sentimentLimit}`);
  console.log(`   ▶ parallel: ${parallel}`);

  const result = await brandScoringService.scoreBrand({
    brandId,
    customerId,
    since,
    positionLimit,
    sentimentLimit,
    parallel,
  });

  console.log('\n✅ Brand scoring complete:');
  console.log(`   ▶ Positions processed: ${result.positionsProcessed}`);
  console.log(`   ▶ Sentiments processed: ${result.sentimentsProcessed}`);
  console.log(`   ▶ Competitor sentiments processed: ${result.competitorSentimentsProcessed}`);
  console.log(`   ▶ Citations processed: ${result.citationsProcessed}`);
  if (result.errors.length > 0) {
    console.log('   ⚠️  Errors:');
    for (const err of result.errors) {
      console.log(`   - ${err.operation}: ${err.error}`);
    }
  }
}

main().catch((error) => {
  console.error('Fatal error during brand sentiment scoring:', error);
  process.exit(1);
});


