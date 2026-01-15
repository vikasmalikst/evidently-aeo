
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { SourceAttributionService } from '../services/source-attribution.service';
import { supabaseAdmin } from '../config/database'; // Adjust import if needed

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function debugServiceFull() {
    console.log('🔍 Debugging SourceAttributionService Full Flow...');

    // 1. Setup
    const service = new SourceAttributionService();
    const BRAND_NAMELIKE = 'Nike';

    // 2. Get Brand & Customer
    const { data: brands } = await supabaseAdmin.from('brands').select('id, name, customer_id').ilike('name', `%${BRAND_NAMELIKE}%`);

    // Filter for the one with citations
    let brand = null;
    let maxCitations = -1;
    for (const b of (brands || [])) {
        const { count } = await supabaseAdmin.from('citations').select('*', { count: 'exact', head: true }).eq('brand_id', b.id);
        if ((count || 0) > maxCitations) {
            maxCitations = count || 0;
            brand = b;
        }
    }

    if (!brand) { console.error('Brand not found'); return; }
    console.log(`✅ Selected Brand: ${brand.name} (${brand.id}) Customer: ${brand.customer_id}`);

    // 3. Define Dates
    const currentStart = '2026-01-08';
    const currentEnd = '2026-01-14';

    // Explicit comparison range (Prior 7 days)
    const priorStart = '2026-01-01'; // Jan 1
    const priorEnd = '2026-01-07';   // Jan 7

    console.log(`📅 Current: ${currentStart} to ${currentEnd}`);
    console.log(`📅 Prior:   ${priorStart} to ${priorEnd}`);

    try {
        // 4. Call Service
        const result = await service.getSourceAttribution(
            brand.id,
            brand.customer_id,
            { start: currentStart, end: currentEnd },
            { start: priorStart, end: priorEnd }
        );

        console.log('\n✅ Service returned!');
        console.log(`Total Sources: ${result.sources.length}`);

        // 5. Inspect Specific Sources
        const checkSources = ['runrepeat.com', 'reddit.com', 'nike.com'];
        console.log('\n--- Inspection ---');

        checkSources.forEach(domain => {
            const s = result.sources.find(src => src.name.includes(domain));
            if (s) {
                console.log(`Source: ${pad(s.name, 20)} | SOA: ${pad(s.soa, 5)} | Change: ${pad(s.soaChange, 5)} | AvgPos: ${pad(s.averagePosition, 5)} | Change: ${pad(s.averagePositionChange, 5)}`);
            } else {
                console.log(`Source: ${pad(domain, 20)} | NOT FOUND`);
            }
        });

        // 6. Check if it was cached?
        // The service doesn't return cache status, but if it was fast/instant it might be. 
        // We can check the DB for cache entry separately if needed.

    } catch (e) {
        console.error('❌ Service Error:', e);
    }
}

function pad(val: any, len: number) {
    return String(val).padEnd(len);
}

debugServiceFull().catch(console.error);
