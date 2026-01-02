/**
 * Error State Component
 * 
 * Displays an error message with alert icon
 */

import { IconAlertCircle } from '@tabler/icons-react';

interface ErrorStateProps {
  message: string;
}

export const ErrorState = ({ message }: ErrorStateProps) => {
  return (
    <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4 flex items-center gap-3">
      <IconAlertCircle size={20} className="text-[#ef4444] flex-shrink-0" />
      <p className="text-[13px] text-[#991b1b]">{message}</p>
    </div>
  );
};

