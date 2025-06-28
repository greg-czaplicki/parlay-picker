'use client';

interface TrendsStatsProps {
  summary: any[];
  period: string;
}

export const TrendsStats = ({ summary, period }: TrendsStatsProps) => {
  if (!summary || summary.length === 0) {
    return null;
  }

  // Group summary by category
  const categoryStats = summary.reduce((acc, item) => {
    if (!acc[item.trend_category]) {
      acc[item.trend_category] = {
        category: item.trend_category,
        total_players: 0,
        trend_types: new Set()
      };
    }
    acc[item.trend_category].total_players += item.count || 0;
    acc[item.trend_category].trend_types.add(item.trend_type);
    return acc;
  }, {});

  const stats = Object.values(categoryStats) as any[];

  const getCategoryIcon = (category: string) => {
    const icons = {
      hot: '🔥',
      cold: '❄️',
      consistent: '📈',
      volatile: '⚡'
    };
    return icons[category as keyof typeof icons] || '📊';
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      hot: 'text-red-400',
      cold: 'text-blue-400',
      consistent: 'text-green-400',
      volatile: 'text-yellow-400'
    };
    return colors[category as keyof typeof colors] || 'text-muted-foreground';
  };

  return (
    <div className="glass-card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Trend Summary
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.category} className="text-center">
            <div className="text-2xl mb-1">
              {getCategoryIcon(stat.category)}
            </div>
            <div className={`text-2xl font-bold ${getCategoryColor(stat.category)}`}>
              {stat.total_players}
            </div>
            <div className="text-sm text-muted-foreground capitalize">
              {stat.category} Players
            </div>
            <div className="text-xs text-muted-foreground">
              {stat.trend_types.size} trend types
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-border/30 text-sm text-muted-foreground">
        Statistics based on {period.replace('_', ' ')} analysis period
      </div>
    </div>
  );
};