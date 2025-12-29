import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { transitionCollectorResultByExecution } from '../collector-results-status'

function createSupabaseMock(responses: Array<{ data: any; error: any }>) {
  const calls: Array<{ op: string; payload?: any; filters: any[] }> = []

  function next() {
    const r = responses.shift()
    if (!r) throw new Error('No more mock responses')
    return r
  }

  function makeBuilder() {
    const state = { op: 'select', payload: undefined as any, filters: [] as any[] }
    const builder: any = {
      select: () => {
        if (state.op === 'update') return Promise.resolve(next())
        return builder
      },
      update: (payload: any) => {
        state.op = 'update'
        state.payload = payload
        calls.push({ op: 'update', payload, filters: state.filters })
        return builder
      },
      eq: (column: string, value: any) => {
        state.filters.push(['eq', column, value])
        return builder
      },
      not: (column: string, operator: string, value: any) => {
        state.filters.push(['not', column, operator, value])
        return builder
      },
      order: () => builder,
      limit: () => builder,
      single: () => Promise.resolve(next()),
      maybeSingle: () => Promise.resolve(next()),
    }
    return builder
  }

  return {
    supabase: { from: () => makeBuilder() },
    calls,
  }
}

describe('collector-results-status', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('merges metadata patch and appends transition', async () => {
    const { supabase, calls } = createSupabaseMock([
      {
        data: { id: 42, status: 'processing', metadata: { existing: 1, status_transitions: [{ from: null, to: 'processing' }] } },
        error: null,
      },
      { data: [{ id: 42 }], error: null },
    ])

    await transitionCollectorResultByExecution(
      supabase as any,
      'exec-1',
      'ChatGPT',
      'completed',
      { source: 'test', reason: 'done' },
      { metadata: { patched: true }, raw_answer: 'hello' }
    )

    expect(calls.length).toBe(1)
    const updatePayload = calls[0].payload
    expect(updatePayload.status).toBe('completed')
    expect(updatePayload.raw_answer).toBe('hello')
    expect(updatePayload.metadata).toMatchObject({
      existing: 1,
      patched: true,
      last_status_transition: {
        from: 'processing',
        to: 'completed',
        at: '2024-01-01T00:00:00.000Z',
        source: 'test',
        reason: 'done',
      },
    })
    expect(Array.isArray(updatePayload.metadata.status_transitions)).toBe(true)
    expect(updatePayload.metadata.status_transitions.length).toBe(2)
  })

  it('skips terminal rows without updating', async () => {
    const { supabase, calls } = createSupabaseMock([
      { data: { id: 99, status: 'completed', metadata: {} }, error: null },
    ])

    const result = await transitionCollectorResultByExecution(
      supabase as any,
      'exec-2',
      'ChatGPT',
      'failed',
      { source: 'test', reason: 'should_skip' },
      { error_message: 'x' }
    )

    expect(result.skippedTerminal).toBe(true)
    expect(calls.length).toBe(0)
  })

  it('downgrades completed to processing if raw_answer is missing', async () => {
    const { supabase, calls } = createSupabaseMock([
      {
        data: {
          id: 42,
          status: 'processing',
          metadata: { status_transitions: [] },
          raw_answer: null,
        },
        error: null,
      },
      { data: [{ id: 42 }], error: null },
    ])

    await transitionCollectorResultByExecution(
      supabase as any,
      'exec-1',
      'ChatGPT',
      'completed',
      { source: 'test', reason: 'done' },
      { metadata: { patched: true } }
    )

    expect(calls.length).toBe(1)
    const updatePayload = calls[0].payload
    expect(updatePayload.status).toBe('processing')
    expect(updatePayload.metadata.last_status_transition.to).toBe('processing')
  })
})
