import React, { useState, useRef } from 'react';
import { IconUpload, IconFileText, IconCheck, IconX, IconLoader } from '@tabler/icons-react';
import { uploadContextV3 } from '../../../api/recommendationsV3Api';

interface ContextUploadSectionProps {
    recommendationId: string;
    existingContext?: string;
    onContextUpdated: (newContext: string) => void;
    isEditing: boolean;
}

export const ContextUploadSection: React.FC<ContextUploadSectionProps> = ({
    recommendationId,
    existingContext,
    onContextUpdated,
    isEditing
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [lastFileName, setLastFileName] = useState<string | null>(null);
    const [showDebug, setShowDebug] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (file.size > 5 * 1024 * 1024) {
            setUploadError('File size must be less than 5MB');
            return;
        }

        setIsUploading(true);
        setUploadError(null);
        setUploadSuccess(false);

        try {
            const response = await uploadContextV3(recommendationId, { file });
            if (response.success && response.data?.context) {
                onContextUpdated(response.data.context);
                setLastFileName(file.name);
                setUploadSuccess(true);
                // Keep success visible but reset after a bit for "freshness"
                setTimeout(() => setUploadSuccess(false), 5000);
            } else {
                setUploadError(response.error || 'Failed to upload file');
            }
        } catch (err: any) {
            setUploadError(err.message || 'Error uploading file');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const charCount = existingContext?.length || 0;
    const wordCount = existingContext?.split(/\s+/).filter(Boolean).length || 0;

    return (
        <div className="space-y-4">
            {/* Prominent Upload Area */}
            <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800/50 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-all group ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".pdf,.txt,.md"
                    className="hidden"
                />

                <div className="mb-2 p-3 bg-slate-800 rounded-full group-hover:bg-slate-700 transition-colors">
                    {isUploading ? (
                        <IconLoader className="w-6 h-6 text-indigo-400 animate-spin" />
                    ) : (
                        <IconUpload className="w-6 h-6 text-indigo-400" />
                    )}
                </div>

                <p className="text-sm text-slate-300 font-medium mb-1">
                    {isUploading ? 'Uploading...' : 'Click to Upload Information'}
                </p>
                <p className="text-xs text-slate-500 text-center max-w-[200px]">
                    Supported files: PDF, TXT, MD. Max 5MB.
                </p>
            </div>

            {/* Post-Upload Feedback */}
            {(lastFileName || uploadSuccess) && (
                <div className="flex items-center justify-between px-3 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2">
                        <div className="p-1 bg-emerald-500/20 rounded">
                            <IconCheck className="w-3 h-3 text-emerald-400" />
                        </div>
                        <span className="text-xs text-emerald-400 font-medium">
                            {lastFileName ? `Extracted from ${lastFileName}` : 'Context sync successful'}
                        </span>
                    </div>
                    {isUploading && <IconLoader className="w-3 h-3 text-emerald-400 animate-spin" />}
                </div>
            )}

            <div className="flex items-center gap-3">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-xs text-slate-500 font-medium text-transform uppercase">Or paste text</span>
                <div className="h-px bg-slate-800 flex-1" />
            </div>

            {/* Error Messages */}
            {uploadError && (
                <div className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded flex items-center gap-2">
                    <IconX className="w-3 h-3" />
                    {uploadError}
                </div>
            )}

            {/* Context Display Area */}
            <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span>{charCount} chars</span>
                        <span>•</span>
                        <span>{wordCount} words</span>
                    </div>
                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                    >
                        {showDebug ? 'Hide Debug' : 'Show Debug'}
                    </button>
                </div>

                {showDebug && (
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded-md text-[10px] font-mono text-slate-400 space-y-1">
                        <div className="flex justify-between">
                            <span className="text-slate-600">ID:</span>
                            <span>{recommendationId}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600">Sync Status:</span>
                            <span className={uploadSuccess ? 'text-emerald-500' : ''}>
                                {uploadSuccess ? 'Recently Synced' : 'Loaded'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600">File:</span>
                            <span>{lastFileName || 'None'}</span>
                        </div>
                    </div>
                )}

                <div className="relative group">
                    <textarea
                        value={existingContext || ''}
                        onChange={(e) => onContextUpdated(e.target.value)}
                        disabled={!isEditing}
                        placeholder="Add specific brand facts, product details, or constraints here. Or upload a file above."
                        className={`w-full h-32 px-3 py-2 rounded-md bg-slate-900/50 border text-sm transition-all resize-none font-mono focus:outline-none
                        ${isEditing
                                ? 'border-slate-700 text-slate-200 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 placeholder:text-slate-600'
                                : 'border-transparent text-slate-400 cursor-default'
                            }`}
                    />
                    {!existingContext && !isEditing && (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm pointer-events-none">
                            No additional context provided.
                        </div>
                    )}
                </div>
            </div>


        </div >
    );
};
