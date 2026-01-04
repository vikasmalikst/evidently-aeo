export const DashboardSkeleton = () => {
  return (
    <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
      {/* Header Skeleton */}
      <div className="flex items-start gap-6 mb-6">
        <div className="w-12 h-12 rounded-lg bg-gray-200 animate-pulse" />
        <div className="flex-1">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="flex items-center justify-between gap-4">
            <div className="h-5 w-80 bg-gray-200 rounded animate-pulse" />
            <div className="h-9 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-4 gap-5 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gray-200 animate-pulse" />
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="flex items-end gap-2 mb-4">
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-12 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-3 w-40 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="space-y-2 mb-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
                  <div className="h-2 w-24 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mt-4 pt-3 border-t border-[#e8e9ed]" />
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        {/* Source Type Distribution Skeleton */}
        <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="w-4 h-4 bg-gray-200 rounded-full animate-pulse" />
          </div>
          <div className="h-64 bg-gray-100 rounded animate-pulse flex items-end justify-center gap-2 p-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-gray-200 rounded-t animate-pulse"
                style={{
                  width: `${Math.random() * 40 + 30}%`,
                  height: `${Math.random() * 60 + 40}%`,
                }}
              />
            ))}
          </div>
        </div>

        {/* LLM Visibility Table Skeleton */}
        <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="w-4 h-4 bg-gray-200 rounded-full animate-pulse" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Sources and Topics Skeleton */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        {/* Top Brand Sources Skeleton */}
        <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Topics Skeleton */}
        <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="h-6 w-44 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-2 w-3/4 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommended Actions Skeleton */}
      <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5 mb-6">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-5" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-4 p-4 border border-gray-100 rounded-lg">
              <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse flex-shrink-0" />
              <div className="flex-1">
                <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-1" />
                <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

