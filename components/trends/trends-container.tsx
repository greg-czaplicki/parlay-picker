'use client';

import { useState } from 'react';
import { useTrendsQuery } from '@/hooks/use-trends-query';
import { useTrendsCategoriesQuery } from '@/hooks/use-trends-categories-query';
import { TrendsFilters } from './trends-filters';
import { TrendsList } from './trends-list';
import { TrendsStats } from './trends-stats';

export const TrendsContainer = () => {
  const [filters, setFilters] = useState({
    category: 'all',
    period: 'last_10',
    type: undefined as string | undefined,
    limit: 50
  });

  const { data: categoriesData, isLoading: categoriesLoading } = useTrendsCategoriesQuery();
  const { data: trendsData, isLoading: trendsLoading, refetch } = useTrendsQuery(filters);

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleRecalculate = async () => {
    try {
      const response = await fetch('/api/trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          recalculate: true, 
          period: filters.period 
        })
      });
      
      if (response.ok) {
        refetch();
      }
    } catch (error) {
      console.error('Failed to recalculate trends:', error);
    }
  };

  if (categoriesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TrendsFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        categories={categoriesData?.data}
        onRecalculate={handleRecalculate}
        isRecalculating={false}
      />

      {categoriesData?.data && (
        <TrendsStats 
          summary={categoriesData.data.summary} 
          period={filters.period}
        />
      )}

      <TrendsList
        data={trendsData?.data || []}
        isLoading={trendsLoading}
        categories={categoriesData?.data?.categories}
        trendTypes={categoriesData?.data?.trend_types}
      />
    </div>
  );
};