import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../lib/apiClient';
import { IconLoader2, IconBrain, IconSearch, IconCheck, IconAlertTriangle } from '@tabler/icons-react';

interface ResearchStepProps {
    brandName: string;
    country: string;
    websiteUrl: string;
    onComplete: (data: any) => void;
    onBack: () => void;
}

const RESEARCH_PHASES = [
    { label: 'Connecting to research engine...', icon: IconBrain, duration: 2000 },
    { label: 'Analyzing company website...', icon: IconSearch, duration: 4000 },
    { label: 'Identifying competitors in your market...', icon: IconSearch, duration: 6000 },
    { label: 'Generating branded search queries...', icon: IconSearch, duration: 4000 },
    { label: 'Generating neutral search queries...', icon: IconSearch, duration: 4000 },
    { label: 'Validating and formatting results...', icon: IconCheck, duration: 3000 },
];

export const ResearchStep = ({ brandName, country, websiteUrl, onComplete, onBack }: ResearchStepProps) => {
    const [currentPhase, setCurrentPhase] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);
    const hasStarted = useRef(false);

    useEffect(() => {
        if (hasStarted.current) return;
        hasStarted.current = true;

        // Animate through phases while waiting for API
        const phaseTimers: ReturnType<typeof setTimeout>[] = [];
        let totalDelay = 0;

        RESEARCH_PHASES.forEach((phase, idx) => {
            if (idx === 0) return; // Phase 0 is already showing
            totalDelay += phase.duration;
            phaseTimers.push(setTimeout(() => {
                setCurrentPhase(idx);
            }, totalDelay));
        });

        // Fire the actual API call
        const doResearch = async () => {
            try {
                const response = await apiClient.request<{ success: boolean; data: any; error?: string }>(
                    '/onboarding-v2/research',
                    {
                        method: 'POST',
                        body: JSON.stringify({ brandName, country, websiteUrl }),
                    },
                    { requiresAuth: true, timeout: 120000 }
                );

                if (response.success && response.data) {
                    // Clear phase timers
                    phaseTimers.forEach(clearTimeout);
                    setCurrentPhase(RESEARCH_PHASES.length - 1);
                    setIsComplete(true);

                    // Small delay so user sees the "complete" state
                    setTimeout(() => {
                        onComplete(response.data);
                    }, 1500);
                } else {
                    phaseTimers.forEach(clearTimeout);
                    setError(response.error || 'Research failed. Please try again.');
                }
            } catch (err: any) {
                phaseTimers.forEach(clearTimeout);
                setError(err.message || 'Research failed. Please try again.');
            }
        };

        doResearch();

        return () => {
            phaseTimers.forEach(clearTimeout);
        };
    }, [brandName, country, websiteUrl, onComplete]);

    return (
        <div className="max-w-xl mx-auto text-center">
            <div className="mb-10">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-6 shadow-lg">
                    {error ? (
                        <IconAlertTriangle size={36} />
                    ) : isComplete ? (
                        <IconCheck size={36} />
                    ) : (
                        <IconBrain size={36} className="animate-pulse" />
                    )}
                </div>

                <h2 className="text-2xl font-bold text-[var(--text-headings)] mb-2">
                    {error ? 'Research Failed' : isComplete ? 'Research Complete!' : 'Researching Your Brand'}
                </h2>

                {!error && !isComplete && (
                    <p className="text-[var(--text-caption)] mb-1">
                        AI is analyzing <strong className="text-[var(--text-headings)]">{brandName}</strong> using live web data.
                    </p>
                )}

                {!error && !isComplete && (
                    <p className="text-xs text-[var(--text-caption)]">
                        This usually takes 30–90 seconds.
                    </p>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="mb-8">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-left mb-6">
                        <p className="text-sm text-red-700 font-medium mb-1">Something went wrong</p>
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={onBack}
                            className="px-6 py-2.5 rounded-lg border border-[var(--border-default)] text-[var(--text-body)] font-medium hover:bg-gray-50 transition-colors"
                        >
                            Go Back
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}

            {/* Progress Phases */}
            {!error && (
                <div className="space-y-3 text-left max-w-sm mx-auto">
                    {RESEARCH_PHASES.map((phase, idx) => {
                        const isActive = idx === currentPhase && !isComplete;
                        const isDone = idx < currentPhase || isComplete;
                        const isPending = idx > currentPhase && !isComplete;
                        const Icon = phase.icon;

                        return (
                            <div
                                key={idx}
                                className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-500 ${isActive ? 'bg-indigo-50 border border-indigo-200' :
                                        isDone ? 'opacity-60' :
                                            'opacity-30'
                                    }`}
                            >
                                <div className="flex-shrink-0">
                                    {isDone ? (
                                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                            <IconCheck size={14} className="text-white" />
                                        </div>
                                    ) : isActive ? (
                                        <IconLoader2 size={20} className="text-indigo-600 animate-spin" />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                                    )}
                                </div>
                                <span className={`text-sm ${isActive ? 'text-indigo-800 font-medium' :
                                        isDone ? 'text-gray-600' :
                                            'text-gray-400'
                                    }`}>
                                    {phase.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Context info */}
            {!error && !isComplete && (
                <div className="mt-8 rounded-xl bg-gray-50 border border-gray-100 p-4 text-xs text-gray-500">
                    <p>Researching: <strong>{brandName}</strong> • Market: <strong>{country}</strong></p>
                    <p className="mt-0.5">{websiteUrl}</p>
                </div>
            )}
        </div>
    );
};
