
import puppeteer, { Browser, Page } from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { supabaseAdmin } from '../../config/database';
import jwt from 'jsonwebtoken';

export class PdfExportServiceV2 {
  private browser: Browser | null = null;
  private baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  /**
   * Get a valid user and generate a JWT token for the brand owner
   */
  private async getAuthContext(brandId: string) {
    // 1. Get Brand's Customer ID
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('customer_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand || !brand.customer_id) {
      console.warn('⚠️ Could not find customer for brand, falling back to finding ANY customer');
      // Fallback: find any customer
      const { data: customers } = await supabaseAdmin
        .from('customers')
        .select('*')
        .limit(1);

      if (customers && customers.length > 0) {
        return this.generateTokenForCustomer(customers[0]);
      }
      throw new Error('No customers found in DB');
    }

    // 2. Get Customer
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', brand.customer_id)
      .single();

    if (customerError || !customer) {
      throw new Error(`Customer ${brand.customer_id} not found`);
    }

    return this.generateTokenForCustomer(customer);
  }

  private generateTokenForCustomer(customer: any) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not found in env');

    const token = jwt.sign(
      {
        sub: customer.id,
        email: customer.email,
        customer_id: customer.id,
        role: 'admin', // Claim admin just in case, though DB check matters
        type: 'access'
      },
      secret,
      {
        expiresIn: '1d',
        issuer: 'answerintel-backend',
        audience: 'answerintel-frontend'
      }
    );

    // Construct user object as expected by frontend
    const user = {
      id: customer.id,
      email: customer.email,
      full_name: customer.name,
      role: 'admin',
      customer_id: customer.id,
      access_level: customer.access_level || 'user'
    };

    return { user, token };
  }

  async generatePDF(reportId: string, brandId: string): Promise<Buffer> {
    console.log(`📄 [PDF-EXPORT-V2] Generating PDF for report ${reportId} (Brand: ${brandId})`);

    // 1. Get Auth Context
    const { user: authUser, token: authToken } = await this.getAuthContext(brandId);

    const getExecutablePath = () => {
      if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
      return process.platform === 'linux'
        ? '/usr/bin/google-chrome'
        : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    };

    const browser = await puppeteer.launch({
      executablePath: getExecutablePath(), // Dynamic path based on OS
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1024', '--ignore-certificate-errors']
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 1024, deviceScaleFactor: 2 });

      // 3. Inject Auth & State
      const futureTime = Date.now() + 3600 * 1000 * 24; // 24 hours from now

      await page.evaluateOnNewDocument((user, bId, token, expiry) => {
        // Auth User
        // @ts-ignore
        window.localStorage.setItem('auth.user', JSON.stringify(user));

        // API Client Tokens
        // @ts-ignore
        window.localStorage.setItem('access_token', token);
        // @ts-ignore
        window.localStorage.setItem('refresh_token', 'mock-refresh-token');
        // @ts-ignore
        window.localStorage.setItem('access_token_expires_at', String(expiry));

        // Selected Brand
        // @ts-ignore
        window.localStorage.setItem('manual-dashboard:selected-brand', bId);

        // Onboarding complete to skip redirects
        // @ts-ignore
        window.localStorage.setItem('onboarding_complete', 'true');
      }, authUser, brandId, authToken, futureTime);

      // Enable console logging from the browser
      page.on('console', msg => console.log('PAGE LOG:', msg.text()));
      page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
      page.on('requestfailed', request => {
        console.log(`PAGE REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText}`);
      });

      // 2. Navigate to the page
      // Use PDF_RENDER_URL if available (for internal loopback), otherwise default to baseUrl
      const baseUrl = process.env.PDF_RENDER_URL || this.baseUrl;
      const url = `${baseUrl}/executive-reporting?brandId=${brandId}&reportId=${reportId}&printMode=true`;
      console.log(`🔗 [PDF-EXPORT-V2] Navigating to ${url}`);

      await page.goto(url, {
        waitUntil: 'networkidle0', // Wait for API calls to finish
        timeout: 60000, // 60s timeout
      });

      // 3. Wait for the report to be fully rendered
      try {
        await page.waitForSelector('.executive-metrics-grid', { timeout: 30000 });
      } catch (e) {
        console.error('❌ [PDF-EXPORT-V2] Timeout waiting for .executive-metrics-grid');
        const content = await page.content();
        console.log('--- PAGE CONTENT DUMP (First 1000 chars) ---');
        console.log(content.substring(0, 1000));
        console.log('--- END DUMP ---');
        throw e;
      }

      // Additional wait to ensure charts (if animated) are settled
      await new Promise(r => setTimeout(r, 2000));

      // 4. Generate PDF
      // A4 width is approx 794px at 96 DPI. Viewport is 1280px.
      // We need to scale down to fit the content: 794/1280 ≈ 0.62
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        scale: 0.6,
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size: 10px; padding-left: 20px;">Executive AEO Performance Report</div>',
        footerTemplate: '<div style="font-size: 10px; padding-left: 20px; width: 100%; text-align: center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
        margin: {
          top: '20px',
          bottom: '40px',
          left: '20px',
          right: '20px'
        }
      });

      console.log(`✅ [PDF-EXPORT-V2] PDF generated successfully`);
      return Buffer.from(pdf);

    } catch (error) {
      console.error('❌ [PDF-EXPORT-V2] Error generating PDF:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * Capture a screenshot of the report for Email embedding
   */
  async captureScreenshot(reportId: string, brandId: string): Promise<Buffer> {
    console.log(`📸 [PDF-EXPORT-V2] Capturing screenshot for report ${reportId}`);

    // 1. Get Auth Context
    const { user: authUser, token: authToken } = await this.getAuthContext(brandId);

    const getExecutablePath = () => {
      if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
      return process.platform === 'linux'
        ? '/usr/bin/google-chrome'
        : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    };

    const browser = await puppeteer.launch({
      executablePath: getExecutablePath(),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,1600', '--ignore-certificate-errors']
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 }); // High DPI for better quality

      // 3. Inject Auth & State
      const futureTime = Date.now() + 3600 * 1000 * 24; // 24 hours from now

      await page.evaluateOnNewDocument((user, bId, token, expiry) => {
        // Auth User
        // @ts-ignore
        window.localStorage.setItem('auth.user', JSON.stringify(user));

        // API Client Tokens
        // @ts-ignore
        window.localStorage.setItem('access_token', token);
        // @ts-ignore
        window.localStorage.setItem('refresh_token', 'mock-refresh-token');
        // @ts-ignore
        window.localStorage.setItem('access_token_expires_at', String(expiry));

        // Selected Brand
        // @ts-ignore
        window.localStorage.setItem('manual-dashboard:selected-brand', bId);

        // Onboarding complete to skip redirects
        // @ts-ignore
        window.localStorage.setItem('onboarding_complete', 'true');
      }, authUser, brandId, authToken, futureTime);

      const baseUrl = process.env.PDF_RENDER_URL || this.baseUrl;
      const url = `${baseUrl}/executive-reporting?brandId=${brandId}&reportId=${reportId}&printMode=true`;
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

      await page.waitForSelector('.executive-metrics-grid', { timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));

      // Capture full page or just the main container
      // If we want a specific "Summary" view, we could crop or select element.
      // For now, full page screenshot (clipped to reasonable height if needed)
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
        encoding: 'binary'
      });

      return Buffer.from(screenshot);
    } catch (error) {
      console.error('❌ [PDF-EXPORT-V2] Error capturing screenshot:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }
}

export const pdfExportServiceV2 = new PdfExportServiceV2();
