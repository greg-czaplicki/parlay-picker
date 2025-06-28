export const TrendsSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Filter skeleton */}
      <div className="glass-card p-6">
        <div className="flex flex-wrap gap-4 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-32 bg-muted/30 rounded animate-pulse" />
          ))}
        </div>
      </div>

      {/* Trends skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-muted/30 rounded animate-pulse" />
              <div className="h-6 w-32 bg-muted/30 rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-4 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};