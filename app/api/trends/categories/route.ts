import { NextRequest } from 'next/server';
import { createSupabaseClient } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseClient();

    // Get available trend types and their metadata
    const { data: trendTypes, error: typesError } = await supabase
      .from('player_trends')
      .select('trend_type, trend_category, trend_period');

    if (typesError) {
      return Response.json({ success: false, error: typesError.message }, { status: 500 });
    }

    // Get summary statistics for each category - simplified query
    const { data: categorySummary, error: summaryError } = await supabase
      .from('player_trends')
      .select('trend_category, trend_type, trend_period, trend_value');

    if (summaryError) {
      console.warn('Error fetching category summary:', summaryError);
    }

    // Define trend type descriptions and categories
    const trendDefinitions = {
      'top_10_streak': {
        name: 'Top 10 Streak',
        description: 'Consecutive tournaments with top 10 finishes',
        category_type: 'performance',
        hot_threshold: 2,
        icon: '🔥'
      },
      'top_5_count': {
        name: 'Top 5 Finishes',
        description: 'Number of top 5 finishes in recent tournaments',
        category_type: 'performance', 
        hot_threshold: 2,
        icon: '⭐'
      },
      'sub_70_avg_count': {
        name: 'Sub-70 Scoring',
        description: 'Tournaments with sub-70 scoring average',
        category_type: 'scoring',
        hot_threshold: 1,
        icon: '🎯'
      },
      'missed_cut_streak': {
        name: 'Missed Cut Streak',
        description: 'Consecutive missed cuts',
        category_type: 'performance',
        cold_threshold: 2,
        icon: '❄️'
      },
      'scoring_average': {
        name: 'Scoring Average',
        description: 'Average score per round in recent tournaments',
        category_type: 'scoring',
        good_threshold: 70,
        icon: '📊'
      }
    };

    const categories = {
      'hot': {
        name: 'Hot Players',
        description: 'Players showing strong recent form',
        color: '#ef4444',
        icon: '🔥'
      },
      'cold': {
        name: 'Cold Players', 
        description: 'Players struggling with recent form',
        color: '#3b82f6',
        icon: '❄️'
      },
      'consistent': {
        name: 'Consistent Players',
        description: 'Players with steady performance',
        color: '#10b981',
        icon: '📈'
      },
      'volatile': {
        name: 'Volatile Players',
        description: 'Players with unpredictable performance',
        color: '#f59e0b',
        icon: '⚡'
      }
    };

    const periods = {
      'last_3': {
        name: 'Last 3 Tournaments',
        description: 'Recent short-term trends'
      },
      'last_5': {
        name: 'Last 5 Tournaments', 
        description: 'Medium-term performance trends'
      },
      'last_10': {
        name: 'Last 10 Tournaments',
        description: 'Longer-term form analysis'
      },
      'season': {
        name: 'Season Trends',
        description: 'Full season performance patterns'
      }
    };

    // Process available trend types from database
    const availableTrends = new Set();
    const availableCategories = new Set();
    const availablePeriods = new Set();

    trendTypes?.forEach(trend => {
      if (trend.trend_type) availableTrends.add(trend.trend_type);
      if (trend.trend_category) availableCategories.add(trend.trend_category);
      if (trend.trend_period) availablePeriods.add(trend.trend_period);
    });

    // Process summary statistics manually since Supabase JS doesn't support aggregation
    const summaryStats = [];
    if (categorySummary) {
      const groupMap = new Map();
      categorySummary.forEach(item => {
        const key = `${item.trend_category}-${item.trend_type}-${item.trend_period}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            trend_category: item.trend_category,
            trend_type: item.trend_type,
            trend_period: item.trend_period,
            values: []
          });
        }
        if (item.trend_value != null) {
          groupMap.get(key).values.push(item.trend_value);
        }
      });

      groupMap.forEach(group => {
        const values = group.values;
        if (values.length > 0) {
          summaryStats.push({
            trend_category: group.trend_category,
            trend_type: group.trend_type,
            trend_period: group.trend_period,
            count: values.length,
            avg_value: values.reduce((a, b) => a + b, 0) / values.length,
            max_value: Math.max(...values)
          });
        }
      });
    }

    // Filter definitions to only include available data
    const activeTrendTypes = Object.fromEntries(
      Object.entries(trendDefinitions).filter(([key]) => availableTrends.has(key))
    );

    const activeCategories = Object.fromEntries(
      Object.entries(categories).filter(([key]) => availableCategories.has(key))
    );

    const activePeriods = Object.fromEntries(
      Object.entries(periods).filter(([key]) => availablePeriods.has(key))
    );

    return Response.json({
      success: true,
      data: {
        trend_types: activeTrendTypes,
        categories: activeCategories,
        periods: activePeriods,
        summary: summaryStats,
        available_data: {
          trend_types: Array.from(availableTrends),
          categories: Array.from(availableCategories),
          periods: Array.from(availablePeriods)
        }
      }
    });

  } catch (err: any) {
    return Response.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}