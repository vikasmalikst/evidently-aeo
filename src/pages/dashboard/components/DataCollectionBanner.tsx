import { Activity } from 'lucide-react';

interface DataCollectionBannerProps {
  selectedBrandId: string | null;
  onDismiss: () => void;
}

export const DataCollectionBanner = ({ selectedBrandId, onDismiss }: DataCollectionBannerProps) => {
  return (
    <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
          <Activity className="w-5 h-5 text-white animate-pulse" />
        </div>
      </div>
      <div className="flex-1">
        <h3 className="text-[14px] font-semibold text-[#1a1d29] mb-1">
          Your remaining data is being collected and scored
        </h3>
        <p className="text-[13px] text-[#64748b]">
          We're still processing some of your queries in the background. Your dashboard will update automatically as new data becomes available. You'll be notified when everything is complete.
        </p>
      </div>
      <button
        onClick={() => {
          if (selectedBrandId) {
            localStorage.removeItem(`data_collection_in_progress_${selectedBrandId}`);
          }
          onDismiss();
        }}
        className="flex-shrink-0 text-[#64748b] hover:text-[#1a1d29] transition-colors"
        aria-label="Dismiss notification"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

