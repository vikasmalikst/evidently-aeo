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
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
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
          <p class="generated">Generated: ${new Date(report.generated_at).toLocaleDateString()}</p>
        </div>

        <!-- Executive Summary -->
        <div class="page">
          <h2>Executive Summary</h2>
          <div class="summary-box">
            ${this.formatSummary(executive_summary)}
          </div>
        </div>

        <!-- Brand Performance Overview -->
        <div class="page">
          <h2>Brand Performance Overview</h2>
          
          <div class="metrics-grid">
            ${this.renderMetricCard('Visibility Score', brandPerf.current.visibility, brandPerf.deltas.visibility)}
            ${this.renderMetricCard('Share of Answer', brandPerf.current.share_of_answer, brandPerf.deltas.share_of_answer, '%')}
            ${this.renderMetricCard('Avg Position', brandPerf.current.average_position, brandPerf.deltas.average_position)}
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
              ${this.renderComparisonRow('Avg Position', brandPerf.current.average_position, brandPerf.previous.average_position, brandPerf.deltas.average_position)}
              ${this.renderComparisonRow('Sentiment', brandPerf.current.sentiment, brandPerf.previous.sentiment, brandPerf.deltas.sentiment)}
            </tbody>
          </table>
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
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Arial', sans-serif;
        color: #333;
        line-height: 1.6;
      }

      .page {
        page-break-after: always;
        padding: 20px;
      }

      .cover-page {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        text-align: center;
      }

      .cover-page h1 {
        font-size: 36px;
        margin-bottom: 20px;
        color: #1e40af;
      }

      .subtitle {
        font-size: 18px;
        color: #64748b;
        margin-bottom: 10px;
      }

      .generated {
        font-size: 14px;
        color: #94a3b8;
      }

      h2 {
        font-size: 24px;
        margin-bottom: 20px;
        color: #1e40af;
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 10px;
      }

      h3 {
        font-size: 18px;
        margin-top: 30px;
        margin-bottom: 15px;
        color: #475569;
      }

      .summary-box {
        background: #f8fafc;
        border-left: 4px solid #1e40af;
        padding: 20px;
        margin-bottom: 20px;
        line-height: 1.8;
      }

      .summary-box p {
        margin-bottom: 10px;
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
        margin-bottom: 30px;
      }

      .metric-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 20px;
      }

      .metric-label {
        font-size: 12px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 5px;
      }

      .metric-value {
        font-size: 32px;
        font-weight: bold;
        color: #1e293b;
        margin-bottom: 10px;
      }

      .metric-change {
        font-size: 14px;
        font-weight: 600;
      }

      .metric-change.positive {
        color: #16a34a;
      }

      .metric-change.negative {
        color: #dc2626;
      }

      .metric-change.neutral {
        color: #64748b;
      }

      .comparison-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
      }

      .comparison-table th,
      .comparison-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
      }

      .comparison-table th {
        background: #f8fafc;
        font-weight: 600;
        color: #475569;
      }

      .comparison-table tr:hover {
        background: #f8fafc;
      }

      @media print {
        .page-break {
          page-break-before: always;
        }
      }

      .opportunity-section {
        margin-bottom: 40px;
      }

      .opportunity-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 11px;
      }

      .opportunity-table th, .opportunity-table td {
        border: 1px solid #e2e8f0;
        padding: 8px;
        text-align: left;
      }

      .opportunity-table th {
        background: #f1f5f9;
        font-weight: bold;
      }

      .priority-badge {
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        font-size: 9px;
        font-weight: bold;
      }

      .priority-high { background: #fee2e2; color: #b91c1c; }
      .priority-medium { background: #fef3c7; color: #b45309; }
      .priority-low { background: #dcfce7; color: #15803d; }
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
          <td>${metrics.average_position?.toFixed(1) || 'N/A'}</td>
          <td>${metrics.share_of_answer?.toFixed(1) || 'N/A'}%</td>
        </tr>
      `)
      .join('');

    return `
      <div class="page">
        <h2>LLM-Specific Performance</h2>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>LLM</th>
              <th>Visibility</th>
              <th>Avg Position</th>
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

    const compRows = competitive.competitors
      .map((comp: any) => `
        <tr>
          <td>${comp.name}</td>
          <td>${comp.current.visibility?.toFixed(1) || 'N/A'}</td>
          <td>${comp.current.share_of_answer?.toFixed(1) || 'N/A'}%</td>
          <td class="metric-change ${comp.deltas.share_of_answer.percentage > 0 ? 'negative' : 'positive'}">
            ${comp.deltas.share_of_answer.percentage > 0 ? '+' : ''}${comp.deltas.share_of_answer.percentage.toFixed(1)}%
          </td>
        </tr>
      `)
      .join('');

    return `
      <div class="page">
        <h2>Competitive Landscape</h2>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Competitor</th>
              <th>Visibility</th>
              <th>SOA</th>
              <th>SOA Change</th>
            </tr>
          </thead>
          <tbody>
            ${compRows}
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
      <div class="page">
        <h2>Domain Readiness</h2>
        ${this.renderMetricCard('Overall Readiness Score', domainReadiness.overall_score, domainReadiness.score_delta)}
        
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
      <div class="page">
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
      <div class="page">
        <h2>Strategic Growth Opportunities</h2>
        <p style="margin-bottom: 20px; color: #64748b; font-size: 13px;">AI-powered recommendations mapped across the implementation lifecycle.</p>
        
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
      <div class="page">
        <h2>Top Movers</h2>
        ${renderMoversList(topMovers.queries?.gains, 'Top Query Gains')}
        ${renderMoversList(topMovers.queries?.losses, 'Top Query Losses')}
        ${renderMoversList(topMovers.topics?.gains, 'Top Topic Gains')}
        ${renderMoversList(topMovers.sources?.gains, 'Top Source Gains')}
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
        <div style="margin-bottom: 15px; padding: 10px; background: #f8fafc; border-left: 3px solid #64748b;">
          <strong>Section: ${annotation.section_id}</strong><br>
          <p>${annotation.comment}</p>
          <small style="color: #64748b;">By: ${annotation.author_id} | ${new Date(annotation.created_at).toLocaleDateString()}</small>
        </div>
      `
      )
      .join('');

    return `
      <div class="page">
        <h2>Annotations & Discussion</h2>
        ${annotationItems}
      </div>
    `;
  }
}

export const pdfExportService = new PdfExportService();
