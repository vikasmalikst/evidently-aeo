/**
 * Run Hugging Face sentiment scoring for extracted_positions rows
 */

import { sentimentScoringService } from '../services/scoring/sentiment-scoring.service';

async function main() {
  const updated = await sentimentScoringService.scorePending();
  console.log(`\n🎉 Sentiment scoring run complete. Rows updated: ${updated}`);
}

main().catch((error) => {
  console.error('Fatal error during sentiment scoring:', error);
  process.exit(1);
});


