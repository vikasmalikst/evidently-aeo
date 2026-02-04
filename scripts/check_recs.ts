import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../backend/.env') })

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRecs() {
    console.log('Checking recs...');
    const brandId = '5a5c6aa7-1e1b-41c6-bd6c-f36e1c96a699';

    // Check total count
    const { count: total, error: countError } = await supabase
        .from('recommendations')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId);

    console.log('Total recs for brand:', total, countError);

    // Check brand ownership
    const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('id, customer_id')
        .eq('id', brandId)
        .single();
    console.log('Brand ownership:', brand, brandError);

    const { data, error } = await supabase
        .from('recommendations')
        .select('id, brand_id, query_id, customer_id, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(10)

    if (error) {
        console.error(error)
        return
    }

    console.log('Latest 10 recs:', JSON.stringify(data, null, 2))

    if (data && data.length > 0) {
        const withQuery = data.filter((r: any) => r.query_id);
        console.log('Recs with query_id in top 10:', withQuery.length);
        if (withQuery.length > 0) {
            const qId = withQuery[0].query_id;
            console.log('Checking generated_queries for:', qId);
            const { data: qData, error: qError } = await supabase
                .from('generated_queries')
                .select('id, customer_id')
                .eq('id', qId)
                .single();
            console.log('Query Data:', qData, qError);
        }
    }
}

checkRecs()
