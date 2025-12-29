import type { SupabaseClient } from '@supabase/supabase-js'

export type CollectorResultTerminalStatus = 'completed' | 'failed'

export type CollectorResultStatus =
  | 'processing'
  | 'completed'
  | 'failed'
  | 'failed_retry'
  | 'pending'
  | 'running'
  | string

export type StatusTransitionContext = {
  source: string
  reason?: string
  brandId?: string
  customerId?: string
  executionId?: string
  collectorType?: string
  snapshotId?: string
}

type CollectorResultRow = {
  id: number
  status: CollectorResultStatus | null
  metadata: Record<string, unknown> | null
}

function isTerminal(status: CollectorResultStatus | null | undefined): status is CollectorResultTerminalStatus {
  return status === 'completed' || status === 'failed'
}

function buildTransitionEntry(
  from: CollectorResultStatus | null,
  to: CollectorResultStatus,
  context: StatusTransitionContext
): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    from,
    to,
    at: new Date().toISOString(),
    source: context.source,
  }

  if (context.reason) entry.reason = context.reason
  if (context.brandId) entry.brand_id = context.brandId
  if (context.customerId) entry.customer_id = context.customerId
  if (context.executionId) entry.execution_id = context.executionId
  if (context.collectorType) entry.collector_type = context.collectorType
  if (context.snapshotId) entry.brightdata_snapshot_id = context.snapshotId

  return entry
}

function appendTransitionToMetadata(
  metadata: Record<string, unknown> | null,
  entry: Record<string, unknown>
): Record<string, unknown> {
  const base: Record<string, unknown> = metadata && typeof metadata === 'object' ? { ...metadata } : {}
  const existingTransitions = Array.isArray((base as any).status_transitions)
    ? ([...(base as any).status_transitions] as unknown[])
    : []

  return {
    ...base,
    last_status_transition: entry,
    status_transitions: [...existingTransitions, entry],
  }
}

export async function transitionCollectorResultById(
  supabase: SupabaseClient,
  collectorResultId: number,
  toStatus: CollectorResultStatus,
  context: StatusTransitionContext,
  updateFields: Record<string, unknown> = {}
): Promise<{ updated: boolean; skippedTerminal: boolean; collectorResultId: number }> {
  const { data: current, error: fetchError } = await supabase
    .from('collector_results')
    .select('id, status, metadata, raw_answer')
    .eq('id', collectorResultId)
    .single()

  if (fetchError || !current) {
    throw new Error(fetchError?.message || `collector_results row not found (id=${collectorResultId})`)
  }

  const row = current as CollectorResultRow & { raw_answer: string | null }
  if (isTerminal(row.status)) {
    return { updated: false, skippedTerminal: true, collectorResultId: row.id }
  }

  // ENFORCE: completed status requires raw_answer
  let finalStatus = toStatus
  if (toStatus === 'completed') {
    const rawAnswer = (updateFields.raw_answer as string) || row.raw_answer
    if (!rawAnswer || (typeof rawAnswer === 'string' && rawAnswer.trim().length === 0)) {
      console.warn(`[collector_results] id=${collectorResultId} cannot be 'completed' because raw_answer is null/empty. Downgrading to 'processing'.`)
      finalStatus = 'processing'
    }
  }

  const { metadata: updateMetadata, ...restUpdateFields } = updateFields as {
    metadata?: Record<string, unknown> | null
    [key: string]: unknown
  }
  const mergedMetadata =
    updateMetadata && typeof updateMetadata === 'object' && !Array.isArray(updateMetadata)
      ? {
          ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
          ...(updateMetadata as Record<string, unknown>),
        }
      : row.metadata

  const entry = buildTransitionEntry(row.status, finalStatus, context)
  const nextMetadata = appendTransitionToMetadata(mergedMetadata, entry)

  const { data: updatedRows, error: updateError } = await supabase
    .from('collector_results')
    .update({
      ...restUpdateFields,
      status: finalStatus,
      metadata: nextMetadata,
    })
    .eq('id', collectorResultId)
    .eq('status', row.status as any)
    .not('status', 'in', '("completed","failed")')
    .select('id')

  if (updateError) {
    throw new Error(updateError.message)
  }

  const updated = Array.isArray(updatedRows) && updatedRows.length > 0
  if (updated) {
    console.log('[collector_results] status transition', {
      id: collectorResultId,
      from: row.status,
      to: finalStatus,
      source: context.source,
      reason: context.reason,
    })
  }

  return { updated, skippedTerminal: false, collectorResultId: row.id }
}

export async function transitionCollectorResultByExecution(
  supabase: SupabaseClient,
  executionId: string,
  collectorType: string,
  toStatus: CollectorResultStatus,
  context: StatusTransitionContext,
  updateFields: Record<string, unknown> = {}
): Promise<{ updated: boolean; skippedTerminal: boolean; collectorResultId?: number }> {
  const { data: current, error: fetchError } = await supabase
    .from('collector_results')
    .select('id, status, metadata, raw_answer')
    .eq('execution_id', executionId)
    .eq('collector_type', collectorType)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError || !current) {
    return { updated: false, skippedTerminal: false }
  }

  const row = current as CollectorResultRow & { raw_answer: string | null }
  if (isTerminal(row.status)) {
    return { updated: false, skippedTerminal: true, collectorResultId: row.id }
  }

  // ENFORCE: completed status requires raw_answer
  let finalStatus = toStatus
  if (toStatus === 'completed') {
    const rawAnswer = (updateFields.raw_answer as string) || row.raw_answer
    if (!rawAnswer || (typeof rawAnswer === 'string' && rawAnswer.trim().length === 0)) {
      console.warn(`[collector_results] executionId=${executionId} type=${collectorType} cannot be 'completed' because raw_answer is null/empty. Downgrading to 'processing'.`)
      finalStatus = 'processing'
    }
  }

  const { metadata: updateMetadata, ...restUpdateFields } = updateFields as {
    metadata?: Record<string, unknown> | null
    [key: string]: unknown
  }
  const mergedMetadata =
    updateMetadata && typeof updateMetadata === 'object' && !Array.isArray(updateMetadata)
      ? {
          ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
          ...(updateMetadata as Record<string, unknown>),
        }
      : row.metadata

  const entry = buildTransitionEntry(row.status, finalStatus, context)
  const nextMetadata = appendTransitionToMetadata(mergedMetadata, entry)

  const { data: updatedRows, error: updateError } = await supabase
    .from('collector_results')
    .update({
      ...restUpdateFields,
      status: finalStatus,
      metadata: nextMetadata,
    })
    .eq('execution_id', executionId)
    .eq('collector_type', collectorType)
    .eq('id', row.id)
    .eq('status', row.status as any)
    .not('status', 'in', '("completed","failed")')
    .select('id')

  if (updateError) {
    throw new Error(updateError.message)
  }

  const updated = Array.isArray(updatedRows) && updatedRows.length > 0
  if (updated) {
    console.log('[collector_results] status transition', {
      id: row.id,
      execution_id: executionId,
      collector_type: collectorType,
      from: row.status,
      to: finalStatus,
      source: context.source,
      reason: context.reason,
    })
  }

  return { updated, skippedTerminal: false, collectorResultId: row.id }
}
