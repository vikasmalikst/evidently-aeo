import React, { useState, useEffect } from 'react';
import {
    X, Upload, FileText, Trash2, AlertCircle, CheckCircle,
    File as FileIcon, RefreshCw, ChevronDown, ChevronRight
} from 'lucide-react';
import {
    uploadContextFile,
    deleteContextFile,
    updateContextNotes
} from '../../../api/recommendationsV3Api';
import { TemplatePlan, ContextFile } from '../../../../backend/src/services/recommendations/recommendation.types';

interface ContextManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    plan: TemplatePlan;
    onPlanUpdated: (updatedPlan: TemplatePlan) => void;
}

export const ContextManagerModal: React.FC<ContextManagerModalProps> = ({
    isOpen,
    onClose,
    plan,
    onPlanUpdated
}) => {
    const [activeTab, setActiveTab] = useState<'files' | 'notes'>('files');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
    const [quickNotes, setQuickNotes] = useState(plan.additional_context || '');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [notesSaved, setNotesSaved] = useState(false);

    // Sync internal state if plan changes externally
    useEffect(() => {
        setQuickNotes(plan.additional_context || '');
    }, [plan.additional_context]);

    if (!isOpen) return null;

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    const handleFileUpload = async (file: File) => {
        // Validate file type
        const validTypes = ['application/pdf', 'text/plain', 'text/markdown', 'application/json'];
        if (!validTypes.includes(file.type) && !file.name.endsWith('.md')) {
            setUploadError('Invalid file type. Please upload PDF, TXT, MD, or JSON.');
            return;
        }

        // Validate size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            setUploadError('File too large. Maximum size is 5MB.');
            return;
        }

        setIsUploading(true);
        setUploadError(null);
        setUploadSuccess(null);

        try {
            const result = await uploadContextFile(plan.recommendationId, file);

            if (result.success && result.data) {
                onPlanUpdated(result.data);
                setUploadSuccess(`Successfully uploaded ${file.name}`);
                setTimeout(() => setUploadSuccess(null), 3000);
            } else {
                setUploadError(result.error || 'Failed to upload file');
            }
        } catch (err: any) {
            setUploadError(err.message || 'An error occurred during upload');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteFile = async (fileId: string) => {
        try {
            const result = await deleteContextFile(plan.recommendationId, fileId);

            if (result.success && result.data) {
                onPlanUpdated(result.data);
            } else {
                setUploadError(result.error || 'Failed to delete file');
            }
        } catch (err: any) {
            setUploadError(err.message || 'An error occurred during deletion');
        }
    };

    const handleSaveNotes = async () => {
        setIsSavingNotes(true);
        try {
            const result = await updateContextNotes(plan.recommendationId, quickNotes);

            if (result.success && result.data) {
                onPlanUpdated(result.data);
                setNotesSaved(true);
                setTimeout(() => setNotesSaved(false), 2000); // Reset success check after 2s
            } else {
                setUploadError(result.error || 'Failed to save notes');
            }
        } catch (err: any) {
            setUploadError(err.message || 'Error saving notes');
        } finally {
            setIsSavingNotes(false);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <FileIcon className="w-5 h-5 text-indigo-600" />
                            Manage Context & Assets
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Upload files or add notes to guide the AI generation.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-6">
                    <button
                        onClick={() => setActiveTab('files')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'files'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Files ({plan.context_files?.length || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('notes')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'notes'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Quick Notes
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    {activeTab === 'files' ? (
                        <div className="space-y-6">
                            {/* Upload Zone */}
                            <div
                                className={`
                  border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
                  ${dragActive
                                        ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
                                        : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                                    }
                `}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                            >
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
                                        {isUploading ? (
                                            <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                                        ) : (
                                            <Upload className="w-6 h-6 text-indigo-600" />
                                        )}
                                    </div>

                                    {isUploading ? (
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-gray-900">Parsing & Uploading...</p>
                                            <p className="text-xs text-gray-500">Extracting text content from file</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    Click to upload or drag and drop
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    PDF, TXT, MD, JSON (max 5MB)
                                                </p>
                                            </div>
                                            <input
                                                type="file"
                                                className="hidden"
                                                id="context-upload"
                                                accept=".pdf,.txt,.md,.json"
                                                onChange={(e) => e.target.files && e.target.files[0] && handleFileUpload(e.target.files[0])}
                                            />
                                            <label
                                                htmlFor="context-upload"
                                                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 cursor-pointer shadow-sm transition-all"
                                            >
                                                Select File
                                            </label>
                                        </>
                                    )}
                                </div>
                            </div>

                            {uploadError && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {uploadError}
                                </div>
                            )}

                            {uploadSuccess && (
                                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                                    <CheckCircle className="w-4 h-4 shrink-0" />
                                    {uploadSuccess}
                                </div>
                            )}

                            {/* File List */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-gray-900">Attached Files</h3>
                                {!plan.context_files || plan.context_files.length === 0 ? (
                                    <div className="text-center py-8 bg-white rounded-lg border border-gray-100">
                                        <p className="text-sm text-gray-400">No files attached yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {plan.context_files.map((file) => (
                                            <div
                                                key={file.id}
                                                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                                        <span className="text-xs font-bold text-gray-500 uppercase">
                                                            {file.type.split('/')[1] || 'FILE'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]" title={file.name}>
                                                            {file.name}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" />
                                                        parsed
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteFile(file.id)}
                                                        className="p-1.5 hover:bg-red-50 hover:text-red-600 text-gray-400 rounded-md transition-colors"
                                                        title="Remove file"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 h-full flex flex-col">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Add Quick Notes / Instructions
                                </label>
                                <textarea
                                    value={quickNotes}
                                    onChange={(e) => setQuickNotes(e.target.value)}
                                    className="w-full h-[300px] p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm leading-relaxed"
                                    placeholder="Paste text snippets, brand facts, or specific instructions for the AI here..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <span className="text-xs text-gray-400 self-center">
                                    {quickNotes.length} characters
                                </span>
                                <button
                                    onClick={handleSaveNotes}
                                    disabled={isSavingNotes}
                                    className={`
                    px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all
                    ${notesSaved
                                            ? 'bg-green-600 text-white'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                                >
                                    {isSavingNotes ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : notesSaved ? (
                                        <CheckCircle className="w-4 h-4" />
                                    ) : (
                                        <FileText className="w-4 h-4" />
                                    )}
                                    {isSavingNotes ? 'Saving...' : notesSaved ? 'Saved!' : 'Save Notes'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center rounded-b-xl">
                    <div className="text-xs text-gray-500">
                        Total Context Size: <span className="font-medium text-gray-700">
                            {formatFileSize((plan.context_files?.reduce((acc, f) => acc + f.size, 0) || 0) + quickNotes.length)}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div >
    );
};
