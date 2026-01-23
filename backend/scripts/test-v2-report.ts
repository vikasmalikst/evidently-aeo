
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load env vars first
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testV2Reporting() {
  // Dynamically import services after env vars are loaded
  const { pdfExportServiceV2 } = await import('../src/services/executive-reporting/pdf-export-v2.service');
  const { emailServiceV2 } = await import('../src/services/email/email-v2.service');

  console.log('🧪 Testing V2 Reporting System...');

  // 1. Get "SanDisk" Brand
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, name')
    .ilike('name', '%SanDisk%')
    .single();

  if (brandError || !brand) {
    console.error('❌ Brand "SanDisk" not found.');
    return;
  }

  console.log(`📌 Using Brand: ${brand.name} (${brand.id})`);

  // 2. Get latest report for this brand
  const { data: reports, error: reportError } = await supabase
    .from('executive_reports')
    .select('id, brand_id, report_period_start, report_period_end')
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (reportError || !reports || reports.length === 0) {
    console.error(`❌ No executive reports found for brand ${brand.name}.`);
    console.log('Please generate a report via the UI first.');
    return;
  }
  
  const report = reports[0];
  console.log(`📌 Using Report: ${report.id} (${report.report_period_start} to ${report.report_period_end})`);

  try {
    // 3. Test PDF Generation
    console.log('📄 Generating PDF (V2)...');
    const pdfBuffer = await pdfExportServiceV2.generatePDF(report.id, brand.id);
    
    const pdfPath = path.join(__dirname, `test-report-${brand.name.replace(/\s+/g, '_')}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`✅ PDF saved to: ${pdfPath}`);

    // 4. Test Email Sending (Optional - change email to test)
    const testEmail = 'vikas.malik@evidentlyaeo.com'; // Change this if needed
    console.log(`📧 Sending Email (V2) to ${testEmail}...`);
    
    // We mock the sendMail if we don't want to spam, but let's try real send if creds exist
    if (process.env.ZOHO_EMAIL && process.env.ZOHO_PASSWORD) {
        await emailServiceV2.sendExecutiveReport(testEmail, report.id, brand.id, brand.name);
        console.log('✅ Email sent successfully.');
    } else {
        console.log('⚠️ Skipping email send (missing ZOHO credentials).');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testV2Reporting();
