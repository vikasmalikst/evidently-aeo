import { useState, useEffect, useRef } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface GA4DashboardProps {
  brandId: string;
  customerId?: string;
}

export const GA4Dashboard: React.FC<GA4DashboardProps> = ({ brandId, customerId = 'default-customer' }) => {
  const [days, setDays] = useState(7);
  const [eventData, setEventData] = useState<any>(null);
  const [topEvents, setTopEvents] = useState<any>(null);
  const [trafficSources, setTrafficSources] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (brandId) {
      fetchAnalytics();
    }
  }, [brandId, days]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch event count over time
      const eventRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/brands/${brandId}/analytics/reports?customer_id=${customerId}&metric=eventCount&dimension=date&days=${days}`
      );

      if (!eventRes.ok) {
        const result = await eventRes.json();
        throw new Error(result.error || 'Failed to fetch event data');
      }

      const eventJson = await eventRes.json();
      setEventData(eventJson.data);

      // Fetch top events
      const topRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/brands/${brandId}/analytics/top-events?customer_id=${customerId}&days=${days}`
      );

      if (topRes.ok) {
        const topJson = await topRes.json();
        setTopEvents(topJson.data);
      }

      // Fetch traffic sources
      const trafficRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/brands/${brandId}/analytics/traffic-sources?customer_id=${customerId}&days=${days}`
      );

      if (trafficRes.ok) {
        const trafficJson = await trafficRes.json();
        setTrafficSources(trafficJson.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Event Count Chart Data
  const eventChartData = eventData && eventData.data ? {
    labels: eventData.data.map((item: any) => item.date || item.dimension),
    datasets: [
      {
        label: 'Event Count',
        data: eventData.data.map((item: any) => item.eventCount || item.metric),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  } : null;

  // Top Events Chart Data
  const topEventsChartData = topEvents && topEvents.events ? {
    labels: topEvents.events.map((event: any) => event.name),
    datasets: [
      {
        label: 'Event Count',
        data: topEvents.events.map((event: any) => event.count),
        backgroundColor: '#10b981',
      },
    ],
  } : null;

  // Traffic Sources Chart Data
  const trafficChartData = trafficSources && trafficSources.trafficSources ? {
    labels: trafficSources.trafficSources.map((source: any) => source.source),
    datasets: [
      {
        label: 'Sessions',
        data: trafficSources.trafficSources.map((source: any) => source.sessions),
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
          '#ec4899',
          '#06b6d4',
          '#84cc16',
        ],
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[var(--text-caption)] text-sm">Loading analytics data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-red-600 text-sm mb-2">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary-dark)] text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-headings)]">
            📊 GA4 Analytics Dashboard
          </h2>
          <p className="text-sm text-[var(--text-caption)] mt-1">
            View your Google Analytics 4 data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--text-body)]">Date Range:</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Event Count Chart */}
      {eventChartData && (
        <div className="bg-white border border-[var(--border-default)] rounded-lg p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[var(--text-headings)]">
              Event Count Over Time
            </h3>
            <p className="text-sm text-[var(--text-caption)] mt-1">
              Total Events: <strong>{eventData?.total || 0}</strong>
              {eventData?.cached && (
                <span className="ml-2 text-xs">
                  📦 Cached at {new Date(eventData.cachedAt).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div style={{ height: '300px' }}>
            <Line data={eventChartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Top Events and Traffic Sources Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Events Chart */}
        {topEventsChartData && (
          <div className="bg-white border border-[var(--border-default)] rounded-lg p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-headings)]">
                Top Events
              </h3>
              <p className="text-sm text-[var(--text-caption)] mt-1">
                Most frequent events in the selected period
              </p>
            </div>
            <div style={{ height: '300px' }}>
              <Bar data={topEventsChartData} options={chartOptions} />
            </div>
          </div>
        )}

        {/* Traffic Sources Chart */}
        {trafficChartData && (
          <div className="bg-white border border-[var(--border-default)] rounded-lg p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-headings)]">
                Traffic Sources
              </h3>
              <p className="text-sm text-[var(--text-caption)] mt-1">
                Total Sessions: <strong>{trafficSources?.totalSessions || 0}</strong>
              </p>
            </div>
            <div style={{ height: '300px' }}>
              <Bar
                data={trafficChartData}
                options={{
                  ...chartOptions,
                  indexAxis: 'y' as const,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Traffic Sources Table */}
      {trafficSources && trafficSources.trafficSources && trafficSources.trafficSources.length > 0 && (
        <div className="bg-white border border-[var(--border-default)] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-4">
            Traffic Source Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-default)]">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-headings)]">
                    Source
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-[var(--text-headings)]">
                    Sessions
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-[var(--text-headings)]">
                    Percentage
                  </th>
                </tr>
              </thead>
              <tbody>
                {trafficSources.trafficSources.map((source: any, index: number) => (
                  <tr key={index} className="border-b border-[var(--border-default)] last:border-0">
                    <td className="py-3 px-4 text-sm text-[var(--text-body)]">
                      {source.source}
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--text-body)] text-right">
                      {source.sessions.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--text-body)] text-right">
                      {source.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cache Status */}
      {eventData && !eventData.cached && (
        <p className="text-xs text-[var(--text-caption)] text-center">
          🔄 Live data from Google Analytics 4
        </p>
      )}
    </div>
  );
};

