import { apiClient } from '../lib/apiClient';
import { AuditResponse, AeoAuditResult, BotAccessStatus, TestResult } from '../pages/DomainReadiness/types/types';

export type DomainReadinessStreamEvent =
  | {
      type: 'progress';
      analyzer: string;
      bucket: 'technicalCrawlability' | 'contentQuality' | 'semanticStructure' | 'accessibilityAndBrand';
      tests: TestResult[];
      completed: number;
      total: number;
    }
  | {
      type: 'progress';
      analyzer: string;
      bucket: 'botAccess';
      botAccessStatus: BotAccessStatus[];
      completed: number;
      total: number;
    }
  | { type: 'final'; result: AeoAuditResult }
  | { type: 'error'; error: string };

class DomainReadinessApi {
  async runAudit(brandId: string): Promise<AuditResponse> {
    return apiClient.post<AuditResponse>(`/brands/${brandId}/domain-readiness/audit`);
  }

  async runAuditStream(
    brandId: string,
    onEvent: (event: DomainReadinessStreamEvent) => void,
    signal?: AbortSignal
  ): Promise<AeoAuditResult> {
    const accessToken = apiClient.getAccessToken();
    if (!accessToken) {
      throw new Error('Authentication required. Please sign in to continue.');
    }

    const url = `${apiClient.baseUrl}/brands/${brandId}/domain-readiness/audit/stream`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || `Audit stream failed (HTTP ${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: AeoAuditResult | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');

        if (!line) continue;
        try {
          const event = JSON.parse(line) as DomainReadinessStreamEvent;
          onEvent(event);
          if (event.type === 'final') {
            finalResult = event.result;
          }
        } catch {
          // ignore malformed lines
        }
      }
    }

    if (!finalResult) {
      throw new Error('Audit stream ended without a final result.');
    }

    return finalResult;
  }

  async getLatestAudit(brandId: string): Promise<AuditResponse> {
    return apiClient.get<AuditResponse>(`/brands/${brandId}/domain-readiness/audit`);
  }
}

export const domainReadinessApi = new DomainReadinessApi();
