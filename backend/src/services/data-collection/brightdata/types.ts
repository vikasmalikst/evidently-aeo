/**
 * Shared types for BrightData collectors
 */

export interface BrightDataRequest {
  prompt: string;
  brand?: string;
  locale?: string;
  country?: string;
}

export interface BrightDataResponse {
  query_id: string;
  run_start: string;
  run_end: string;
  prompt: string;
  answer: string;
  response: string;
  citations: string[];
  urls: string[];
  model_used: string;
  collector_type: string;
  metadata: {
    provider: string;
    dataset_id: string;
    snapshot_id?: string;
    success: boolean;
    brand?: string;
    locale?: string;
    country?: string;
    answer_section_html?: string;
    async?: boolean;
    [key: string]: any;
  };
}

export class BrightDataError extends Error {
  public statusCode?: number;
  public details?: any;

  constructor(message: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'BrightDataError';
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, BrightDataError.prototype);
  }
}

