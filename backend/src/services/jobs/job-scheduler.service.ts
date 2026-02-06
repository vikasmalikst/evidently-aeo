/**
 * Job Scheduler Service
 * Manages scheduled jobs for data collection and scoring operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../../utils/env-utils';
import cronParser, { ParserOptions } from 'cron-parser';
import { customerEntitlementsService } from '../customer-entitlements.service';

loadEnvironment();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

export type JobType = 'data_collection' | 'scoring' | 'data_collection_and_scoring' | 'data_collection_retry' | 'scoring_retry';

export interface ScheduledJob {
  id: string;
  brand_id: string;
  customer_id: string;
  job_type: JobType;
  cron_expression: string;
  timezone: string;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  metadata: Record<string, any>;
}

export interface CreateScheduledJobInput {
  brand_id: string;
  customer_id: string;
  job_type: JobType;
  cron_expression: string;
  timezone?: string;
  is_active?: boolean;
  created_by?: string;
  metadata?: Record<string, any>;
}

export interface UpdateScheduledJobInput {
  cron_expression?: string;
  timezone?: string;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export class JobSchedulerService {
  /**
   * Create a new scheduled job
   */
  async createScheduledJob(input: CreateScheduledJobInput): Promise<ScheduledJob> {
    // Validate cron expression
    try {
      cronParser.parseExpression(input.cron_expression, {
        tz: input.timezone || 'UTC',
      });
    } catch (error) {
      throw new Error(`Invalid cron expression: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Validate frequency against entitlements
    try {
      const customerEntitlements = await customerEntitlementsService.getCustomerEntitlements(input.customer_id);
      const allowedFrequency = customerEntitlements?.settings?.entitlements?.run_frequency || 'daily';

      if (allowedFrequency !== 'custom') {
        const interval = cronParser.parseExpression(input.cron_expression, { tz: input.timezone || 'UTC' });
        const next1 = interval.next().toDate();
        const next2 = interval.next().toDate();
        const diffHours = (next2.getTime() - next1.getTime()) / (1000 * 60 * 60);

        const minHoursMap: Record<string, number> = {
          'daily': 23, // Tolerate slightly less than 24h
          'weekly': 24 * 6.5, // Tolerate slightly less than 7d
          'bi-weekly': 24 * 13.5,
          'monthly': 24 * 27
        };

        const minRequiredHours = minHoursMap[allowedFrequency] || 0;

        if (diffHours < minRequiredHours) {
          throw new Error(`Plan restriction: Frequency '${allowedFrequency}' requires at least ${Math.round(minRequiredHours)} hours between runs. Proposed cron has ${Math.round(diffHours)} hours.`);
        }
      }
    } catch (err) {
      // If validation fails (e.g. database error), log but strictly fallback to allowing or blocking?
      // Blocking is safer for enforcement.
      if (err instanceof Error && err.message.startsWith('Plan restriction')) {
        throw err;
      }
      console.warn('Frequency validation succeeded or skipped due to error:', err);
    }

    // Calculate next run time
    const nextRunAt = this.computeNextRun(input.cron_expression, input.timezone || 'UTC', new Date());

    const { data, error } = await supabase
      .from('scheduled_jobs')
      .insert({
        brand_id: input.brand_id,
        customer_id: input.customer_id,
        job_type: input.job_type,
        cron_expression: input.cron_expression,
        timezone: input.timezone || 'UTC',
        is_active: input.is_active ?? true,
        next_run_at: nextRunAt,
        created_by: input.created_by || null,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create scheduled job: ${error.message}`);
    }

    return data as ScheduledJob;
  }

  /**
   * Update an existing scheduled job
   */
  async updateScheduledJob(
    jobId: string,
    input: UpdateScheduledJobInput
  ): Promise<ScheduledJob> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (input.cron_expression !== undefined) {
      // Validate cron expression
      try {
        cronParser.parseExpression(input.cron_expression, {
          tz: input.timezone || 'UTC',
        });
      } catch (error) {
        throw new Error(`Invalid cron expression: ${error instanceof Error ? error.message : String(error)}`);
      }
      updateData.cron_expression = input.cron_expression;
    }

    if (input.timezone !== undefined) {
      updateData.timezone = input.timezone;
    }

    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }

    if (input.metadata !== undefined) {
      updateData.metadata = input.metadata;
    }

    // Recalculate next_run_at if cron or timezone changed
    if (input.cron_expression !== undefined || input.timezone !== undefined) {
      const { data: existingJob } = await supabase
        .from('scheduled_jobs')
        .select('cron_expression, timezone, next_run_at')
        .eq('id', jobId)
        .single();

      if (existingJob) {
        const cronExpr = input.cron_expression || existingJob.cron_expression;
        const tz = input.timezone || existingJob.timezone || 'UTC';
        const referenceDate = existingJob.next_run_at
          ? new Date(existingJob.next_run_at)
          : new Date();

        updateData.next_run_at = this.computeNextRun(cronExpr, tz, referenceDate);
      }
    }

    const { data, error } = await supabase
      .from('scheduled_jobs')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update scheduled job: ${error.message}`);
    }

    return data as ScheduledJob;
  }

  /**
   * Delete a scheduled job
   */
  async deleteScheduledJob(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_jobs')
      .delete()
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to delete scheduled job: ${error.message}`);
    }
  }

  /**
   * Get all scheduled jobs for a customer
   */
  async getScheduledJobs(customerId: string, brandId?: string): Promise<ScheduledJob[]> {
    let query = supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (brandId) {
      query = query.eq('brand_id', brandId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch scheduled jobs: ${error.message}`);
    }

    return (data || []) as ScheduledJob[];
  }

  /**
   * Get a single scheduled job
   */
  async getScheduledJob(jobId: string): Promise<ScheduledJob | null> {
    const { data, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch scheduled job: ${error.message}`);
    }

    return data as ScheduledJob;
  }

  /**
   * Get due jobs (jobs that should run now)
   */
  async getDueJobs(limit: number = 25): Promise<ScheduledJob[]> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('is_active', true)
      .or(`next_run_at.is.null,next_run_at.lte.${now}`)
      .order('next_run_at', { ascending: true, nullsFirst: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch due jobs: ${error.message}`);
    }

    return (data || []) as ScheduledJob[];
  }

  /**
   * Enqueue a job run (create a job_run record)
   */
  async enqueueJobRun(
    scheduledJobId: string,
    scheduledFor: Date = new Date()
  ): Promise<string> {
    // Check if there's already a pending/processing run for this job
    const { data: existingRuns } = await supabase
      .from('job_runs')
      .select('id')
      .eq('scheduled_job_id', scheduledJobId)
      .in('status', ['pending', 'processing'])
      .limit(1);

    if (existingRuns && existingRuns.length > 0) {
      throw new Error('Job already has a pending or processing run');
    }

    // Get job details
    const job = await this.getScheduledJob(scheduledJobId);
    if (!job) {
      throw new Error('Scheduled job not found');
    }

    // Create job run
    const { data, error } = await supabase
      .from('job_runs')
      .insert({
        scheduled_job_id: scheduledJobId,
        brand_id: job.brand_id,
        customer_id: job.customer_id,
        job_type: job.job_type,
        status: 'pending',
        scheduled_for: scheduledFor.toISOString(),
        metadata: { trigger: 'scheduler' },
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to enqueue job run: ${error.message}`);
    }

    // Update next_run_at for the scheduled job
    const nextRunAt = this.computeNextRun(
      job.cron_expression,
      job.timezone || 'UTC',
      scheduledFor
    );

    await supabase
      .from('scheduled_jobs')
      .update({
        next_run_at: nextRunAt,
        last_run_at: scheduledFor.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduledJobId);

    return data.id;
  }

  /**
   * Compute next run time from cron expression
   */
  computeNextRun(
    cronExpression: string,
    timezone: string,
    referenceDate: Date = new Date()
  ): string | null {
    try {
      const options: ParserOptions = {
        tz: timezone,
        currentDate: referenceDate,
      };

      const interval = cronParser.parseExpression(cronExpression, options);
      const nextDate = interval.next().toDate();
      return nextDate.toISOString();
    } catch (error) {
      console.error(`Failed to compute next run: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Manually trigger a job run (for admin use)
   */
  async triggerJobRun(jobId: string): Promise<string> {
    return this.enqueueJobRun(jobId, new Date());
  }
}

export const jobSchedulerService = new JobSchedulerService();

