/**
 * Loading State Component
 * 
 * Displays a loading spinner with optional message
 */

interface LoadingStateProps {
  message?: string;
}

export const LoadingState = ({ message = 'Loading...' }: LoadingStateProps) => {
  return (
    <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-10 flex flex-col items-center justify-center">
      <div className="h-12 w-12 rounded-full border-2 border-t-transparent border-[#00bcdc] animate-spin mb-4" />
      <p className="text-[14px] text-[#64748b]">{message}</p>
    </div>
  );
};

