
import { supabase } from '../config/supabase';

async function debugInsiderSports() {
    console.log('🔍 Debugging InsiderSports...');

    // 1. Get Brand ID
    const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('id, name')
        .ilike('name', '%InsiderSport%') // Try fuzzy match just in case
        .limit(1)
        .single();

    if (brandError || !brand) {
        console.error('❌ Brand not found:', brandError);
        return;
    }

    console.log(`✅ Found Brand: ${brand.name} (${brand.id})`);

    // 2. Get Latest Audit
    const { data: audit, error: auditError } = await supabase
        .from('domain_readiness_audits')
        .select('*')
        .eq('brand_id', brand.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (auditError || !audit) {
        console.error('❌ Audit not found:', auditError);

        // Check old table just in case
        console.log('Checking legacy table...');
        const { data: legacyAudit } = await supabase
            .from('domain_readiness_results')
            .select('*')
            .eq('brand_id', brand.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (legacyAudit) {
            console.log('⚠️ Found in legacy table (domain_readiness_results):', {
                id: legacyAudit.id,
                scores: legacyAudit.scores,
                bot_access_length: legacyAudit.bot_access?.length
            });
        }
        return;
    }

    console.log('✅ Found Audit:', {
        id: audit.id,
        created_at: audit.created_at,
        overall_score: audit.overall_score,
        scores: audit.scores,
        bot_access_count: audit.bot_access?.length,
        bot_access_allowed: audit.bot_access?.filter((b: any) => b.allowed).length
    });

    console.log('Bot Access Details:', JSON.stringify(audit.bot_access, null, 2));
}

debugInsiderSports();
