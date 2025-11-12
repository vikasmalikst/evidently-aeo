#!/usr/bin/env ts-node
/**
 * CLI script to extract citations from collector_results and store them in citations table
 */

import 'dotenv/config';
import { citationExtractionService } from '../services/citations/citation-extraction.service';

async function main() {
  try {
    console.log('🚀 Starting citation extraction...\n');
    
    const stats = await citationExtractionService.extractAndStoreCitations();
    
    console.log('\n✅ Citation extraction complete!');
    console.log(`📊 Statistics:`);
    console.log(`   - Processed: ${stats.processed} collector results`);
    console.log(`   - Inserted: ${stats.inserted} citations`);
    console.log(`   - Skipped: ${stats.skipped} results (no citations)`);
    console.log(`   - Errors: ${stats.errors}`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

