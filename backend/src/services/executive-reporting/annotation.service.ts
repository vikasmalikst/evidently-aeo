/**
 * Annotation Service
 * 
 * Manages collaborative annotations and comments on reports.
 */

import { supabase } from '../../config/supabase';
import type { ReportAnnotation, AddCommentRequest } from './types';

export class AnnotationService {
    /**
     * Get all comments for a report
     */
    async getComments(reportId: string): Promise<ReportAnnotation[]> {
        const { data, error } = await supabase
            .from('report_annotations')
            .select('*')
            .eq('report_id', reportId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ [ANNOTATION] Error fetching comments:', error);
            return [];
        }

        return data as ReportAnnotation[];
    }

    /**
     * Add a new comment
     */
    async addComment(request: AddCommentRequest, userId: string): Promise<ReportAnnotation> {
        const { data, error } = await supabase
            .from('report_annotations')
            .insert({
                report_id: request.report_id,
                section_id: request.section_id,
                target_id: request.target_id || null,
                comment: request.comment,
                author_id: userId,
                mentions: request.mentions || [],
                status: request.status || null,
                parent_comment_id: request.parent_comment_id || null,
            })
            .select()
            .single();

        if (error) {
            console.error('❌ [ANNOTATION] Error adding comment:', error);
            throw new Error(`Failed to add comment: ${error.message}`);
        }

        // TODO: Send notifications to mentioned users

        return data as ReportAnnotation;
    }

    /**
     * Update a comment
     */
    async updateComment(commentId: string, updates: Partial<ReportAnnotation>): Promise<ReportAnnotation> {
        const { data, error } = await supabase
            .from('report_annotations')
            .update(updates)
            .eq('id', commentId)
            .select()
            .single();

        if (error) {
            console.error('❌ [ANNOTATION] Error updating comment:', error);
            throw new Error(`Failed to update comment: ${error.message}`);
        }

        return data as ReportAnnotation;
    }

    /**
     * Delete a comment
     */
    async deleteComment(commentId: string): Promise<boolean> {
        const { error } = await supabase
            .from('report_annotations')
            .delete()
            .eq('id', commentId);

        if (error) {
            console.error('❌ [ANNOTATION] Error deleting comment:', error);
            return false;
        }

        return true;
    }

    /**
     * Get comments by section
     */
    async getCommentsBySection(reportId: string, sectionId: string): Promise<ReportAnnotation[]> {
        const { data, error } = await supabase
            .from('report_annotations')
            .select('*')
            .eq('report_id', reportId)
            .eq('section_id', sectionId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ [ANNOTATION] Error fetching section comments:', error);
            return [];
        }

        return data as ReportAnnotation[];
    }

    /**
     * Get comment threads (parent + replies)
     */
    async getCommentThreads(reportId: string): Promise<Map<string, ReportAnnotation[]>> {
        const allComments = await this.getComments(reportId);

        const threads = new Map<string, ReportAnnotation[]>();

        // Group by parent_comment_id
        allComments.forEach(comment => {
            const parentId = comment.parent_comment_id || 'root';

            if (!threads.has(parentId)) {
                threads.set(parentId, []);
            }

            threads.get(parentId)!.push(comment);
        });

        return threads;
    }
}

export const annotationService = new AnnotationService();
