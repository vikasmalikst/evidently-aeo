import React, { useState, useEffect } from 'react';
import { IconX, IconMessageDots, IconRefresh, IconLoader, IconBulb, IconDeviceFloppy, IconCheck, IconGripVertical, IconMinus } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FeedbackSideModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentSummary: string;
    onRegenerate: (feedback: string) => Promise<void>;
    brandId?: string;
}

export const FeedbackSideModal: React.FC<FeedbackSideModalProps> = ({
    isOpen,
    onClose,
    currentSummary,
    onRegenerate,
    brandId
}) => {
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    // Load from local cache on mount or when brandId changes
    useEffect(() => {
        if (brandId) {
            const cachedFeedback = localStorage.getItem(`executive_feedback_${brandId}`);
            if (cachedFeedback) {
                setFeedback(cachedFeedback);
            }
        }
    }, [brandId]);

    // Auto-save to local cache as user types
    useEffect(() => {
        if (brandId && feedback) {
            const timer = setTimeout(() => {
                localStorage.setItem(`executive_feedback_${brandId}`, feedback);
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 2000);
            }, 1000); // Save after 1 second of inactivity
            return () => clearTimeout(timer);
        }
    }, [feedback, brandId]);

    const handleSave = () => {
        if (brandId) {
            localStorage.setItem(`executive_feedback_${brandId}`, feedback);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        }
    };

    const handleRegenerate = async () => {
        if (!feedback.trim()) return;
        setIsLoading(true);
        try {
            await onRegenerate(feedback);
            // After successful regeneration, we might want to close or minimize
            setIsMinimized(true);
        } catch (error) {
            console.error('Failed to regenerate summary:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <div className="fixed inset-0 pointer-events-none z-[101]">
                    {isMinimized ? (
                        /* Minimized Bubble State */
                        <motion.div
                            key="minimized-bubble"
                            drag
                            dragConstraints={{ left: -window.innerWidth, right: 0, top: 0, bottom: window.innerHeight }}
                            dragMomentum={false}
                            initial={{ scale: 0, opacity: 0, x: 20, y: 20 }}
                            animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
                            exit={{ scale: 0, opacity: 0, x: 20, y: 20 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsMinimized(false)}
                            className="pointer-events-auto absolute bottom-10 right-10 w-16 h-16 bg-gradient-to-r from-[var(--accent-primary)] to-[#0096b0] rounded-full shadow-2xl flex items-center justify-center cursor-pointer group border-4 border-white"
                        >
                            <IconMessageDots className="w-8 h-8 text-white group-hover:animate-pulse" />
                            {feedback && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                    !
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        /* Full Workspace UI */
                        <motion.div 
                            key="full-workspace"
                            drag
                            dragConstraints={{ left: -window.innerWidth, right: 0, top: 0, bottom: window.innerHeight }}
                            dragMomentum={false}
                            initial={{ x: 300, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 300, opacity: 0 }}
                            className="pointer-events-auto fixed top-20 right-6 bottom-6 w-full max-w-md bg-white shadow-2xl flex flex-col rounded-2xl border border-slate-200 overflow-hidden cursor-default"
                        >
                            {/* Header - Drag Handle */}
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 cursor-move active:cursor-grabbing">
                                <div className="flex items-center gap-3">
                                    <div className="text-slate-400">
                                        <IconGripVertical size={20} />
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center">
                                        <IconMessageDots className="w-5 h-5 text-[var(--accent-primary)]" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-800">Refine Summary</h3>
                                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Movable Workspace</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => setIsMinimized(true)}
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Minimize to bubble"
                                    >
                                        <IconMinus className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={onClose}
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Close workspace"
                                    >
                                        <IconX className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Current Summary Preview (Collapsible or truncated) */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                                        <IconBulb className="w-4 h-4" />
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider">Reference Summary</h4>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 leading-relaxed max-h-32 overflow-y-auto italic">
                                        {currentSummary}
                                    </div>
                                </div>

                                {/* Feedback Input */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-slate-800">Notes & Instructions</h4>
                                        <div className="flex items-center gap-2">
                                            {isSaved && (
                                                <span className="text-[10px] text-green-600 flex items-center gap-1 animate-in fade-in zoom-in">
                                                    <IconCheck size={12} /> Saved
                                                </span>
                                            )}
                                            <button 
                                                onClick={handleSave}
                                                className="p-1.5 text-slate-400 hover:text-[var(--accent-primary)] transition-colors"
                                                title="Save to local cache"
                                            >
                                                <IconDeviceFloppy size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <textarea
                                        value={feedback}
                                        onChange={(e) => {
                                            setFeedback(e.target.value);
                                            if (isSaved) setIsSaved(false);
                                        }}
                                        placeholder="Type your notes here... You can navigate the screen while this stays open."
                                        className="w-full min-h-[200px] p-4 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all placeholder:text-slate-400 shadow-sm resize-none"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            "Concise",
                                            "Professional",
                                            "Highlight Growth",
                                            "Focus Risks"
                                        ].map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                onClick={() => {
                                                    setFeedback(prev => prev + (prev ? ', ' : '') + suggestion);
                                                    if (isSaved) setIsSaved(false);
                                                }}
                                                className="px-2.5 py-1.5 text-[10px] font-medium text-slate-500 hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 border border-slate-100 rounded-lg transition-all"
                                            >
                                                + {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-5 border-t border-slate-100 bg-slate-50/30">
                                <button
                                    onClick={handleRegenerate}
                                    disabled={isLoading || !feedback.trim()}
                                    className="w-full py-3.5 bg-gradient-to-r from-[var(--accent-primary)] to-[#0096b0] text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2 text-sm"
                                >
                                    {isLoading ? (
                                        <>
                                            <IconLoader className="w-5 h-5 animate-spin" />
                                            Regenerating...
                                        </>
                                    ) : (
                                        <>
                                            <IconRefresh className="w-5 h-5" />
                                            Update Summary
                                        </>
                                    )}
                                </button>
                                <p className="text-[10px] text-center text-slate-400 mt-3 px-2 leading-relaxed">
                                    Regenerating will update the report in the database.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}
        </AnimatePresence>
    );
};