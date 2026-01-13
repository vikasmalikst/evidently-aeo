import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

export interface DemoRequestData {
  name: string;
  email: string;
  company: string;
  jobTitle: string;
  message?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 465,
      secure: true, // use SSL
      auth: {
        user: process.env.ZOHO_EMAIL,
        pass: process.env.ZOHO_PASSWORD,
      },
    });
  }

  private async loadTemplate(templateName: string, data: Record<string, string>): Promise<string> {
    const templatePath = path.join(process.cwd(), 'src', 'templates', `${templateName}.html`);
    let html = fs.readFileSync(templatePath, 'utf-8');

    // Replace placeholders
    Object.keys(data).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, data[key] || '');
    });

    return html;
  }

  public async sendDemoRequest(data: DemoRequestData): Promise<void> {
    const htmlDate = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    const html = await this.loadTemplate('demo-request', {
      name: data.name,
      email: data.email,
      company: data.company,
      jobTitle: data.jobTitle,
      message: data.message || 'No specific message provided.',
      date: htmlDate
    });

    const mailOptions = {
      from: `"EvidentlyAEO Demo Bot" <${process.env.ZOHO_EMAIL}>`,
      to: ['sales.support@evidentlyAEO.com', 'vikas.malik@evidentlyaeo.com'],
      subject: `New Demo Request: ${data.company} (${data.name})`,
      html: html,
      replyTo: data.email
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Demo request email sent successfully for ${data.email}`);
    } catch (error) {
      console.error('Error sending demo request email:', error);
      throw new Error('Failed to send email');
    }
  }
}
