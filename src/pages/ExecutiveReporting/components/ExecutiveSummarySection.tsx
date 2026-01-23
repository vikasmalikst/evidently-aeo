/**
 * Executive Summary Section Component
 * Features gradient background and polished typography
 */

import { useState } from 'react';
import { IconSparkles, IconEdit, IconMessageDots, IconCheck, IconX, IconRefresh } from '@tabler/icons-react';

interface ExecutiveSummarySectionProps {
    summary: string;
    onUpdate?: (newSummary: string) => Promise<void>;
    onOpenFeedback?: () => void;
}

export const ExecutiveSummarySection = ({ summary, onUpdate, onOpenFeedback }: ExecutiveSummarySectionProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedSummary, setEditedSummary] = useState(summary);
    const [isLoading, setIsLoading] = useState(false);

    // Split summary by bullets or newlines for display
    const bullets = summary
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^[-•]\s*/, '').trim());

    const handleSave = async () => {
        if (!onUpdate) return;
        setIsLoading(true);
        try {
            await onUpdate(editedSummary);
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update summary:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="executive-section executive-summary-section">
            <div className="executive-section-header flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="executive-section-icon summary">
                        <IconSparkles className="w-5 h-5 text-[var(--accent-primary)]" />
                    </div>
                    <h2 className="executive-section-title">Executive Summary</h2>
                </div>

                <div className="flex items-center gap-2">
                    {!isEditing && (
                        <>
                            <button
                                onClick={() => {
                                    setEditedSummary(summary);
                                    setIsEditing(true);
                                }}
                                className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                                title="Edit Summary"
                            >
                                <IconEdit className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onOpenFeedback}
                                className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                                title="Add Feedback & Regenerate"
                            >
                                <IconMessageDots className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="executive-summary-content mt-4">
                {isEditing ? (
                    <div className="space-y-4">
                        <textarea
                            value={editedSummary}
                            onChange={(e) => setEditedSummary(e.target.value)}
                            className="w-full min-h-[200px] p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl text-[var(--text-body)] text-sm focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all"
                            placeholder="Enter executive summary..."
                        />
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                                disabled={isLoading}
                            >
                                <IconX className="w-4 h-4 inline-block mr-1" />
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm font-medium text-white bg-[var(--accent-primary)] hover:bg-[#0096b0] rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </span>
                                ) : (
                                    <>
                                        <IconCheck className="w-4 h-4 inline-block mr-1" />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {bullets.map((bullet, index) => (
                            <div
                                key={index}
                                className="executive-summary-bullet"
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                {bullet}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

