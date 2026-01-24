/**
 * PDF Export Service
 * 
 * Generates PDF exports of executive reports using Puppeteer.
 */


// Removed top-level import to prevent crash if puppeteer is missing
// import puppeteer from 'puppeteer';
import { reportOrchestrationService } from './report-orchestration.service';
import { annotationService } from './annotation.service';
import type { ExecutiveReport } from './types';

export class PdfExportService {
  /**
   * Generate PDF from a report
   */
  async generatePDF(reportId: string, includeAnnotations: boolean = false): Promise<Buffer> {
    console.log(`📄 [PDF-EXPORT] Generating PDF for report ${reportId}`);

    // Fetch report data
    const report = await reportOrchestrationService.getReport(reportId);

    if (!report) {
      throw new Error('Report not found');
    }

    // Fetch annotations if needed
    let annotations: any[] = [];
    if (includeAnnotations) {
      annotations = await annotationService.getComments(reportId);
    }

    // Generate HTML content
    const htmlContent = this.generateHTML(report, annotations);

    // Convert to PDF using Puppeteer
    const pdfBuffer = await this.htmlToPDF(htmlContent);

    console.log(`✅ [PDF-EXPORT] PDF generated successfully`);

    return pdfBuffer;
  }

  /**
   * Convert HTML to PDF using Puppeteer
   */
  private async htmlToPDF(html: string): Promise<Buffer> {
    let puppeteer;
    try {
      // Dynamically import puppeteer
      puppeteer = (await import('puppeteer')).default;
    } catch (error) {
      console.error('❌Puppeteer not found. Please install it: npm install puppeteer');
      throw new Error('PDF generation requires "puppeteer" package. Please install it in the backend directory.');
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();

      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="width: 100%; font-size: 9px; color: #94a3b8; padding: 0 40px; display: flex; justify-content: space-between;">
            <span></span>
            <span style="font-weight: 500;">Executive AEO Performance Report</span>
            <span></span>
          </div>
        `,
        footerTemplate: `
          <div style="width: 100%; font-size: 9px; color: #64748b; padding: 0 40px; display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #94a3b8;">Confidential</span>
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `,
        margin: {
          top: '25mm',
          right: '18mm',
          bottom: '22mm',
          left: '18mm',
        },
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate HTML content for the report
   */
  public generateHTML(report: ExecutiveReport, annotations: any[]): string {
    const { data_snapshot, executive_summary } = report;
    const brandPerf = data_snapshot.brand_performance;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Executive Report</title>
        <style>
          ${this.getStyles()}
        </style>
      </head>
      <body>
        <!-- Cover Page -->
        <div class="page cover-page">
          <h1>Executive AEO Performance Report</h1>
          <p class="subtitle">Reporting Period: ${report.report_period_start} to ${report.report_period_end}</p>
          <p class="generated">Generated: ${new Date(report.generated_at).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}</p>
        </div>

        <!-- Executive Summary + Brand Performance (Combined) -->
        <div class="page">
          <div class="section">
            <h2>Executive Summary</h2>
            <div class="summary-box">
              ${this.formatSummary(executive_summary)}
            </div>
          </div>
          
          <div class="section">
            <h2>Brand Performance Overview</h2>
            
            <div class="metrics-grid">
              ${this.renderMetricCard('Visibility Score', brandPerf.current.visibility, brandPerf.deltas.visibility)}
              ${this.renderMetricCard('Share of Answer', brandPerf.current.share_of_answer, brandPerf.deltas.share_of_answer, '%')}
              ${this.renderMetricCard('Brand Presence', brandPerf.current.appearance_rate, brandPerf.deltas.appearance_rate, '%')}
              ${this.renderMetricCard('Sentiment Score', brandPerf.current.sentiment, brandPerf.deltas.sentiment)}
            </div>

            <h3>Period-over-Period Comparison</h3>
            <table class="comparison-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Current</th>
                  <th>Previous</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                ${this.renderComparisonRow('Visibility', brandPerf.current.visibility, brandPerf.previous.visibility, brandPerf.deltas.visibility)}
                ${this.renderComparisonRow('Share of Answer', brandPerf.current.share_of_answer, brandPerf.previous.share_of_answer, brandPerf.deltas.share_of_answer, '%')}
                ${this.renderComparisonRow('Brand Presence', brandPerf.current.appearance_rate, brandPerf.previous.appearance_rate, brandPerf.deltas.appearance_rate, '%')}
                ${this.renderComparisonRow('Sentiment', brandPerf.current.sentiment, brandPerf.previous.sentiment, brandPerf.deltas.sentiment)}
              </tbody>
            </table>
          </div>
        </div>

        <!-- LLM Performance -->
        ${this.renderLLMPerformance(data_snapshot.llm_performance)}

        <!-- Competitive Landscape -->
        ${this.renderCompetitiveLandscape(data_snapshot.competitive_landscape)}

        <!-- Domain Readiness -->
        ${this.renderDomainReadiness(data_snapshot.domain_readiness)}

        <!-- Actions & Impact -->
        ${this.renderActionsImpact(data_snapshot.actions_impact)}
        
        <!-- Strategic Growth Opportunities -->
        ${this.renderOpportunities(data_snapshot.opportunities)}

        <!-- Top Movers -->
        ${this.renderTopMovers(data_snapshot.top_movers)}

        <!-- Annotations (if included) -->
        ${annotations.length > 0 ? this.renderAnnotations(annotations) : ''}

      </body>
      </html>
    `;
  }

  /**
   * Get CSS styles for PDF
   */
  private getStyles(): string {
    return `
      /* ========================================
         PROFESSIONAL PDF REPORT STYLES
         ======================================== */
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        color: #1e293b;
        line-height: 1.6;
        font-size: 11px;
        background: #fff;
      }

      /* ========================================
         PAGE LAYOUT - Smart Page Breaks
         ======================================== */
      
      .page {
        padding: 0 0 24px 0;
        page-break-after: auto;
        page-break-inside: avoid;
      }

      .section {
        margin-bottom: 28px;
        page-break-inside: avoid;
      }

      /* Force page break only before major sections */
      .page-break-before {
        page-break-before: always;
      }

      /* ========================================
         COVER PAGE
         ======================================== */
      
      .cover-page {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 85vh;
        text-align: center;
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        border-radius: 0;
        padding: 60px 40px;
        page-break-after: always;
      }

      .cover-page::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 8px;
        background: linear-gradient(90deg, #1e40af 0%, #3b82f6 50%, #0ea5e9 100%);
      }

      .cover-page h1 {
        font-size: 38px;
        font-weight: 700;
        margin-bottom: 16px;
        color: #1e3a5f;
        letter-spacing: -0.5px;
        line-height: 1.2;
      }

      .cover-page .subtitle {
        font-size: 16px;
        color: #475569;
        margin-bottom: 8px;
        font-weight: 500;
      }

      .cover-page .generated {
        font-size: 13px;
        color: #64748b;
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid #cbd5e1;
      }

      /* ========================================
         SECTION HEADERS
         ======================================== */
      
      h2 {
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 20px;
        color: #1e3a5f;
        padding-bottom: 12px;
        border-bottom: 3px solid #3b82f6;
        letter-spacing: -0.3px;
      }

      h3 {
        font-size: 15px;
        font-weight: 600;
        margin-top: 24px;
        margin-bottom: 12px;
        color: #334155;
      }

      h4 {
        font-size: 13px;
        font-weight: 600;
        margin-top: 16px;
        margin-bottom: 8px;
        color: #475569;
      }

      /* ========================================
         EXECUTIVE SUMMARY
         ======================================== */
      
      .summary-box {
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        border-left: 5px solid #0284c7;
        padding: 20px 24px;
        margin-bottom: 24px;
        border-radius: 0 8px 8px 0;
        line-height: 1.8;
      }

      .summary-box p {
        margin-bottom: 12px;
        color: #334155;
        font-size: 12px;
      }

      .summary-box p:last-child {
        margin-bottom: 0;
      }

      /* ========================================
         METRICS GRID & CARDS
         ======================================== */
      
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        margin-bottom: 24px;
      }

      .metric-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 18px 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        position: relative;
        overflow: hidden;
      }

      .metric-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #3b82f6, #0ea5e9);
      }

      .metric-label {
        font-size: 10px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        font-weight: 600;
        margin-bottom: 6px;
      }

      .metric-value {
        font-size: 28px;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 8px;
        letter-spacing: -0.5px;
      }

      .metric-change {
        font-size: 12px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .metric-change.positive {
        color: #059669;
      }

      .metric-change.negative {
        color: #dc2626;
      }

      .metric-change.neutral {
        color: #64748b;
      }

      /* ========================================
         TABLES - Modern Professional Style
         ======================================== */
      
      .comparison-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        margin-top: 16px;
        font-size: 11px;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
      }

      .comparison-table th,
      .comparison-table td {
        padding: 12px 14px;
        text-align: left;
      }

      .comparison-table th {
        background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%);
        font-weight: 600;
        color: #fff;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .comparison-table tbody tr {
        border-bottom: 1px solid #e2e8f0;
      }

      .comparison-table tbody tr:nth-child(even) {
        background: #f8fafc;
      }

      .comparison-table tbody tr:nth-child(odd) {
        background: #fff;
      }

      .comparison-table tbody tr:last-child td {
        border-bottom: none;
      }

      .comparison-table td {
        color: #334155;
        font-weight: 500;
      }

      /* ========================================
         OPPORTUNITY TABLES
         ======================================== */
      
      .opportunity-section {
        margin-bottom: 24px;
        page-break-inside: avoid;
      }

      .opportunity-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        margin-bottom: 16px;
        font-size: 10px;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
      }

      .opportunity-table th, 
      .opportunity-table td {
        padding: 10px 12px;
        text-align: left;
      }

      .opportunity-table th {
        background: #f1f5f9;
        font-weight: 600;
        color: #334155;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        border-bottom: 2px solid #e2e8f0;
      }

      .opportunity-table tbody tr:nth-child(even) {
        background: #fafafa;
      }

      .opportunity-table tbody tr:nth-child(odd) {
        background: #fff;
      }

      /* ========================================
         PRIORITY BADGES
         ======================================== */
      
      .priority-badge {
        padding: 3px 8px;
        border-radius: 12px;
        text-transform: uppercase;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.3px;
        display: inline-block;
      }

      .priority-high { 
        background: linear-gradient(135deg, #fee2e2, #fecaca); 
        color: #b91c1c; 
      }
      
      .priority-medium { 
        background: linear-gradient(135deg, #fef3c7, #fde68a); 
        color: #b45309; 
      }
      
      .priority-low { 
        background: linear-gradient(135deg, #dcfce7, #bbf7d0); 
        color: #15803d; 
      }

      /* ========================================
         LISTS
         ======================================== */
      
      ul {
        margin: 12px 0;
        padding-left: 20px;
      }

      li {
        margin-bottom: 8px;
        color: #334155;
        font-size: 11px;
        line-height: 1.6;
      }

      li strong {
        color: #1e293b;
      }

      /* ========================================
         ANNOTATIONS SECTION
         ======================================== */
      
      .annotation-item {
        margin-bottom: 16px;
        padding: 14px 16px;
        background: #f8fafc;
        border-left: 4px solid #64748b;
        border-radius: 0 6px 6px 0;
      }

      .annotation-item strong {
        color: #1e293b;
        font-size: 11px;
      }

      .annotation-item p {
        margin: 8px 0;
        color: #475569;
        font-size: 11px;
      }

      .annotation-item small {
        color: #94a3b8;
        font-size: 10px;
      }

      /* ========================================
         PRINT MEDIA QUERIES
         ======================================== */
      
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .page {
          page-break-inside: avoid;
        }

        .comparison-table,
        .opportunity-table,
        .metrics-grid {
          page-break-inside: avoid;
        }

        .metric-card {
          break-inside: avoid;
        }
      }

      /* ========================================
         HELPER CLASSES
         ======================================== */
      
      .text-positive { color: #059669; }
      .text-negative { color: #dc2626; }
      .text-muted { color: #64748b; }
      .font-bold { font-weight: 700; }
      .mb-0 { margin-bottom: 0; }
      .mt-4 { margin-top: 16px; }
    `;
  }

  /**
   * Format executive summary text
   */
  private formatSummary(summary: string | null): string {
    if (!summary) {
      return '<p>No executive summary available.</p>';
    }

    // Split by bullet points and format
    const lines = summary.split('\n').filter(line => line.trim());
    return lines.map(line => `<p>${line}</p>`).join('');
  }

  /**
   * Render metric card HTML
   */
  private renderMetricCard(
    label: string,
    value: number,
    delta: { absolute: number; percentage: number },
    suffix: string = ''
  ): string {
    const changeClass = delta.percentage > 0 ? 'positive' : delta.percentage < 0 ? 'negative' : 'neutral';
    const changeSymbol = delta.percentage > 0 ? '↑' : delta.percentage < 0 ? '↓' : '→';

    return `
      <div class="metric-card">
        <div class="metric-label">${label}</div>
        <div class="metric-value">${value.toFixed(1)}${suffix}</div>
        <div class="metric-change ${changeClass}">
          ${changeSymbol} ${Math.abs(delta.percentage).toFixed(1)}% vs previous period
        </div>
      </div>
    `;
  }

  /**
   * Render comparison table row
   */
  private renderComparisonRow(
    metric: string,
    current: number,
    previous: number,
    delta: { absolute: number; percentage: number },
    suffix: string = ''
  ): string {
    const changeClass = delta.percentage > 0 ? 'positive' : delta.percentage < 0 ? 'negative' : 'neutral';

    return `
      <tr>
        <td>${metric}</td>
        <td>${current.toFixed(1)}${suffix}</td>
        <td>${previous.toFixed(1)}${suffix}</td>
        <td class="metric-change ${changeClass}">
          ${delta.percentage > 0 ? '+' : ''}${delta.percentage.toFixed(1)}%
        </td>
      </tr>
    `;
  }

  /**
   * Render LLM performance section
   */
  private renderLLMPerformance(llmPerf: any): string {
    if (!llmPerf || !llmPerf.by_llm) return '';

    const llmRows = Object.entries(llmPerf.by_llm)
      .map(([llmName, metrics]: [string, any]) => `
        <tr>
          <td>${llmName}</td>
          <td>${metrics.visibility?.toFixed(1) || 'N/A'}</td>
          <td>${metrics.appearance_rate?.toFixed(1) || 'N/A'}%</td>
          <td>${metrics.share_of_answer?.toFixed(1) || 'N/A'}%</td>
        </tr>
      `)
      .join('');

    return `
      <div class="section">
        <h2>LLM-Specific Performance</h2>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>LLM</th>
              <th>Visibility</th>
              <th>Brand Presence</th>
              <th>Share of Answer</th>
            </tr>
          </thead>
          <tbody>
            ${llmRows}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Render competitive landscape section
   */
  private renderCompetitiveLandscape(competitive: any): string {
    if (!competitive || !competitive.competitors || competitive.competitors.length === 0) {
      return '';
    }

    return `
      <div class="section">
        <h2>Competitive Landscape</h2>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Competitor</th>
              <th>Visibility</th>
              <th>SOA</th>
              <th>Brand Presence</th>
              <th>SOA Change</th>
            </tr>
          </thead>
          <tbody>
            ${competitive.competitors
        .map((comp: any) => `
                <tr>
                  <td>${comp.name}</td>
                  <td>${comp.current.visibility?.toFixed(1) || 'N/A'}</td>
                  <td>${comp.current.share_of_answer?.toFixed(1) || 'N/A'}%</td>
                  <td>${comp.current.appearance_rate?.toFixed(1) || '0.0'}%</td>
                  <td class="metric-change ${comp.deltas.share_of_answer.percentage > 0 ? 'negative' : 'positive'}">
                    ${comp.deltas.share_of_answer.percentage > 0 ? '+' : ''}${comp.deltas.share_of_answer.percentage.toFixed(1)}%
                  </td>
                </tr>
              `)
        .join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  /**
   * Render domain readiness section
   */
  private renderDomainReadiness(domainReadiness: any): string {
    return `
      <div class="section">
        <h2>Domain Readiness</h2>
        <div class="metrics-grid" style="grid-template-columns: 1fr;">
          ${this.renderMetricCard('Overall Readiness Score', domainReadiness.overall_score, domainReadiness.score_delta)}
        </div>
        
        ${domainReadiness.key_deficiencies && domainReadiness.key_deficiencies.length > 0
        ? `
              <h3>Key Deficiencies</h3>
              <ul>
                ${domainReadiness.key_deficiencies
          .map((def: any) => `<li><strong>${def.category}</strong> (${def.severity}): ${def.description}</li>`)
          .join('')}
              </ul>
            `
        : ''
      }
      </div>
    `;
  }

  /**
   * Render actions & impact section
   */
  private renderActionsImpact(actionsImpact: any): string {
    if (!actionsImpact?.recommendations) return '';

    const recs = actionsImpact.recommendations;
    return `
      <div class="section">
        <h2>Actions & Impact</h2>
        <div class="metrics-grid">
          ${this.renderMetricCard('Recommendations Provided', recs.provided || 0, { absolute: 0, percentage: 0 })}
          ${this.renderMetricCard('Recommendations Approved', recs.approved || 0, { absolute: 0, percentage: 0 })}
          ${this.renderMetricCard('Content Generated', recs.content_generated || 0, { absolute: 0, percentage: 0 })}
          ${this.renderMetricCard('Actions Implemented', recs.implemented || 0, { absolute: 0, percentage: 0 })}
        </div>
      </div>
    `;
  }

  /**
   * Render Strategic Growth Opportunities section
   */
  private renderOpportunities(opportunities: any): string {
    if (!opportunities) return '';

    const renderTable = (title: string, items: any[], columns: { label: string, key: string }[], showMetrics: boolean = false) => {
      if (!items || items.length === 0) return '';

      const headerRow = columns.map(col => `<th>${col.label}</th>`).join('');
      const bodyRows = items.map(item => {
        const cells = columns.map(col => {
          let val = item[col.key];
          if (col.key === 'priority') {
            const cls = `priority-${val.toLowerCase()}`;
            return `<td><span class="priority-badge ${cls}">${val}</span></td>`;
          }
          if (typeof val === 'number') val = val.toFixed(1);
          return `<td>${val || '—'}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      return `
        <div class="opportunity-section">
          <h3>${title}</h3>
          <table class="opportunity-table">
            <thead>
              <tr>${headerRow}</tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>
        </div>
      `;
    };

    const standardCols = [
      { label: 'Action', key: 'action' },
      { label: 'Source', key: 'citationSource' },
      { label: 'Focus', key: 'focusArea' },
      { label: 'Priority', key: 'priority' },
      { label: 'Effort', key: 'effort' }
    ];

    const trackCols = [
      { label: 'Action', key: 'action' },
      { label: 'Source', key: 'citationSource' },
      { label: 'Baseline Visibility', key: 'visibility_baseline' },
      { label: 'Baseline SOA%', key: 'soa_baseline' },
      { label: 'Completed', key: 'completed_at' }
    ];

    return `
      <div class="section">
        <h2>Strategic Growth Opportunities</h2>
        <p style="margin-bottom: 16px; color: #64748b; font-size: 11px;">AI-powered recommendations mapped across the implementation lifecycle.</p>
        
        ${renderTable('Discover Opportunities', opportunities.discover, standardCols)}
        ${renderTable('To-Do List (Approved)', opportunities.todo, standardCols)}
        ${renderTable('Review & Refine', opportunities.refine, standardCols)}
        ${renderTable('Track Outcomes (Completed)', opportunities.track, trackCols, true)}
      </div>
    `;
  }

  /**
   * Render top movers section
   */
  private renderTopMovers(topMovers: any): string {
    const renderMoversList = (movers: any[], title: string) => {
      if (!movers || movers.length === 0) return '';

      return `
        <h3>${title}</h3>
        <ul>
          ${movers.slice(0, 5).map(mover => `<li>${mover.name}</li>`).join('')}
        </ul>
      `;
    };

    return `
      <div class="section">
        <h2>Top Movers</h2>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
          <div>${renderMoversList(topMovers.queries?.gains, 'Top Query Gains')}</div>
          <div>${renderMoversList(topMovers.queries?.losses, 'Top Query Losses')}</div>
          <div>${renderMoversList(topMovers.topics?.gains, 'Top Topic Gains')}</div>
          <div>${renderMoversList(topMovers.sources?.gains, 'Top Source Gains')}</div>
        </div>
      </div>
    `;
  }

  /**
   * Render annotations appendix
   */
  private renderAnnotations(annotations: any[]): string {
    const annotationItems = annotations
      .map(
        annotation => `
        <div class="annotation-item">
          <strong>Section: ${annotation.section_id}</strong><br>
          <p>${annotation.comment}</p>
          <small>By: ${annotation.author_id} | ${new Date(annotation.created_at).toLocaleDateString()}</small>
        </div>
      `
      )
      .join('');

    return `
      <div class="section">
        <h2>Annotations & Discussion</h2>
        ${annotationItems}
      </div>
    `;
  }
}

export const pdfExportService = new PdfExportService();
