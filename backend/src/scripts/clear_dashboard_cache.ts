/**
 * Script to clear stale dashboard cache entries for a specific brand
 * This is needed after fixing the queryTags caching bug to ensure fresh data is served
 */
import { supabaseAdmin } from '../config/database';

async function clearDashboardCache(brandId?: string) {
    console.log('🧹 Clearing dashboard cache...\n');

    if (brandId) {
        // Clear cache for specific brand
        const { data, error } = await supabaseAdmin
            .from('brand_dashboard_snapshots')
            .delete()
            .eq('brand_id', brandId)
            .select('brand_id, range_start, range_end');

        if (error) {
            console.error('❌ Error clearing cache:', error);
            return;
        }

        console.log(`✅ Cleared ${data?.length || 0} cache entries for brand ${brandId}`);
    } else {
        // Clear all cache (with TTL-based filtering - only clear entries older than 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const { data, error } = await supabaseAdmin
            .from('brand_dashboard_snapshots')
            .delete()
            .lt('computed_at', fiveMinutesAgo)
            .select('brand_id, range_start, range_end');

        if (error) {
            console.error('❌ Error clearing cache:', error);
            return;
        }

        console.log(`✅ Cleared ${data?.length || 0} stale cache entries`);
    }

    console.log('\n🎉 Done! Dashboard cache has been cleared.');
    console.log('\n📝 Next steps:');
    console.log('1. Restart the backend server: `npm run dev` in the backend folder');
    console.log('2. Clear browser localStorage (DevTools > Application > Storage > Clear site data)');
    console.log('3. Refresh the dashboard page');
}

// Get brand ID from command line args
const brandId = process.argv[2];
clearDashboardCache(brandId).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
