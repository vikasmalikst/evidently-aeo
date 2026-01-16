import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') })

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRecs() {
    const { data, error } = await supabase
        .from('recommendations')
        .select('id, brand_id, action, is_completed, completed_at')
        .eq('is_completed', true)
        .limit(10)

    if (error) {
        console.error(error)
        return
    }

    console.log(JSON.stringify(data, null, 2))
}

checkRecs()
