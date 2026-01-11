import { BotAccessStatus } from '../types/types';
import { Check, X, ChevronDown, Bot } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BotAccessTableProps {
  bots: BotAccessStatus[];
  loading?: boolean;
  progress?: {
    active: boolean;
    completed: number;
    total: number;
  };
}

export const BotAccessTable = ({ bots, loading, progress }: BotAccessTableProps) => {
  const [expanded, setExpanded] = useState(false);

  const allowedCount = bots.filter(b => b.allowed).length;
  const blockedCount = bots.length - allowedCount;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition"
      >
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-gray-600" />
          <span className="font-semibold text-gray-900">LLM Bot Access</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
              {allowedCount} allowed
            </span>
            {blockedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">
                {blockedCount} blocked
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {loading && progress?.active && (
        <div className="px-4 py-2 bg-white border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Checking…</span>
            <span>
              {progress.completed}/{progress.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress.total ? Math.round((progress.completed / progress.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-gray-100">
              {loading && bots.length === 0 && (
                <div className="px-4 py-6 text-sm text-gray-500 text-center">
                  Waiting for bot access results…
                </div>
              )}
              {bots.map((bot, idx) => (
                <div key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${bot.allowed ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm font-medium text-gray-900">{bot.botName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{bot.httpStatus || '-'}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bot.allowed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                      {bot.allowed ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                      {bot.allowed ? 'Allowed' : 'Blocked'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
