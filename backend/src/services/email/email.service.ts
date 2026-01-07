import nodemailer from 'nodemailer';
import { config } from '../../config/environment';
import { getOTPTemplate } from './templates';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    // Check if Zoho credentials are configured, otherwise log a warning
    const user = process.env.ZOHO_MAIL_USER;
    const pass = process.env.ZOHO_MAIL_PASSWORD;

    if (!user || !pass) {
      console.warn('⚠️ Zoho Mail credentials not found in environment variables. Email sending will fail.');
      console.warn('Current ZOHO_MAIL_USER:', user);
      console.warn('Current ZOHO_MAIL_PASSWORD:', pass ? '******' : 'undefined');
    } else {
      console.log('✅ Zoho Mail credentials configured for:', user);
    }

    this.transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 465,
      secure: true, // use SSL
      auth: {
        user: user,
        pass: pass
      }
    });
  }

  async sendOTP(to: string, otp: string, type: 'signup' | 'reset' = 'reset'): Promise<boolean> {
    try {
      if (!this.transporter) {
        this.initTransporter();
      }
      
      const user = process.env.ZOHO_MAIL_USER;
      if (!user) {
        console.error('❌ Cannot send OTP: ZOHO_MAIL_USER is missing');
        return false;
      }

      const subject = type === 'signup' 
        ? 'Verify your email - EvidentlyAEO' 
        : 'Your Password Reset Code - EvidentlyAEO';

      const html = getOTPTemplate(otp, type);

      const mailOptions = {
        from: `"EvidentlyAEO" <${user}>`, // Use friendly name
        to: to, // receiver address
        subject: subject,
        html: html
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Message sent: %s', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
