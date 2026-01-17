import React, { useState, useEffect } from 'react';
import {
    IconCheck,
    IconX,
} from '@tabler/icons-react';

interface ReportGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    brandName: string;
    onGenerate: () => Promise<void>;
}

type Step = 'idle' | 'generating' | 'completed';

export const ReportGenerationModal: React.FC<ReportGenerationModalProps> = ({
    isOpen,
    onClose,
    brandName,
    onGenerate,
}) => {
    const [step, setStep] = useState<Step>('idle');
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('Initializing...');

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen && step === 'idle') {
            startGeneration();
        }
    }, [isOpen]);

    const startGeneration = async () => {
        setStep('generating');
        setProgress(0);

        // Simulate progress for better UX while real API calls happen
        const progressInterval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) return prev;
                return prev + Math.random() * 10;
            });
        }, 500);

        // Progress text simulation
        const textTimeouts = [
            setTimeout(() => setStatusText('Aggregating brand data...'), 1000),
            setTimeout(() => setStatusText('Analyzing competitive landscape...'), 3000),
            setTimeout(() => setStatusText('Calculating detailed metrics...'), 5000),
            setTimeout(() => setStatusText('Generate executive summary...'), 7000),
            setTimeout(() => setStatusText('Finalizing report...'), 9000),
        ];

        try {
            await onGenerate();
            clearInterval(progressInterval);
            setProgress(100);
            setStatusText('Report generated successfully!');
            setTimeout(() => setStep('completed'), 500);
        } catch (error) {
            console.error(error);
            setStatusText('Failed to generate report');
            // Handle error state appropriately
        } finally {
            clearInterval(progressInterval);
            textTimeouts.forEach(clearTimeout);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-slate-50 border-b border-gray-100 p-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">
                            {step === 'completed' ? 'Report Ready' : 'Generating Report'}
                        </h3>
                        <p className="text-sm text-slate-500">
                            {brandName} • Executive Summary
                        </p>
                    </div>
                    {step === 'completed' && (
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <IconX className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-8">
                    {step === 'generating' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-6">
                            <div className="relative w-24 h-24">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                        cx="48"
                                        cy="48"
                                        r="40"
                                        stroke="currentColor"
                                        strokeWidth="8"
                                        fill="transparent"
                                        className="text-slate-100"
                                    />
                                    <circle
                                        cx="48"
                                        cy="48"
                                        r="40"
                                        stroke="currentColor"
                                        strokeWidth="8"
                                        fill="transparent"
                                        strokeDasharray={251.2}
                                        strokeDashoffset={251.2 - (251.2 * progress) / 100}
                                        className="text-[var(--accent-primary)] transition-all duration-500 ease-out"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-lg font-bold text-[var(--accent-primary)]">
                                        {Math.round(progress)}%
                                    </span>
                                </div>
                            </div>
                            <div className="text-center space-y-2">
                                <h4 className="text-lg font-medium text-slate-700 animate-pulse">
                                    {statusText}
                                </h4>
                                <p className="text-sm text-slate-400">
                                    This may take up to a minute...
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 'completed' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom duration-300">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <IconCheck className="w-8 h-8" />
                                </div>
                                <h4 className="text-xl font-bold text-slate-800">
                                    Analysis Complete
                                </h4>
                                <p className="text-slate-500">
                                    Your executive report has been successfully generated.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={onClose}
                                    className="w-full px-4 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-dark)] text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                                >
                                    View Report
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
