/**
 * Report Scheduling Service
 * 
 * Manages automated report scheduling and delivery.
 */

import { supabase } from '../../config/supabase';
import type { ReportSchedule, CreateScheduleRequest } from './types';

export class ScheduleService {
    /**
     * Get all schedules for a brand
     */
    async getSchedules(brandId: string): Promise<ReportSchedule[]> {
        const { data, error } = await supabase
            .from('report_schedules')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ [SCHEDULE] Error fetching schedules:', error);
            return [];
        }

        return data as ReportSchedule[];
    }

    /**
     * Create a new schedule
     */
    async createSchedule(request: CreateScheduleRequest): Promise<ReportSchedule> {
        // Calculate next send date based on frequency
        const nextSendAt = this.calculateNextSendDate(request.frequency);

        const { data, error } = await supabase
            .from('report_schedules')
            .insert({
                brand_id: request.brand_id,
                frequency: request.frequency,
                reporting_period_days: request.reporting_period_days,
                recipients: request.recipients,
                is_active: true,
                next_send_at: nextSendAt.toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('❌ [SCHEDULE] Error creating schedule:', error);
            throw new Error(`Failed to create schedule: ${error.message}`);
        }

        return data as ReportSchedule;
    }

    /**
     * Update a schedule
     */
    async updateSchedule(scheduleId: string, updates: Partial<ReportSchedule>): Promise<ReportSchedule> {
        // If frequency is being updated, recalculate next_send_at
        if (updates.frequency) {
            updates.next_send_at = this.calculateNextSendDate(updates.frequency).toISOString();
        }

        const { data, error } = await supabase
            .from('report_schedules')
            .update(updates)
            .eq('id', scheduleId)
            .select()
            .single();

        if (error) {
            console.error('❌ [SCHEDULE] Error updating schedule:', error);
            throw new Error(`Failed to update schedule: ${error.message}`);
        }

        return data as ReportSchedule;
    }

    /**
     * Delete a schedule
     */
    async deleteSchedule(scheduleId: string): Promise<boolean> {
        const { error } = await supabase
            .from('report_schedules')
            .delete()
            .eq('id', scheduleId);

        if (error) {
            console.error('❌ [SCHEDULE] Error deleting schedule:', error);
            return false;
        }

        return true;
    }

    /**
     * Get schedules that are due for sending
     */
    async getDueSchedules(): Promise<ReportSchedule[]> {
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('report_schedules')
            .select('*')
            .eq('is_active', true)
            .lte('next_send_at', now);

        if (error) {
            console.error('❌ [SCHEDULE] Error fetching due schedules:', error);
            return [];
        }

        return data as ReportSchedule[];
    }

    /**
     * Update schedule after sending
     */
    async markScheduleAsSent(scheduleId: string, frequency: string): Promise<void> {
        const nextSendAt = this.calculateNextSendDate(frequency as any);

        await supabase
            .from('report_schedules')
            .update({
                last_sent_at: new Date().toISOString(),
                next_send_at: nextSendAt.toISOString(),
            })
            .eq('id', scheduleId);
    }

    /**
     * Calculate next send date based on frequency
     */
    private calculateNextSendDate(frequency: 'weekly' | 'biweekly' | 'monthly'): Date {
        const now = new Date();
        const next = new Date(now);

        switch (frequency) {
            case 'weekly':
                next.setDate(next.getDate() + 7);
                break;
            case 'biweekly':
                next.setDate(next.getDate() + 14);
                break;
            case 'monthly':
                next.setMonth(next.getMonth() + 1);
                break;
        }

        // Set to 9 AM on the calculated date
        next.setHours(9, 0, 0, 0);

        return next;
    }
}

export const scheduleService = new ScheduleService();
