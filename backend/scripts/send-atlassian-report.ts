
import dotenv from 'dotenv';
import path from 'path';
import { emailServiceV2 } from '../src/services/email/email-v2.service';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

async function sendAtlassianReport() {
  const brandId = '5ce3fc1c-24c6-4434-a76e-72ad159030e9';
  const reportId = '8628b182-b0db-4b3a-902c-ceb441ed17c2';
  const brandName = 'Atlassian Jira';
  const testEmail = 'vmalik9@gmail.com';

  console.log(`📧 [TEST] Sending Atlassian Jira report to ${testEmail}...`);
  console.log('ZOHO_EMAIL:', process.env.ZOHO_EMAIL ? 'Set' : 'Missing');
  console.log('ZOHO_PASSWORD:', process.env.ZOHO_PASSWORD ? 'Set' : 'Missing');

  try {
    await emailServiceV2.sendExecutiveReport(testEmail, reportId, brandId, brandName);
    console.log('✅ Email sent successfully!');
  } catch (error) {
    console.error('❌ Failed to send email:', error);
  }
}

sendAtlassianReport();
