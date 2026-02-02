import React from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderSlideProps {
    title: string;
}

export const PlaceholderSlide: React.FC<PlaceholderSlideProps> = ({ title }) => {
    return (
        <div className="h-full flex flex-col">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <div className="bg-gray-100 p-4 rounded-full mb-3">
                    <Construction className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">Coming Soon</p>
                <p className="text-sm text-gray-400 mt-1">This insight page is under construction.</p>
            </div>
        </div>
    );
};
