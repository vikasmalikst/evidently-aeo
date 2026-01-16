/**
 * Executive Summary Section Component
 * Features gradient background and polished typography
 */

import { IconSparkles } from '@tabler/icons-react';

interface ExecutiveSummarySectionProps {
    summary: string;
}

export const ExecutiveSummarySection = ({ summary }: ExecutiveSummarySectionProps) => {
    // Split summary by bullets or newlines
    const bullets = summary
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^[-•]\s*/, '').trim());

    return (
        <div className="executive-section">
            <div className="executive-section-header">
                <div className="executive-section-icon summary">
                    <IconSparkles className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <h2 className="executive-section-title">Executive Summary</h2>
            </div>

            <div className="executive-summary-content">
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
            </div>
        </div>
    );
};

