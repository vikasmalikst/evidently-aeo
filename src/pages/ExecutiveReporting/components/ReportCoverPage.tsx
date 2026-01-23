import React from 'react';
import evidentlyLogo from '../../../assets/logo.png';
import { SafeLogo } from '../../../components/Onboarding/common/SafeLogo';

interface ReportCoverPageProps {
    brandName: string;
    brandLogo?: string;
    brandDomain?: string;
    reportPeriod: string;
}

export const ReportCoverPage: React.FC<ReportCoverPageProps> = ({
    brandName,
    brandLogo,
    brandDomain,
    reportPeriod,
}) => {
    return (
        <div className="report-cover-page flex flex-col items-center justify-between min-h-[1123px] w-full p-16 bg-white text-center" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
            {/* Top Logo */}
            <div className="w-full flex justify-center pt-20">
                <div className="flex flex-col items-center gap-4">
                    <img src={evidentlyLogo} alt="EvidentlyAEO" className="h-24 w-auto object-contain" />
                    <h1 className="text-3xl font-bold text-[var(--text-headings)] tracking-tight">
                        EvidentlyAEO
                    </h1>
                </div>
            </div>

            {/* Center Content */}
            <div className="flex flex-col items-center gap-8">
                <h1 className="text-5xl font-bold text-gray-900 leading-tight max-w-4xl">
                    Answer Engine Optimization Report
                </h1>
                
                <div className="h-1 w-32 bg-gradient-to-r from-[var(--accent-primary)] to-[#0096b0] rounded-full my-8"></div>
                
                <div className="flex flex-col items-center gap-4">
                    <p className="text-xl text-gray-500 font-medium uppercase tracking-widest">Prepared For</p>
                    <div className="flex items-center gap-6 mt-4 p-8 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm min-w-[400px] justify-center">
                        <SafeLogo
                            src={brandLogo}
                            domain={brandDomain}
                            alt={brandName}
                            size={80}
                            className="rounded-xl bg-white p-2 shadow-sm"
                        />
                        <span className="text-3xl font-bold text-gray-900">{brandName}</span>
                    </div>
                </div>

                <div className="mt-8">
                    <p className="text-xl text-gray-500 font-medium">{reportPeriod}</p>
                </div>
            </div>

            {/* Footer */}
            <div className="w-full flex flex-col items-center gap-4 pb-12">
                <p className="text-sm text-gray-400 font-medium uppercase tracking-widest">Prepared By</p>
                <div className="flex items-center gap-3 opacity-80 grayscale hover:grayscale-0 transition-all">
                    <img src={evidentlyLogo} alt="EvidentlyAEO" className="h-8 w-auto object-contain" />
                    <span className="text-lg font-bold text-gray-700">EvidentlyAEO</span>
                </div>
                <div className="text-xs text-gray-300 mt-4">
                    © {new Date().getFullYear()} EvidentlyAEO. All rights reserved.
                </div>
            </div>
        </div>
    );
};
