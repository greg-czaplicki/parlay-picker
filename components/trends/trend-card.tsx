'use client';

import { Badge } from '@/components/ui/badge';

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
      hot: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30', // Green for good/hot
      cold: 'bg-red-500/20 text-red-400 border border-red-500/30', // Red for bad/cold
      consistent: 'bg-blue-500/20 text-blue-400 border border-blue-500/30', // Blue for steady
      volatile: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' // Amber for unpredictable
    };
    return colors[category as keyof typeof colors] || 'bg-muted/20 text-muted-foreground border border-muted/30';
  };

  const formatTrendValue = (type: string, value: number, context?: any) => {
    switch (type) {
      case 'scoring_average':
        return `${value.toFixed(1)} avg`;
      case 'scoring_improvement':
        const recentAvg = context?.recent_average || 0;
        const earlyAvg = context?.early_average || 0;
        const improvement = earlyAvg - recentAvg;
        return `${improvement.toFixed(1)} strokes better`;
      case 'scoring_consistency':
        if (value < 1) return 'Very consistent';
        if (value < 2) return 'Consistent';
        if (value < 3) return 'Somewhat variable';
        return 'Inconsistent';
      case 'consecutive_sub_70_rounds':
        return `${value} consecutive`;
      case 'consecutive_top_15':
        return `${value} straight`;
      case 'consecutive_top_25':
        return `${value} straight`;
      case 'cut_making_streak':
        return `${value} cuts made`;
      case 'recent_sub_70_frequency':
        return `${value} of ${context?.tournaments_analyzed || 5}`;
      case 'top_10_streak':
      case 'missed_cut_streak':
        return `${value} in a row`;
      case 'top_5_count':
      case 'sub_70_avg_count':
      case 'sub_70_tournaments':
        return `${value} times`;
      case 'cut_making_consistency':
        return `${value}% rate`;
      default:
        return value.toString();
    }
  };

  const getTrendIcon = (type: string, category: string) => {
    // Enhanced icons based on trend type and category
    const icons = {
      'scoring_average': category === 'hot' ? '🔥' : category === 'cold' ? '❄️' : '📊',
      'scoring_improvement': '📈',
      'consecutive_sub_70_rounds': '🎯',
      'consecutive_top_15': '🏆',
      'consecutive_top_25': '🥈',
      'cut_making_streak': '✅',
      'cut_making_consistency': '💪',
      'recent_sub_70_frequency': '🔥',
      'missed_cut_streak': '❌',
      'top_10_streak': '⭐',
      'top_5_count': '🏅',
      'sub_70_tournaments': '🎯',
      'sub_70_avg_count': '🎯'
    };
    return icons[type as keyof typeof icons] || trendTypes?.[type]?.icon || '📊';
  };

  const getTrendName = (type: string) => {
    const names = {
      'scoring_average': 'Scoring Average',
      'scoring_improvement': 'Recent Improvement',
      'scoring_consistency': 'Score Consistency',
      'consecutive_sub_70_rounds': 'Sub-70 Round Streak',
      'consecutive_top_15': 'Top 15 Streak',
      'consecutive_top_25': 'Top 25 Streak',
      'cut_making_streak': 'Cut Streak',
      'cut_making_consistency': 'Cut Making Rate',
      'recent_sub_70_frequency': 'Recent Sub-70 Form',
      'missed_cut_streak': 'Missed Cut Streak',
      'top_10_streak': 'Top 10 Streak',
      'sub_70_tournaments': 'Sub-70 Scoring'
    };
    return names[type as keyof typeof names] || trendTypes?.[type]?.name || type.replace(/_/g, ' ');
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
        {playerTrend.trends.map((trend, index) => (
          <div key={`${trend.type}-${index}`} className={`flex items-center justify-between p-2 rounded-lg transition-all duration-200 ${getCategoryColor(trend.category).replace('border border-', 'border-l-4 border-l-')} bg-opacity-30`}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-lg" title={`${trend.category.charAt(0).toUpperCase() + trend.category.slice(1)} trend`}>
                {getTrendIcon(trend.type, trend.category)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {getTrendName(trend.type)}
                </div>
                {trend.context?.tournaments_analyzed && (
                  <div className="text-xs text-muted-foreground">
                    {trend.type === 'scoring_improvement' 
                      ? `Recent ${Math.floor(trend.context.tournaments_analyzed / 2)} vs earlier ${Math.ceil(trend.context.tournaments_analyzed / 2)}`
                      : `${trend.context.tournaments_analyzed} events`
                    }
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className={`font-semibold text-sm ${
                trend.category === 'hot' ? 'text-emerald-400' : 
                trend.category === 'cold' ? 'text-red-400' : 
                trend.category === 'consistent' ? 'text-blue-400' : 
                'text-amber-400'
              }`}>
                {formatTrendValue(trend.type, trend.value, trend.context)}
              </div>
            </div>
          </div>
        ))}


        {playerTrend.trends.length > 0 && (
          <div className="text-xs text-muted-foreground pt-2 border-t border-border/30 text-center">
            Updated: {new Date(primaryTrend.calculated_at).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
};