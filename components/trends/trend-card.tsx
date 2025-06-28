'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface TrendCardProps {
  playerTrend: {
    dg_id: number;
    player_name: string;
    trends: Array<{
      type: string;
      value: number;
      category: string;
      context?: any;
      calculated_at: string;
    }>;
  };
  categories?: any;
  trendTypes?: any;
}

export const TrendCard = ({
  playerTrend,
  categories,
  trendTypes
}: TrendCardProps) => {
  const getCategoryColor = (category: string) => {
    const colors = {
      hot: 'bg-red-500/20 text-red-400 border border-red-500/30',
      cold: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      consistent: 'bg-green-500/20 text-green-400 border border-green-500/30',
      volatile: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
    };
    return colors[category as keyof typeof colors] || 'bg-muted/20 text-muted-foreground border border-muted/30';
  };

  const formatTrendValue = (type: string, value: number) => {
    switch (type) {
      case 'scoring_average':
        return `${value.toFixed(1)} avg`;
      case 'top_10_streak':
      case 'missed_cut_streak':
        return `${value} in a row`;
      case 'top_5_count':
      case 'sub_70_avg_count':
        return `${value} times`;
      default:
        return value.toString();
    }
  };

  const getTrendIcon = (type: string) => {
    return trendTypes?.[type]?.icon || '📊';
  };

  const getTrendName = (type: string) => {
    return trendTypes?.[type]?.name || type.replace(/_/g, ' ');
  };

  const primaryTrend = playerTrend.trends[0];
  const primaryCategory = categories?.[primaryTrend?.category];

  return (
    <div className="glass-card p-6 hover:glass-hover transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-foreground truncate">
          {playerTrend.player_name}
        </h3>
        {primaryCategory && (
          <div className={`px-3 py-1.5 text-xs font-semibold rounded-full backdrop-blur-md ${getCategoryColor(primaryTrend.category)}`}>
            <span className="mr-1">{primaryCategory.icon}</span>
            {primaryCategory.name}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {playerTrend.trends.slice(0, 4).map((trend, index) => (
          <div key={`${trend.type}-${index}`} className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-lg">{getTrendIcon(trend.type)}</span>
              <span className="text-sm text-muted-foreground truncate">
                {getTrendName(trend.type)}
              </span>
            </div>
            <div className="text-right">
              <div className="font-medium text-sm text-foreground">
                {formatTrendValue(trend.type, trend.value)}
              </div>
              {trend.context?.recent_tournaments && (
                <div className="text-xs text-muted-foreground">
                  ({trend.context.recent_tournaments} events)
                </div>
              )}
            </div>
          </div>
        ))}

        {playerTrend.trends.length > 4 && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/30">
            +{playerTrend.trends.length - 4} more trends
          </div>
        )}

        {playerTrend.trends.length > 0 && (
          <div className="text-xs text-muted-foreground pt-2 border-t border-border/30">
            Updated: {new Date(primaryTrend.calculated_at).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
};