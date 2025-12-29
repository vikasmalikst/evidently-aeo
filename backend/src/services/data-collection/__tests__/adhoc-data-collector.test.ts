import { describe, expect, it, jest } from '@jest/globals'

jest.mock('../../jobs/data-collection-job.service', () => ({
  dataCollectionJobService: {
    executeDataCollection: jest.fn(),
  },
}))

jest.mock('../../scoring/brand-scoring.orchestrator', () => ({
  brandScoringService: {
    scoreBrandAsync: jest.fn(),
  },
}))

describe('adhoc data collection', () => {
  it('forces suppressScoring=true when starting collection', async () => {
    const { dataCollectionJobService } = await import('../../jobs/data-collection-job.service')
    const { executeAdhocDataCollection } = await import('../adhoc_data_collector')

    ;(dataCollectionJobService.executeDataCollection as any).mockResolvedValue({ ok: true })

    await executeAdhocDataCollection('brand-1', 'customer-1', {
      collectors: ['chatgpt'],
      locale: 'en-US',
      country: 'US',
    })

    expect(dataCollectionJobService.executeDataCollection).toHaveBeenCalledWith(
      'brand-1',
      'customer-1',
      expect.objectContaining({ suppressScoring: true })
    )
  })

  it('does not trigger scoring when suppressScoring=true', async () => {
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'

    const { brandScoringService } = await import('../../scoring/brand-scoring.orchestrator')
    const { DataCollectionService } = require('../data-collection.service')

    const supabaseMock = {
      from: (table: string) => {
        if (table === 'brands') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { name: 'Brand' }, error: null }),
              }),
            }),
          }
        }

        if (table === 'generated_queries') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { query_text: 'Q', topic: null, metadata: {} },
                  error: null,
                }),
              }),
            }),
          }
        }

        if (table === 'brand_competitors') {
          return {
            select: () => ({
              eq: async () => ({ data: [], error: null }),
            }),
          }
        }

        if (table === 'collector_results') {
          return {
            insert: () => ({
              select: async () => ({ data: [{ id: 123 }], error: null }),
            }),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      },
    }

    const service = new DataCollectionService()
    ;(service as any).supabase = supabaseMock
    ;(service as any).generateKeywordsForResult = jest.fn(async () => undefined)

    await (service as any).storeCollectorResult({
      queryId: 'q1',
      executionId: '',
      collectorType: 'chatgpt',
      status: 'completed',
      response: 'answer',
      citations: [],
      urls: [],
      brandId: 'brand-1',
      customerId: 'customer-1',
      suppressScoring: true,
    })

    expect(brandScoringService.scoreBrandAsync).not.toHaveBeenCalled()
  })

  it('does not create aggregated collector_results rows when all collectors fail', async () => {
    const { DataCollectionService } = require('../data-collection.service')
    const service = new DataCollectionService()

    const storeSpy = jest.fn(async () => undefined)
    ;(service as any).storeCollectorResult = storeSpy
    ;(service as any).executeQueryAcrossCollectorsWithRetry = jest.fn(async () => [
      {
        queryId: 'q1',
        executionId: 'e1',
        collectorType: 'chatgpt',
        status: 'failed',
        error: 'fail-1',
      },
      {
        queryId: 'q1',
        executionId: 'e2',
        collectorType: 'google_aio',
        status: 'failed',
        error: 'fail-2',
      },
    ])

    await service.executeQueries([
      {
        queryId: 'q1',
        brandId: 'brand-1',
        customerId: 'customer-1',
        queryText: 'Q',
        intent: 'test',
        locale: 'en-US',
        country: 'US',
        collectors: ['chatgpt', 'google_aio'],
        suppressScoring: true,
      },
    ])

    expect(storeSpy).not.toHaveBeenCalled()
  })

  it('creates one failed execution per collector when a query throws', async () => {
    const { DataCollectionService } = require('../data-collection.service')
    const service = new DataCollectionService()

    const storeSpy = jest.fn(async () => undefined)
    ;(service as any).storeCollectorResult = storeSpy

    const createExecutionSpy = jest.fn(async (_req: any, collectorType: string) => `exec-${collectorType}`)
    ;(service as any).createQueryExecutionForCollector = createExecutionSpy

    ;(service as any).executeQueryAcrossCollectorsWithRetry = jest.fn(async () => {
      throw new Error('boom')
    })

    const results = await service.executeQueries([
      {
        queryId: 'q1',
        brandId: 'brand-1',
        customerId: 'customer-1',
        queryText: 'Q',
        intent: 'test',
        locale: 'en-US',
        country: 'US',
        collectors: ['chatgpt', 'google_aio'],
        suppressScoring: true,
      },
    ])

    expect(storeSpy).not.toHaveBeenCalled()
    expect(createExecutionSpy).toHaveBeenCalledTimes(2)
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ executionId: 'exec-chatgpt', collectorType: 'chatgpt', status: 'failed' }),
        expect.objectContaining({ executionId: 'exec-google_aio', collectorType: 'google_aio', status: 'failed' }),
      ])
    )
  })

  it('populates brand and competitors on pending collector_results rows', async () => {
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'

    jest.resetModules()

    let pendingCollectorResultPayload: any = null

    jest.doMock('@supabase/supabase-js', () => {
      const client = {
        from: (table: string) => {
          if (table === 'brands') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { name: 'Brand Name' }, error: null }),
                }),
              }),
            }
          }

          if (table === 'brand_competitors') {
            return {
              select: () => ({
                eq: async () => ({ data: [{ competitor_name: 'Comp A' }, { competitor_name: 'Comp B' }], error: null }),
              }),
            }
          }

          if (table === 'generated_queries') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { topic: 'Sustainability', metadata: {} }, error: null }),
                }),
              }),
            }
          }

          if (table === 'query_executions') {
            return {
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: 'exec-1', status: 'pending' }, error: null }),
                }),
              }),
            }
          }

          if (table === 'collector_results') {
            return {
              insert: (payload: any) => {
                pendingCollectorResultPayload = payload
                return {
                  select: () => ({
                    maybeSingle: async () => ({ data: { id: 1 }, error: null }),
                  }),
                }
              },
            }
          }

          throw new Error(`Unexpected table: ${table}`)
        },
      }

      return { createClient: () => client }
    })

    const { DataCollectionService } = require('../data-collection.service')
    const service = new DataCollectionService()

    await (service as any).createQueryExecutionForCollector(
      {
        queryId: 'q1',
        brandId: 'brand-1',
        customerId: 'customer-1',
        queryText: 'Q',
        intent: 'test',
        locale: 'en-US',
        country: 'US',
        collectors: ['bing_copilot'],
        suppressScoring: true,
      },
      'bing_copilot',
      'pending'
    )

    expect(pendingCollectorResultPayload).toEqual(
      expect.objectContaining({
        brand: 'Brand Name',
        competitors: ['Comp A', 'Comp B'],
        topic: 'Sustainability',
      })
    )
  })
})
