
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findAtlassianJira() {
  const brandId = '5ce3fc1c-24c6-4434-a76e-72ad159030e9';
  
  const { data: reports, error } = await supabase
    .from('executive_reports')
    .select('id, brand_id, report_period_start, report_period_end, generated_at')
    .eq('brand_id', brandId)
    .order('generated_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching reports:', error);
    return;
  }

  console.log('Reports found for Atlassian Jira:', reports);
}

findAtlassianJira();
