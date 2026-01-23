
import dotenv from 'dotenv';
import path from 'path';
import { EmailService } from '../src/services/email/email.service';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testEmail() {
  console.log('Testing Email Service...');
  console.log('ZOHO_EMAIL:', process.env.ZOHO_EMAIL ? 'Set' : 'Missing');
  console.log('ZOHO_PASSWORD:', process.env.ZOHO_PASSWORD ? 'Set' : 'Missing');

  const emailService = new EmailService();
  const to = 'vmalik9@gmail.com';
  const otp = '123456';

  console.log(`Sending test email to ${to}...`);
  const success = await emailService.sendOTP(to, otp);

  if (success) {
    console.log('✅ Email sent successfully!');
  } else {
    console.error('❌ Failed to send email.');
  }
}

testEmail().catch(console.error);
