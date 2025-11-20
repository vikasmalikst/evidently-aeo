/**
 * Run Hugging Face sentiment scoring for extracted_positions rows
 */

import { sentimentScoringService } from '../services/scoring/sentiment-scoring.service';

async function main() {
  const updated = await sentimentScoringService.scorePending({
    limit:200,
    customerId:'4522adf5-81bc-496b-b64a-23370a048c44',
    brandIds:['1d3a41cc-e83f-45ff-887f-8eb66d4eaadc'],
  });
  console.log(`\n🎉 Sentiment scoring run complete. Rows updated: ${updated}`);
}

main().catch((error) => {
  console.error('Fatal error during sentiment scoring:', error);
  process.exit(1);
});


