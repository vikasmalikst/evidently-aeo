/**
 * Base service for BrightData collectors
 * Provides common functionality: API key, Supabase client, dataset IDs
 */

import { createClient } from '@supabase/supabase-js';
import { getEnvVar, loadEnvironment } from '../../../utils/env-utils';
import { BrightDataRequest, BrightDataResponse } from './types';

export abstract class BaseBrightDataService {
  protected apiKey: string;
  protected baseUrl: string;
  protected supabase: any;
  protected datasetIds: Map<string, string>;

  constructor() {
    loadEnvironment();
    this.apiKey = process.env.BRIGHTDATA_API_KEY || '';
    this.baseUrl = 'https://api.brightdata.com';
    this.datasetIds = new Map();
    
    // Initialize Supabase client for database updates
    const supabaseUrl = getEnvVar('SUPABASE_URL');
    const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    });
    
    // Initialize dataset IDs for different collectors
    this.datasetIds.set('chatgpt', 'gd_m7aof0k82r803d5bjm');
    this.datasetIds.set('bing_copilot', 'gd_m7di5jy6s9geokz8w');
    this.datasetIds.set('grok', 'gd_m8ve0u141icu75ae74');
    this.datasetIds.set('gemini', 'gd_mbz66arm2mf9cu856y');
    this.datasetIds.set('perplexity', 'gd_m7dhdot1vw9a7gc1n');
    this.datasetIds.set('google_aio', 'gd_mcswdt6z2elth3zqr2');
    
    if (!this.apiKey) {
      throw new Error('BrightData API key not configured');
    }
  }

  protected getDatasetId(collectorType: string): string {
    const datasetId = this.datasetIds.get(collectorType) || '';
    if (!datasetId) {
      throw new Error(`BrightData dataset ID not configured for ${collectorType}`);
    }
    return datasetId;
  }

  protected validateConfig(collectorType: string): void {
    if (!this.apiKey) {
      throw new Error(`BrightData API key not configured`);
    }
    this.getDatasetId(collectorType);
  }

  abstract executeQuery(request: BrightDataRequest): Promise<BrightDataResponse>;
}
