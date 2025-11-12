#!/usr/bin/env node
/**
 * Extract Brand and Competitor Positions
 * 
 * This script extracts mention positions from collector results and stores them
 * in the extracted_positions table. It's separate from scoring logic.
 * 
 * Usage:
 *   npm run positions:extract
 * 
 * Features:
 * - ✅ Skips already-processed results
 * - ✅ Product name caching (40% token savings)
 * - ✅ Answer truncation (50% token savings)
 * - ✅ Cerebras primary, Gemini fallback
 * - ✅ Graceful error handling
 */

import dotenv from 'dotenv';
import { positionExtractionService } from '../services/scoring/position-extraction.service';

// Load environment variables
dotenv.config();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          🎯 Brand & Competitor Position Extraction             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    const processed = await positionExtractionService.extractPositionsForNewResults();
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                        ✅ COMPLETE!                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Processed ${processed} collector results`);
    console.log('\n💡 Next steps:');
    console.log('   1. View results: SELECT * FROM extracted_positions;');
    console.log('   2. Check positions: SELECT brand_name, brand_first_position, brand_positions FROM extracted_positions;');
    console.log('   3. Run scoring: npm run scores:compute\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during position extraction:');
    console.error(error instanceof Error ? error.message : error);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check API keys: CEREBRAS_API_KEY or GEMINI_API_KEY');
    console.error('   2. Check database: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    console.error('   3. Run migration: cd supabase && supabase db push');
    console.error('   4. Check rate limits: Wait 24 hours or use paid tier\n');
    
    process.exit(1);
  }
}

main();

