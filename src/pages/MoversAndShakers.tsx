
import { useState, useEffect } from 'react';
import { MoverItem, moversShakersApi } from '../api/moversShakersApi';
import { ExternalLink, AlertTriangle, CheckCircle, Clock, Info, TrendingUp } from 'lucide-react';
import { useManualBrandDashboard } from '../manual-dashboard';
import { Layout } from '../components/Layout/Layout';

export default function MoversAndShakers() {
  const { selectedBrandId } = useManualBrandDashboard();
  const [items, setItems] = useState<MoverItem[]>([]);
  const [loading, setLoading] = useState(false); // Start false until we have a brandId
  const [error, setError] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string>('');

  useEffect(() => {
    async function fetchReport() {
      if (!selectedBrandId) return;
      
      try {
        setLoading(true);
        const result = await moversShakersApi.getReport(selectedBrandId);
        setItems(result.items);
        setBrandName(result.brand);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch report', err);
        setError('Failed to load Movers & Shakers report. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [selectedBrandId]);

  const getSentimentColor = (score: number) => {
    if (score >= 0.5) return 'text-green-600 bg-green-50';
    if (score <= -0.5) return 'text-red-600 bg-red-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Movers & Shakers</h1>
          </div>
          <p className="text-gray-600">
            Real-time analysis of {brandName ? brandName : 'brand'} mentions, reviews, and sentiment from top sources (last 48 hours).
          </p>
        </div>

        {!selectedBrandId ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded relative">
            Please select a brand to view analysis.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
            <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No recent activity found</h3>
            <p className="mt-2 text-gray-500">We couldn't find any significant mentions in the last 48 hours.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sentiment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action Required</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Link</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{item.domain}</span>
                          <span className="text-xs text-gray-500 line-clamp-1" title={item.title}>{item.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                          {item.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(item.sentiment_score)}`}>
                          {item.sentiment_score > 0 ? '+' : ''}{item.sentiment_score.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-sm text-gray-700">
                          {item.action_required.toLowerCase().includes('monitor') ? (
                            <Clock className="w-4 h-4 mr-1.5 text-blue-500" />
                          ) : item.action_required.toLowerCase().includes('respond') ? (
                            <AlertTriangle className="w-4 h-4 mr-1.5 text-orange-500" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-1.5 text-green-500" />
                          )}
                          {item.action_required}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.owner || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                        >
                          View <ExternalLink className="w-4 h-4 ml-1" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
