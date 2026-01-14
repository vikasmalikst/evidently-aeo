
import { supabase } from '../config/supabase';

async function debugSanDisk() {
    console.log('🔍 Debugging SanDisk...');

    // 1. Get Brand ID
    const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('id, name')
        .ilike('name', '%SanDisk%')
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
        console.error('❌ Audit not found');
        return;
    }

    const scores = audit.scores || {};
    const botAccess = audit.bot_access || [];
    const allowedBots = botAccess.filter((b: any) => b.allowed).length;
    const totalBots = botAccess.length;
    const botScore = totalBots ? Math.round((allowedBots / totalBots) * 100) : 0;

    console.log('✅ Found Audit:', {
        id: audit.id,
        created_at: audit.created_at,
        overall_score: audit.overall_score,
        sub_scores: scores,
        bot_access: { allowed: allowedBots, total: totalBots, score: botScore }
    });

    // 3. Verify Math
    // Tech: 15%, Content: 25%, Semantic: 20%, Access: 15%, AEO: 10%, Bot: 15%
    const tech = scores.technicalCrawlability || 0;
    const content = scores.contentQuality || 0;
    const semantic = scores.semanticStructure || 0;
    const access = scores.accessibilityAndBrand || 0;
    const aeo = scores.aeoOptimization || 0;

    const weightedSum = (
        tech * 0.15 +
        content * 0.25 +
        semantic * 0.20 +
        access * 0.15 +
        aeo * 0.10 +
        botScore * 0.15
    );

    console.log('🧮 Calculated Weighted Score:', weightedSum);
    console.log('🧮 Rounded:', Math.round(weightedSum));
    console.log('💾 Stored Overall:', audit.overall_score);

    if (Math.round(weightedSum) !== audit.overall_score) {
        console.error('❌ DISCREPANCY DETECTED');
    } else {
        console.log('✅ Math checks out');
    }
}

debugSanDisk();
