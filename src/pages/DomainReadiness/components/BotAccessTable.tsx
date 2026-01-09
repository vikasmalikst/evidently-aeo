import { BotAccessStatus } from '../types/types';
import { Check, X } from 'lucide-react';

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
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mt-6">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">LLM Bot Access</h3>
        <p className="text-sm text-gray-500">Status of major AI crawlers accessing your site</p>
        {loading && progress?.active && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>Checking…</span>
              <span>
                {progress.completed}/{progress.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress.total ? Math.round((progress.completed / progress.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bot Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">HTTP Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && bots.length === 0 && (
              <tr>
                <td className="px-6 py-6 text-sm text-gray-500" colSpan={4}>
                  Waiting for bot access results…
                </td>
              </tr>
            )}
            {bots.map((bot, idx) => (
              <tr key={idx}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{bot.botName}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    bot.allowed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {bot.allowed ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                    {bot.allowed ? 'Allowed' : 'Blocked'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {bot.httpStatus || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {bot.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
