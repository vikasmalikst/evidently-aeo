import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface LoadingAnimationProps {
    progress?: {
        completed: number;
        total: number;
    };
}

const AEO_TIPS = [
    'AI engines prefer bulleted lists over long paragraphs',
    'Schema markup helps AI understand your content structure',
    'Fresh content signals authority to answer engines',
    'Entity linking strengthens your brand\'s knowledge graph',
    'FAQ schema is highly favored by conversational AI',
    'Structured data increases your citation chances by 3x'
];

export const LoadingAnimation = ({ progress }: LoadingAnimationProps) => {
    const [tipIndex, setTipIndex] = useState(0);
    const percentComplete = progress ? Math.round((progress.completed / progress.total) * 100) : 0;
    const estimatedSeconds = progress ? Math.max(5, Math.round((progress.total - progress.completed) * 3)) : 45;

    useEffect(() => {
        const interval = setInterval(() => {
            setTipIndex((prev) => (prev + 1) % AEO_TIPS.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center py-12">
            {/* Radar Scan Animation */}
            <div className="relative w-40 h-40 mb-8">
                {/* Background circles */}
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="absolute inset-0 border-2 border-blue-200 rounded-full"
                        style={{
                            width: `${100 - i * 20}%`,
                            height: `${100 - i * 20}%`,
                            top: `${i * 10}%`,
                            left: `${i * 10}%`
                        }}
                        animate={{
                            scale: [1, 1.1, 1],
                            opacity: [0.3, 0.6, 0.3]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.3
                        }}
                    />
                ))}

                {/* Scanning beam */}
                <motion.div
                    className="absolute top-1/2 left-1/2 w-20 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent origin-left"
                    style={{ transformOrigin: '0% 50%' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />

                {/* Center dot */}
                <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
            </div>

            {/* Progress Text */}
            <motion.h3
                className="text-lg font-semibold text-gray-800 mb-2"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity }}
            >
                Analyzing Domain...
            </motion.h3>

            {progress && (
                <p className="text-sm text-gray-600 mb-6">
                    {progress.completed}/{progress.total} tests completed • ~{estimatedSeconds}s remaining
                </p>
            )}

            {/* Progress Bar */}
            <div className="w-full max-w-md bg-gray-200 rounded-full h-2 mb-8 overflow-hidden">
                <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentComplete}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
            </div>

            {/* Rotating Tips */}
            <div className="max-w-md text-center">
                <p className="text-xs font-medium text-blue-600 mb-2">💡 DID YOU KNOW?</p>
                <motion.p
                    key={tipIndex}
                    className="text-sm text-gray-700 min-h-[2.5rem]"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5 }}
                >
                    {AEO_TIPS[tipIndex]}
                </motion.p>
            </div>
        </div>
    );
};
