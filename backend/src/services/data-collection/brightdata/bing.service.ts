/**
 * Bing collector service via BrightData
 */

import { BaseBrightDataService } from './base.service';
import { BrightDataRequest, BrightDataResponse } from './types';

export class BrightDataBingService extends BaseBrightDataService {
  async executeQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    throw new Error('Bing collector not implemented for BrightData');
  }
}

