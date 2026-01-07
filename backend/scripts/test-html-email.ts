
import { loadEnvironment } from '../src/utils/env-utils';

// Load environment variables before anything else
loadEnvironment();

console.log('Testing HTML Email Template...');

async function runTest() {
  try {
    // Dynamic import to ensure env vars are loaded first
    const { emailService } = await import('../src/services/email/email.service');
    const { otpService } = await import('../src/services/auth/otp.service');

    const testEmail = 'vmalik9@gmail.com';
    const otp = await otpService.createOTP(testEmail);
    
    console.log(`Sending Signup OTP to ${testEmail}...`);
    // This calls emailService.sendOTP which uses getOTPTemplate('signup')
    const sent = await emailService.sendOTP(testEmail, otp, 'signup');
    
    if (sent) {
        console.log('✅ Signup OTP Email sent successfully!');
        console.log('Please check your inbox for the "Verify your email - EvidentlyAEO" email.');
    } else {
        console.error('❌ Failed to send email.');
    }

  } catch (error) {
    console.error('Test script error:', error);
  }
}

runTest();
