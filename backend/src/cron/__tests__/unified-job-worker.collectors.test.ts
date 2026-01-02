import { beforeAll, describe, expect, it } from '@jest/globals'

describe('unified-job-worker collector selection', () => {
  let resolveCollectorsFromBrandMetadata: (metadata: unknown) => {
    kind: 'selected' | 'explicit_empty' | 'no_key'
    collectors?: string[]
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'

    const mod = await import('../unified-job-worker')
    resolveCollectorsFromBrandMetadata = mod.resolveCollectorsFromBrandMetadata
  })

  it('returns no_key when ai_models is absent', () => {
    expect(resolveCollectorsFromBrandMetadata({})).toEqual({ kind: 'no_key' })
  })

  it('returns explicit_empty when ai_models key exists but empty array', () => {
    expect(resolveCollectorsFromBrandMetadata({ ai_models: [] })).toEqual({
      kind: 'explicit_empty',
      collectors: [],
    })
  })

  it('maps ai_models to collectors with normalization and dedupe', () => {
    expect(
      resolveCollectorsFromBrandMetadata({
        ai_models: [' ChatGPT ', 'grok', 'GROK', 'google_aio'],
      })
    ).toEqual({
      kind: 'selected',
      collectors: ['chatgpt', 'grok', 'google_aio'],
    })
  })
})

