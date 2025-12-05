/**
 * BrightData Collector Service (Orchestrator)
 * Routes requests to appropriate collector services
 */

import { loadEnvironment } from '../../utils/env-utils';
import {
  BrightDataRequest,
  BrightDataResponse,
  BrightDataChatGPTService,
  BrightDataGeminiService,
  BrightDataBingCopilotService,
  BrightDataGrokService,
  BrightDataGoogleAIOService,
  BrightDataPerplexityService,
  BrightDataBaiduService,
  BrightDataBingService
} from './brightdata';

// Load environment variables
loadEnvironment();

/**
 * Main BrightData Collector Service
 * Acts as a facade/orchestrator that routes to specific collector services
 */
export class BrightDataCollectorService {
  private chatgptService: BrightDataChatGPTService;
  private geminiService: BrightDataGeminiService;
  private bingCopilotService: BrightDataBingCopilotService;
  private grokService: BrightDataGrokService;
  private googleAIOService: BrightDataGoogleAIOService;
  private perplexityService: BrightDataPerplexityService;
  private baiduService: BrightDataBaiduService;
  private bingService: BrightDataBingService;

  constructor() {
    // Initialize all collector services
    this.chatgptService = new BrightDataChatGPTService();
    this.geminiService = new BrightDataGeminiService();
    this.bingCopilotService = new BrightDataBingCopilotService();
    this.grokService = new BrightDataGrokService();
    this.googleAIOService = new BrightDataGoogleAIOService();
    this.perplexityService = new BrightDataPerplexityService();
    this.baiduService = new BrightDataBaiduService();
    this.bingService = new BrightDataBingService();
  }

  /**
   * Execute ChatGPT query via BrightData
   */
  async executeChatGPTQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    return await this.chatgptService.executeQuery(request);
  }

  /**
   * Execute Gemini query via BrightData
   */
  async executeGeminiQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    return await this.geminiService.executeQuery(request);
  }

  /**
   * Execute Bing Copilot query via BrightData
   */
  async executeBingCopilotQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    return await this.bingCopilotService.executeQuery(request);
  }

  /**
   * Execute Grok query via BrightData
   */
  async executeGrokQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    return await this.grokService.executeQuery(request);
        }

  /**
   * Execute Google AIO query via BrightData
   */
  async executeGoogleAIOQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    return await this.googleAIOService.executeQuery(request);
  }

  /**
   * Execute Perplexity query via BrightData
   */
  async executePerplexityQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    return await this.perplexityService.executeQuery(request);
  }

  /**
   * Execute Baidu query via BrightData
   */
  async executeBaiduQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    return await this.baiduService.executeQuery(request);
  }

  /**
   * Execute Bing query via BrightData
   */
  async executeBingQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    return await this.bingService.executeQuery(request);
        }

  /**
   * Get available dataset information (kept for backward compatibility)
   */
  async getDatasetInfo(): Promise<any> {
    const apiKey = process.env.BRIGHTDATA_API_KEY || '';
    if (!apiKey) {
      throw new Error('BrightData API key not configured');
    }

    const datasetId = 'gd_m7aof0k82r803d5bjm'; // ChatGPT dataset ID as default

    try {
      const response = await fetch(`https://api.brightdata.com/datasets/v3/info?dataset_id=${datasetId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get dataset info: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('❌ Error getting dataset info:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
export const brightDataCollectorService = new BrightDataCollectorService();
