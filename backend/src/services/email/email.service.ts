import nodemailer from 'nodemailer';
import { config } from '../../config/environment';

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

  async sendOTP(to: string, otp: string): Promise<boolean> {
    try {
      if (!this.transporter) {
        this.initTransporter();
      }
      
      const user = process.env.ZOHO_MAIL_USER;
      if (!user) {
        console.error('❌ Cannot send OTP: ZOHO_MAIL_USER is missing');
        return false;
      }

      const mailOptions = {
        from: user, // sender address
        to: to, // receiver address
        subject: 'Your Password Reset Code - AnswerIntel',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Please use the following code to proceed:</p>
            <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
              <h1 style="letter-spacing: 5px; color: #333; margin: 0;">${otp}</h1>
            </div>
            <p>This code is valid for 10 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
          </div>
        `
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
