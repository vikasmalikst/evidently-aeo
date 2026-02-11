
import React from 'react';
import { motion } from 'framer-motion';
import { IconPlus } from '@tabler/icons-react';
import { CollapsibleFilters } from '../../../components/RecommendationsV3/CollapsibleFilters';
import { StatusFilter } from '../../../components/RecommendationsV3/components/StatusFilter';
import { PriorityFilter } from '../../../components/RecommendationsV3/components/PriorityFilter';
import { EffortFilter } from '../../../components/RecommendationsV3/components/EffortFilter';
import { ContentTypeFilter } from '../../../components/RecommendationsV3/components/ContentTypeFilter';
import { useRecommendationContext } from '../RecommendationContext';

interface FiltersProps {
  onAddCustom?: () => void;
}

export const Filters: React.FC<FiltersProps> = ({ onAddCustom }) => {
  const { filters, setFilters } = useRecommendationContext();
  const { status, priority, effort, contentType, availableContentTypes } = filters;
  const { setStatus, setPriority, setEffort, setContentType } = setFilters;

  const activeFilterCount =
    (status !== 'all' ? 1 : 0) +
    (priority !== 'all' ? 1 : 0) +
    (effort !== 'all' ? 1 : 0) +
    (contentType !== 'all' ? 1 : 0);

  const handleClearAll = () => {
    setStatus('all');
    setPriority('all');
    setEffort('all');
    setContentType('all');
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[20px] font-bold text-[#0f172a] mb-1">Discover Opportunities</h2>
          <p className="text-[14px] text-[#64748b]">Review findings and prioritize recommendations</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <CollapsibleFilters
            activeFilterCount={activeFilterCount}
            onClearAll={handleClearAll}
          >
            <StatusFilter value={status} onChange={setStatus} />
            <PriorityFilter value={priority} onChange={setPriority} />
            <EffortFilter value={effort} onChange={setEffort} />
            <ContentTypeFilter value={contentType} onChange={setContentType} options={availableContentTypes} />
          </CollapsibleFilters>
          
          {onAddCustom && (
              <button
                onClick={onAddCustom}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#00bcdc] text-[#00bcdc] rounded-lg text-[13px] font-bold hover:bg-[#00bcdc]/5 transition-all shadow-sm active:scale-95 whitespace-nowrap"
              >
                <IconPlus size={18} />
                Add Custom
              </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
