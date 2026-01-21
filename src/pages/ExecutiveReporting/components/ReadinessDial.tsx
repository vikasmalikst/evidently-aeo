import React from 'react';

interface ReadinessDialProps {
    score: number;
    size?: number;
    scoreDelta?: {
        percentage: number;
    };
}

export const ReadinessDial: React.FC<ReadinessDialProps> = ({ score, size = 200, scoreDelta }) => {
    // Radius and center calculations
    const strokeWidth = 15;
    const radius = size / 2 - strokeWidth;
    const center = size / 2;

    // We want 0% -> 180deg (Left), 100% -> 360deg (Right)
    const scorePercentage = Math.min(Math.max(score, 0), 100);
    // 0 to 180 scale
    const angleSpan = 180;
    // Start at 180 (Left)
    const startAngle = 180;
    const currentAngle = startAngle + (scorePercentage / 100) * angleSpan;

    const getStatusText = (value: number) => {
        if (value >= 80) return 'Optimal';
        if (value >= 50) return 'Average';
        return 'Critical';
    };

    const getDeltaClass = (percentage: number) => {
        if (percentage > 0) return 'text-emerald-600 bg-emerald-50';
        if (percentage < 0) return 'text-red-600 bg-red-50';
        return 'text-gray-500 bg-gray-50';
    };

    // Needle dynamic length
    const needleLength = radius - 15;

    return (
        <div className="flex flex-col items-center">
            {/* 
                Height calculation:
                size/2 is the radius (semicircle height).
                We add extra space at bottom for the text.
            */}
            <div className="relative" style={{ width: size, height: size / 2 }}>
                {/* Gauge Background/Scale */}
                <svg width={size} height={size / 2 + 10} className="overflow-visible absolute top-0 left-0 z-10">
                    <defs>
                        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="50%" stopColor="#eab308" />
                            <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                        <filter id="needleShadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.25" />
                        </filter>
                    </defs>

                    {/* Full Scale Arc */}
                    <path
                        d={`M${strokeWidth},${size / 2} A${radius},${radius} 0 0,1 ${size - strokeWidth},${size / 2}`}
                        fill="none"
                        stroke="url(#gaugeGradient)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />

                    {/* Needle */}
                    <g
                        transform={`translate(${center}, ${size / 2}) rotate(${currentAngle})`}
                        className="transition-transform duration-1000 ease-out"
                        style={{ transformOrigin: '0 0' }}
                    >
                        {/* Needle Body */}
                        <path
                            d={`M0,-5 L${needleLength},0 L0,5`}
                            fill="#1e293b"
                            filter="url(#needleShadow)"
                        />
                        {/* Needle Pivot */}
                        <circle cx="0" cy="0" r="8" fill="#1e293b" />
                    </g>
                </svg>

                {/* Score Text - Positioned at the bottom, independent of SVG so it can flow below */}
                <div
                    className="absolute flex flex-col items-center justify-center w-full z-0"
                    style={{ top: size / 2 - 10 }}
                >
                    <div className="text-4xl font-bold text-gray-900 leading-none mt-4">
                        {score.toFixed(0)}
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mt-1">
                        {getStatusText(score)}
                    </div>

                    {/* Delta Badge moved here to group with text */}
                    {scoreDelta && (
                        <div className={`mt-2 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${getDeltaClass(scoreDelta.percentage)}`}>
                            {scoreDelta.percentage > 0 ? '↑' : scoreDelta.percentage < 0 ? '↓' : ''}
                            {Math.abs(scoreDelta.percentage).toFixed(1)}% vs prev
                        </div>
                    )}
                </div>
            </div>

            {/* Spacer to accommodate the absolute positioned text extending below */}
            <div style={{ height: 90 }}></div>
        </div>
    );
};
