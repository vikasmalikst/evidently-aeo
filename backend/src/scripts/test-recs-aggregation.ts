import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { ReportOrchestrationService } from '../services/executive-reporting/report-orchestration.service';
import { DataAggregationService } from '../services/executive-reporting/data-aggregation.service';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

async function testRecommendationAggregation() {
    const brandId = '5a57c430-6940-4198-a1f5-a443cbd044dc';
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 1); // Last year

    console.log(`🧪 Testing Recommendation Aggregation for brand: ${brandId}`);
    console.log(`📅 Period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const aggregator = new DataAggregationService();

    // Test aggregateActionsImpact
    try {
        const result = await aggregator.aggregateActionsImpact(brandId, startDate, endDate);
        console.log('\n📊 Aggregation Result:');
        console.log(JSON.stringify(result.recommendations, null, 2));

        // Detailed check
        const { data: recs } = await supabaseClient
            .from('recommendations')
            .select('*')
            .eq('brand_id', brandId)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

        console.log(`\n🔍 Found ${(recs || []).length} total recommendations in periods.`);

        if (recs && recs.length > 0) {
            console.log('\nSample Recommendation Statuses:');
            recs.slice(0, 5).forEach(r => {
                console.log(`- Action: ${r.action.substring(0, 40)}...`);
                console.log(`  Review Status: ${r.review_status}, is_approved: ${r.is_approved}, is_content_generated: ${r.is_content_generated}, is_completed: ${r.is_completed}`);
            });
        }

    } catch (error) {
        console.error('❌ Error testing aggregation:', error);
    }
}

testRecommendationAggregation();
