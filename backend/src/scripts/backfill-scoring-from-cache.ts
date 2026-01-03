import { consolidatedScoringService } from '../services/scoring/consolidated-scoring.service';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const limit = process.argv[2] ? parseInt(process.argv[2]) : 100;
  
  console.log('🚀 Starting standalone scoring backfill script...');
  console.log(`📊 Limit: ${limit}`);
  
  try {
    const result = await consolidatedScoringService.backfillScoringFromCache(limit);
    
    console.log('\n✅ Backfill completed successfully!');
    console.log(`-----------------------------------`);
    console.log(`Processed:           ${result.processed}`);
    console.log(`Positions Processed: ${result.positionsProcessed}`);
    console.log(`Sentiments Processed: ${result.sentimentsProcessed}`);
    console.log(`Citations Processed: ${result.citationsProcessed}`);
    console.log(`Errors:              ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(err => {
        console.log(`- ID ${err.collectorResultId}: ${err.error}`);
      });
    }
    
    if (result.metrics) {
      console.log('\n📈 Metrics:');
      console.log(`Total Citations:    ${result.metrics.totalCitations}`);
      console.log(`Cached Citations:   ${result.metrics.cachedCitations}`);
      console.log(`Total Occurrences:  ${result.metrics.totalOccurrences}`);
      console.log(`Cached Occurrences: ${result.metrics.cachedOccurrences}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Critical error during backfill:');
    console.error(error);
    process.exit(1);
  }
}

main();
