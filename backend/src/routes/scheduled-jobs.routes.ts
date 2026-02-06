import { Router } from 'express';
import { jobSchedulerService } from '../services/jobs/job-scheduler.service';
import { dataCollectionService } from '../services/data-collection/data-collection.service';
import { createClient } from '@supabase/supabase-js';
import { getEnvVar } from '../utils/env-utils';
import { JobType } from '../services/jobs/job-scheduler.service';
import { DataCollectionJobService } from '../services/jobs/data-collection-job.service';

const router = Router();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
});

// Initialize services (if not already exported as singletons)
const dataCollectionJobService = new DataCollectionJobService();

/**
 * GET /api/scheduled-jobs
 * List all scheduled jobs
 */
router.get('/', async (req, res) => {
    try {
        const { data: jobs, error } = await supabase
            .from('scheduled_jobs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(jobs);
    } catch (error: any) {
        console.error('Error listing scheduled jobs:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scheduled-jobs
 * Create a new scheduled job
 */
router.post('/', async (req, res) => {
    try {
        const {
            brand_id,
            brandId,
            customer_id,
            customerId,
            job_type,
            jobType,
            cron_expression,
            cronExpression,
            timezone,
            is_active,
            isActive,
            metadata,
            created_by,
            createdBy
        } = req.body;

        const effectiveBrandId = brand_id || brandId;
        const effectiveCustomerId = customer_id || customerId;
        const effectiveJobType = job_type || jobType;
        const effectiveCronExpression = cron_expression || cronExpression;
        const effectiveIsActive = is_active !== undefined ? is_active : isActive;
        const effectiveCreatedBy = created_by || createdBy;

        if (!effectiveBrandId || !effectiveCustomerId || !effectiveJobType || !effectiveCronExpression) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const job = await jobSchedulerService.createScheduledJob({
            brand_id: effectiveBrandId,
            customer_id: effectiveCustomerId,
            job_type: effectiveJobType as JobType,
            cron_expression: effectiveCronExpression,
            timezone,
            is_active: effectiveIsActive,
            metadata,
            created_by: effectiveCreatedBy
        });

        res.status(201).json(job);
    } catch (error: any) {
        console.error('Error creating scheduled job:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/scheduled-jobs/:id
 * Update a scheduled job
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Filter allowed updates
        const allowedUpdates: any = {};
        if (updates.cronExpression) allowedUpdates.cron_expression = updates.cronExpression;
        if (updates.isActive !== undefined) allowedUpdates.is_active = updates.isActive;
        if (updates.metadata) allowedUpdates.metadata = updates.metadata;
        if (updates.timezone) allowedUpdates.timezone = updates.timezone;

        const updatedJob = await jobSchedulerService.updateScheduledJob(id, allowedUpdates);
        res.json(updatedJob);
    } catch (error: any) {
        console.error('Error updating scheduled job:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/scheduled-jobs/:id
 * Delete a scheduled job
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await jobSchedulerService.deleteScheduledJob(id);
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting scheduled job:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scheduled-jobs/:id/trigger
 * Manually trigger a job run for a schedule
 */
router.post('/:id/trigger', async (req, res) => {
    try {
        const { id } = req.params;
        const runId = await jobSchedulerService.enqueueJobRun(id);
        res.status(200).json({ message: 'Job run enqueued', runId });
    } catch (error: any) {
        console.error('Error triggering job:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scheduled-jobs/run-once
 * Schedule a one-off job execution
 */
router.post('/run-once', async (req, res) => {
    try {
        const {
            brandId,
            customerId,
            jobType,
            scheduledFor,
            metadata
        } = req.body;

        if (!brandId || !customerId || !jobType || !scheduledFor) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // For run-once, we create a specialized scheduled job that runs once or handled via ad-hoc enqueuing
        // But leveraging the existing system: create a job, enqueue a run, then maybe disable/delete it?
        // OR: Just create a job_run directly without a parent scheduled_job?
        // The current architecture requires a scheduled_job_id for a job_run.
        // So we can create a "temporary" or "one-off" scheduled job.

        // Alternative: Create a scheduled job with current time + 1 min, or just create it and trigger it.
        // Let's create a disabled scheduled job and then manually trigger a run for it.

        const job = await jobSchedulerService.createScheduledJob({
            brand_id: brandId,
            customer_id: customerId,
            job_type: jobType as JobType,
            cron_expression: '0 0 1 1 *', // Dummy cron (Jan 1st)
            is_active: false, // Don't run automatically
            metadata: { ...metadata, one_off: true },
        });

        const runDate = new Date(scheduledFor);
        const runId = await jobSchedulerService.enqueueJobRun(job.id, runDate);

        res.status(201).json({ message: 'One-off job scheduled', jobId: job.id, runId });
    } catch (error: any) {
        console.error('Error scheduling one-off job:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scheduled-jobs/retry-failures
 * Manually retry failed queries for a specific job run context
 */
router.post('/retry-failures', async (req, res) => {
    try {
        const { jobRunId, brandId, customerId } = req.body;

        if (!brandId || !customerId) {
            return res.status(400).json({ error: 'Missing brandId or customerId' });
        }

        // 1. Identify failed queries
        // We can filter by job_run_id if we have that linkage in query_executions (we created execution_id, but maybe not job_run_id directly?)
        // Actually, query_executions doesn't link to job_run_id directly usually, it links to brand/customer.
        // But we can filter by time range if we knew the job run time.

        // For now, let's just find ALL failed, recent queries for this brand (simple approach) 
        // OR expecting the frontend to pass the list of query IDs (more precise).

        // Better approach: create a "Retry Job" (data_collection_retry) and trigger it immediately.

        const job = await jobSchedulerService.createScheduledJob({
            brand_id: brandId,
            customer_id: customerId,
            job_type: 'data_collection_retry',
            cron_expression: '0 0 1 1 *', // Dummy
            is_active: false,
            metadata: {
                lookback_minutes: 60 * 24, // Retry failures from last 24 hours
                one_off_retry: true
            }
        });

        const runId = await jobSchedulerService.enqueueJobRun(job.id);

        res.status(200).json({ message: 'Retry job enqueued', jobId: job.id, runId });
    } catch (error: any) {
        console.error('Error retrying failures:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
