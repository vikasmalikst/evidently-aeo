import React from 'react';
import { IconCheck, IconDownload } from '@tabler/icons-react';

interface ExportSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileName: string;
    themeColor?: string;
}

export const ExportSuccessModal: React.FC<ExportSuccessModalProps> = ({
    isOpen,
    onClose,
    fileName,
    themeColor = '#00bcdc' // Default accent
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden relative p-8 text-center animate-in zoom-in-95 duration-200">
                <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                    style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                >
                    <IconDownload className="w-8 h-8" />
                </div>

                <h3 className="text-xl font-bold text-slate-800 mb-2">Export Complete!</h3>
                <p className="text-slate-500 mb-8">
                    Your report <strong>{fileName}</strong> has been successfully generated and downloaded.
                </p>

                <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl font-medium text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: themeColor }}
                >
                    Done
                </button>
            </div>
        </div>
    );
};
