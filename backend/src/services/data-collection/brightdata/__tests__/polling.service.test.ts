import { describe, expect, it, jest } from '@jest/globals'
import { BrightDataPollingService } from '../polling.service'

jest.mock('../../collector-results-status', () => ({
  transitionCollectorResultById: jest.fn(async () => ({ updated: true, skippedTerminal: false, collectorResultId: 1 })),
}))

describe('BrightDataPollingService', () => {
  it('updates topic and collection_time_ms when snapshot completes', async () => {
    const { transitionCollectorResultById } = require('../../collector-results-status')

    const supabaseMock = {
      from: (table: string) => {
        if (table === 'collector_results') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 10,
                    execution_id: 'exec-1',
                    query_id: 'q1',
                    brand_id: 'brand-1',
                    customer_id: 'customer-1',
                    metadata: { status_transitions: [{ at: new Date(Date.now() - 2500).toISOString() }] },
                  },
                  error: null,
                }),
              }),
            }),
            update: () => ({ eq: async () => ({ data: [{ id: 10 }], error: null }) }),
          }
        }

        if (table === 'generated_queries') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { topic: 'Topic A', metadata: {} }, error: null }),
              }),
            }),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      },
    }

    const service = new BrightDataPollingService('key', supabaseMock)

    await (service as any).updateDatabaseWithResults(
      'snap-1',
      'Bing Copilot',
      'ds-1',
      { prompt: 'p', brand: 'b', locale: 'en-US', country: 'US' },
      'answer',
      ['https://example.com'],
      { raw: true }
    )

    expect(transitionCollectorResultById).toHaveBeenCalled()
    const args = (transitionCollectorResultById as any).mock.calls[0]
    const updateFields = args[4]
    expect(updateFields.topic).toBe('Topic A')
    expect(typeof updateFields.collection_time_ms).toBe('number')
  })
})

