import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log("Checking brands...");
  const { data: brands, error } = await supabase.from("brands").select("id, name").limit(5);
  if (error) console.error(error);
  else console.log(JSON.stringify(brands, null, 2));

  if (brands && brands.length > 0) {
      // Use Nike ID for testing positive case
      const brandId = '0fa491bf-3b62-45a3-b498-8241b6bf689d'; // Nike
      const brandName = 'Nike';
      console.log(`\nChecking stats for brand: ${brandName} (${brandId})`);
      
      // 1. Total Results
      const { count: total } = await supabase
        .from('collector_results')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId);
      console.log(`Total collector_results: ${total}`);

      // 2. With raw_answer
      const { count: withRaw } = await supabase
        .from('collector_results')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .not('raw_answer', 'is', null);
      console.log(`With raw_answer: ${withRaw}`);

      // 3. With Cache (Inner Join)
      const { count: withCache, error: cacheError } = await supabase
        .from('collector_results')
        .select('consolidated_analysis_cache!inner(collector_result_id)', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .not('raw_answer', 'is', null);
        
      if (cacheError) console.error("Cache query error:", cacheError);
      console.log(`With cached analysis: ${withCache}`);
      
      // 4. Check Date Range (Last 60 days to cover sample dates)
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      console.log(`\nChecking range: ${startDate} to ${endDate}`);
      
      const { count: inRange, error: rangeError } = await supabase
        .from('collector_results')
        .select('id', { count: 'exact', head: true }) // Removed inner join
        .eq('brand_id', brandId)
        .not('raw_answer', 'is', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate);
        
      if (rangeError) console.error("Range query error:", rangeError);
      console.log(`In date range (raw): ${inRange}`);

      const { count: inRangeCache } = await supabase
        .from('collector_results')
        .select('consolidated_analysis_cache!inner(collector_result_id)', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .not('raw_answer', 'is', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      console.log(`In date range (with cache): ${inRangeCache}`);
      
      // 5. Show some created_at dates
      const { data: dates } = await supabase
        .from('collector_results')
        .select('created_at')
        .eq('brand_id', brandId)
        .limit(5)
        .order('created_at', { ascending: false });
      console.log("\nSample dates:", dates);
  }
}
main();
