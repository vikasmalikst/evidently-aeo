
import dotenv from 'dotenv';
import path from 'path';

// Load env vars explicitly
const envPath = path.join(__dirname, '../../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

// Also try loading from backend root if needed
const backendEnvPath = path.join(__dirname, '../.env');
dotenv.config({ path: backendEnvPath });

console.log('ZOHO_MAIL_USER:', process.env.ZOHO_MAIL_USER);
console.log('ZOHO_MAIL_PASSWORD:', process.env.ZOHO_MAIL_PASSWORD ? '******' : 'undefined');

async function run() {
  try {
    // Dynamic import to ensure env vars are loaded first
    const { emailService } = await import('../src/services/email/email.service');
    
    console.log('Attempting to send email to vmalik9@gmail.com...');
    const result = await emailService.sendOTP('vmalik9@gmail.com', '123456');
    
    if (result) {
      console.log('✅ Email sent successfully!');
    } else {
      console.error('❌ Email sending failed.');
    }
  } catch (error) {
    console.error('❌ Error running test:', error);
  }
}

run();
