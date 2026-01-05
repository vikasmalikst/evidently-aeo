import { motion } from 'framer-motion';
import { ChevronUp } from 'lucide-react';

interface GlobalProgressWidgetProps {
  progressData: {
    stages?: {
      collection: { total: number; completed: number; status: 'pending' | 'active' | 'completed' };
      scoring: { total: number; completed: number; status: 'pending' | 'active' | 'completed' };
      finalization: { status: 'pending' | 'active' | 'completed' };
    };
  } | null;
  onExpand: () => void;
}

export const GlobalProgressWidget = ({ progressData, onExpand }: GlobalProgressWidgetProps) => {
  const stages = progressData?.stages;
  
  if (!stages) return null;

  let percentage = 0;
  let label = 'Initializing...';
  
  if (stages.collection.status === 'active') {
    percentage = (stages.collection.completed / (stages.collection.total || 1)) * 33;
    label = 'Collecting Data...';
  } else if (stages.scoring.status === 'active') {
    percentage = 33 + ((stages.scoring.completed / (stages.scoring.total || 1)) * 33);
    label = 'Analyzing Results...';
  } else if (stages.finalization.status === 'active') {
    percentage = 66 + 33; // Finalization is the last stretch
    label = 'Finalizing...';
  } else if (stages.finalization.status === 'completed') {
    percentage = 100;
    label = 'Ready!';
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-6 right-6 z-50"
    >
      <div 
        onClick={onExpand}
        className="bg-white rounded-xl shadow-xl border border-[var(--primary200)] p-4 cursor-pointer hover:shadow-2xl transition-all flex items-center gap-4 min-w-[300px]"
      >
        <div className="relative w-12 h-12 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="#e2e8f0"
              strokeWidth="4"
              fill="transparent"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="#00bcdc"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray={125.6}
              strokeDashoffset={125.6 - (125.6 * percentage) / 100}
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#00bcdc]">
            {Math.round(percentage)}%
          </div>
        </div>

        <div className="flex-1">
          <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
          <p className="text-xs text-gray-500">Click to view details</p>
        </div>

        <div className="bg-gray-50 p-2 rounded-lg text-gray-400">
          <ChevronUp size={16} />
        </div>
      </div>
    </motion.div>
  );
};
