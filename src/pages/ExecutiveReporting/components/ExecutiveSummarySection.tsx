/**
 * Executive Summary Section Component
 */

import { IconSparkles } from '@tabler/icons-react';

interface ExecutiveSummarySectionProps {
    summary: string;
}

export const ExecutiveSummarySection = ({ summary }: ExecutiveSummarySectionProps) => {
    // Split summary by bullets
    const bullets = summary
        .split('\n')
        .filter(line => line.trim().length > 0);

    return (
        <div className="bg-white rounded-lg p-6 border border-[var(--border-default)]">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[var(--accent-primary)]/10 rounded-lg">
                    <IconSparkles className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-headings)]">
                    Executive Summary
                </h2>
            </div>

            <div className="bg-[var(--bg-secondary)] border-l-4 border-[var(--accent-primary)] p-6 rounded">
                <div className="space-y-3">
                    {bullets.map((bullet, index) => (
                        <p key={index} className="text-[var(--text-body)] leading-relaxed">
                            {bullet}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
};
