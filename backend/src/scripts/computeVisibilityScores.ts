#!/usr/bin/env ts-node
import 'dotenv/config';
import VisibilityScoreService from '../services/visibility-score.service';

async function main() {
  try {
    const service = new VisibilityScoreService();
    const count = await service.computeAndUpsertForLatestResults();
    // eslint-disable-next-line no-console
    console.log(`Upserted ${count} score rows.`);
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to compute visibility scores:', err);
    process.exit(1);
  }
}

main();


