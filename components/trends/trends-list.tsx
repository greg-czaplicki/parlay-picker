'use client';

import { TrendCard } from './trend-card';

interface TrendsListProps {
  data: any[];
  isLoading: boolean;
  categories?: any;
  trendTypes?: any;
}

export const TrendsList = ({
  data,
  isLoading,
  categories,
  trendTypes
}: TrendsListProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-muted/30 rounded" />
              <div className="h-6 w-32 bg-muted/30 rounded" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-4 bg-muted/30 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="text-muted-foreground mb-2 text-4xl">📊</div>
        <h3 className="text-lg font-medium text-foreground mb-2">No trends found</h3>
        <p className="text-muted-foreground mb-4">
          No player trends match your current filters. Try adjusting the category, period, or trend type.
        </p>
        <p className="text-sm text-muted-foreground">
          You may need to populate tournament results data first using the API.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {data.map((playerTrend) => (
        <TrendCard
          key={playerTrend.dg_id}
          playerTrend={playerTrend}
          categories={categories}
          trendTypes={trendTypes}
        />
      ))}
    </div>
  );
};