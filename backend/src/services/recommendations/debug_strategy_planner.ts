
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from backend root
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { strategyPlanner } from './strategy-planner.service';

async function testStrategyPlanner() {
    console.log('🧪 Testing StrategyPlanner...');

    const brandContext = {
        name: 'TechFlow Analytics',
        industry: 'SaaS / Data Analytics',
        competitors: ['OldSchool BI', 'SpreadsheetMaster']
    };

    const topic = 'AI-Powered Predictive Analytics';
    const contentType = 'article';

    try {
        const angle = await strategyPlanner.generateStrategicAngle(brandContext, topic, contentType);
        console.log('\n✅ Strategy Generated Successfully:');
        console.log(JSON.stringify(angle, null, 2));
    } catch (error) {
        console.error('\n❌ Test Failed:', error);
    }
}

testStrategyPlanner();
