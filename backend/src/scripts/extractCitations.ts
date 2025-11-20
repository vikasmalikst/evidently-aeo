#!/usr/bin/env ts-node
/**
 * CLI script to extract citations from collector_results and store them in citations table
 * 
 * Usage:
 *   npm run citations:extract                    # Extract for all brands
 *   npm run citations:extract -- --brand-id=xxx  # Extract for specific brand
 */

import 'dotenv/config';
import { citationExtractionService } from '../services/citations/citation-extraction.service';

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let brandId: string | undefined;
    
    for (const arg of args) {
      if (arg.startsWith('--brand-id=')) {
        brandId = arg.split('=')[1];
      } else if (arg === '--brand-id' && args[args.indexOf(arg) + 1]) {
        brandId = args[args.indexOf(arg) + 1];
      }
    }

    if (brandId) {
      console.log(`🚀 Starting citation extraction for brand_id: ${brandId}...\n`);
    } else {
      console.log('🚀 Starting citation extraction for all brands...\n');
    }
    
    const stats = await citationExtractionService.extractAndStoreCitations(brandId);
    
    console.log('\n✅ Citation extraction complete!');
    console.log(`📊 Statistics:`);
    console.log(`   - Processed: ${stats.processed} collector results`);
    console.log(`   - Inserted: ${stats.inserted} citations`);
    console.log(`   - Skipped: ${stats.skipped} results (no citations)`);
    console.log(`   - Errors: ${stats.errors}`);
    
    if (brandId) {
      console.log(`\n💡 Tip: To extract for all brands, run without --brand-id flag`);
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

