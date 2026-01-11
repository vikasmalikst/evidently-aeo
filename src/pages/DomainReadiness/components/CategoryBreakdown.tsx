import React from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { AeoAuditResult } from '../types/types';

interface CategoryBreakdownProps {
  audit: AeoAuditResult;
  loading?: boolean;
  progress?: any;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryBreakdown = ({
  audit,
  selectedCategory,
  onSelectCategory
}: CategoryBreakdownProps) => {

  // Metrics definition with descriptions for tooltip
  const metrics = [
    {
      key: 'technicalCrawlability',
      label: 'Technical',
      desc: 'Ensures search engines can crawl and index your site efficiently.',
      color: 'bg-blue-500'
    },
    {
      key: 'contentQuality',
      label: 'Content',
      desc: 'Evaluates the depth, relevance, and value of your content.',
      color: 'bg-purple-500'
    },
    {
      key: 'semanticStructure',
      label: 'Semantic',
      desc: 'Checks for proper HTML structure and schema usage.',
      color: 'bg-green-500'
    },
    {
      key: 'accessibilityAndBrand',
      label: 'Access & Brand',
      desc: 'Measures accessibility compliance and brand signal consistency.',
      color: 'bg-orange-500'
    },
    {
      key: 'aeoOptimization',
      label: 'AEO',
      desc: 'Optimization for AI-driven answer engines.',
      color: 'bg-indigo-500'
    }
  ];

  // Calculate LLM Bot Access Score
  const allowedBots = audit.botAccessStatus.filter(b => b.status === 'allowed').length;
  const totalBots = audit.botAccessStatus.length;
  const botScore = totalBots > 0 ? (allowedBots / totalBots) * 100 : 0;

  return (
    <div className="space-y-3 w-full">
      {metrics.map((metric) => {
        const score = audit.scoreBreakdown[metric.key as keyof typeof audit.scoreBreakdown] || 0;
        const isSelected = selectedCategory === metric.key;

        return (
          <div
            key={metric.key}
            onClick={() => onSelectCategory(metric.key)}
            className={`
              group cursor-pointer p-2 rounded-lg transition-all duration-200
              ${isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}
            `}
            title={metric.desc} // Native tooltip
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                  {metric.label}
                </span>
                <Info size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-sm font-bold text-gray-900">{Math.round(score)}</span>
            </div>
            {/* Progress Bar */}
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                className={`h-full ${metric.color}`}
              />
            </div>
          </div>
        );
      })}

      {/* LLM Bot Access Bar */}
      <div
        onClick={() => onSelectCategory('botAccess')}
        className={`
          group cursor-pointer p-2 rounded-lg transition-all duration-200
          ${selectedCategory === 'botAccess' ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}
        `}
        title="Percentage of AI bots allowed to crawl your site"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${selectedCategory === 'botAccess' ? 'text-blue-700' : 'text-gray-700'}`}>
              LLM Bot Access
            </span>
            <Info size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="text-sm font-bold text-gray-900">{Math.round(botScore)}%</span>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${botScore}%` }}
            className="h-full bg-cyan-500"
          />
        </div>
      </div>
    </div>
  );
};
