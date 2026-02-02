import React from 'react';
import { X, BookOpen } from 'lucide-react';

interface RankingSidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    children?: React.ReactNode;
}

export const RankingSidePanel: React.FC<RankingSidePanelProps> = ({ isOpen, onClose, title, description, children }) => {
    return (
        <>
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-gray-900/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Slide-over Panel */}
            <div
                className={`absolute top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out border-l border-gray-100 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center">
                            <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
                            {title}
                        </h3>
                        {description && (
                            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                                {description}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 ml-4"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {children}
                </div>
            </div>
        </>
    );
};
