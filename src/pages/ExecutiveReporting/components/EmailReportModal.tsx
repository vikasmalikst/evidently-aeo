import React, { useState } from 'react';
import { IconMail, IconSend, IconLoader, IconCheck, IconX } from '@tabler/icons-react';

interface EmailReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    brandName: string;
    onSend: (email: string) => Promise<void>;
    themeColor?: string;
}

export const EmailReportModal: React.FC<EmailReportModalProps> = ({
    isOpen,
    onClose,
    brandName,
    onSend,
    themeColor = '#00bcdc' // Default accent
}) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        setStatus('idle');
        setStatusMessage('Preparing report data...');

        const progressSteps = [
            'Generating high-fidelity PDF attachment...',
            'Connecting to Zoho secure mail server...',
            'Finalizing and sending email...'
        ];

        let stepIndex = 0;
        const interval = setInterval(() => {
            if (stepIndex < progressSteps.length) {
                setStatusMessage(progressSteps[stepIndex]);
                stepIndex++;
            }
        }, 6000);

        try {
            await onSend(email);
            clearInterval(interval);
            setStatus('success');
            // Remove auto-close to let user see the success message
        } catch (error) {
            clearInterval(interval);
            console.error(error);
            setStatus('error');
            setStatusMessage('');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
        // Reset state after transition
        setTimeout(() => {
            setStatus('idle');
            setEmail('');
            setStatusMessage('');
        }, 300);
    };

    if (!isOpen) return null;

    if (status === 'success') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden relative p-8 text-center animate-in zoom-in-95 duration-200">
                    <div
                        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                        style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                    >
                        <IconCheck className="w-8 h-8" />
                    </div>

                    <h3 className="text-xl font-bold text-slate-800 mb-2">Email Sent!</h3>
                    <p className="text-slate-500 mb-8">
                        The executive report for <strong>{brandName}</strong> has been successfully sent to <strong>{email}</strong>.
                    </p>

                    <button
                        onClick={handleClose}
                        className="w-full py-3 rounded-xl font-medium text-white transition-colors hover:opacity-90"
                        style={{ backgroundColor: themeColor }}
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <IconX className="w-5 h-5" />
                </button>

                <div className="p-6">
                    <div
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                        style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                    >
                        <IconMail className="w-6 h-6" />
                    </div>

                    <h3 className="text-xl font-bold text-slate-800 mb-2">Email Executive Report</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Send the <strong>{brandName}</strong> executive report to clear stakeholders. The email will contain the full formatted report.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                Recipient Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                                style={{ '--tw-ring-color': themeColor } as React.CSSProperties}
                                disabled={loading}
                                autoFocus
                            />
                        </div>

                        {status === 'error' && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                                <IconX className="w-4 h-4" />
                                Failed to send email. Please try again.
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!email || loading}
                            className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
                        >
                            {loading ? (
                                <>
                                    <IconLoader className="w-5 h-5 animate-spin" />
                                    {statusMessage || 'Sending...'}
                                </>
                            ) : (
                                <>
                                    <IconSend className="w-5 h-5" />
                                    Send Report
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
