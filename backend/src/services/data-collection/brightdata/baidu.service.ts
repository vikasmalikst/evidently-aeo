/**
 * Baidu collector service via BrightData
 */

import { BaseBrightDataService } from './base.service';
import { BrightDataRequest, BrightDataResponse } from './types';

export class BrightDataBaiduService extends BaseBrightDataService {
  async executeQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    throw new Error('Baidu collector not implemented for BrightData');
  }
}

