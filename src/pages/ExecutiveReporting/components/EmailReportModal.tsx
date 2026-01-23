import React, { useState } from 'react';
import { IconMail, IconSend, IconLoader, IconCheck, IconX } from '@tabler/icons-react';

interface EmailReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    brandName: string;
    onSend: (email: string) => Promise<void>;
}

export const EmailReportModal: React.FC<EmailReportModalProps> = ({
    isOpen,
    onClose,
    brandName,
    onSend
}) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        setStatus('idle');
        try {
            await onSend(email);
            setStatus('success');
            setTimeout(() => {
                onClose();
                setStatus('idle');
                setEmail('');
            }, 2000);
        } catch (error) {
            console.error(error);
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

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
                    <div className="w-12 h-12 bg-blue-50 text-[var(--accent-primary)] rounded-full flex items-center justify-center mb-4">
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
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all"
                                disabled={loading || status === 'success'}
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
                            disabled={!email || loading || status === 'success'}
                            className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${status === 'success'
                                    ? 'bg-green-500 hover:bg-green-600 text-white'
                                    : 'bg-[#00bcdc] hover:bg-[#0096b0] text-white shadow-lg shadow-blue-500/20'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {loading ? (
                                <>
                                    <IconLoader className="w-5 h-5 animate-spin" />
                                    Sending...
                                </>
                            ) : status === 'success' ? (
                                <>
                                    <IconCheck className="w-5 h-5" />
                                    Sent Successfully
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
