
import dotenv from 'dotenv';
import path from 'path';
import { PositionExtractionService } from '../services/scoring/position-extraction.service';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const positionExtractionService = new PositionExtractionService();

async function main() {
    const resultIdArg = process.argv.find(a => a.startsWith('--id='));
    const resultId = resultIdArg ? parseInt(resultIdArg.split('=')[1]) : undefined;

    if (!resultId) {
        console.error('Usage: ts-node src/scripts/debug-scoring-logic.ts --id=<collector_result_id>');
        process.exit(1);
    }

    console.log(`\n🔎 Debugging Scoring Logic for Collector Result ID: ${resultId}`);

    try {
        // 1. Fetch the raw payload to see what the service sees
        console.log('   Running extractPositionPayloadForBatch...');
        const payload = await positionExtractionService.extractPositionPayloadForBatch(resultId);

        if (!payload) {
            console.error('   ❌ Failed to extract payload (result not found or extraction invalid)');
            return;
        }

        const { brandRow, productNames } = payload;

        console.log('\n📊 Extraction Summary:');
        console.log('   Brand Name:', brandRow.brand_name);
        console.log('   Extracted/Cached Products:', productNames);
        console.log('   Total Brand Mentions:', brandRow.total_brand_mentions);
        console.log('   Visibility Index:', brandRow.visibility_index);
        console.log('   Brand Positions:', brandRow.brand_positions);
        console.log('   Has Brand Presence:', brandRow.has_brand_presence);

        console.log('\n📝 Raw Answer Snippet (First 200 chars):');
        console.log(`   "${brandRow.raw_answer.substring(0, 200)}..."`);

        // Check key terms
        const brandLower = brandRow.brand_name.toLowerCase();
        const answerLower = brandRow.raw_answer.toLowerCase();

        console.log('\n🕵️  Manual Check:');
        console.log(`   Does answer contain brand '${brandLower}'?`, answerLower.includes(brandLower));
        if (productNames && productNames.length > 0) {
            productNames.forEach(p => {
                console.log(`   Does answer contain product '${p.toLowerCase()}'?`, answerLower.includes(p.toLowerCase()));
            });
        } else {
            console.log('   ⚠️  No products loaded for checking.');
        }

    } catch (error) {
        console.error('Debug script failed', error);
    }
}

main();
