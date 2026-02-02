import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/environment';

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

async function findBrand() {
    const { data, error } = await supabase
        .from('brands')
        .select('id, name')
        .ilike('name', '%Insidersport%');

    console.log(data);
}

findBrand();
