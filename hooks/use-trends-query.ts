import { useQuery } from '@tanstack/react-query';

interface TrendsFilters {
  category: string;
  period: string;
  type?: string;
  limit: number;
}

export const useTrendsQuery = (filters: TrendsFilters) => {
  return useQuery({
    queryKey: ['trends', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('category', filters.category);
      params.append('period', filters.period);
      params.append('limit', filters.limit.toString());
      
      if (filters.type) {
        params.append('type', filters.type);
      }

      const response = await fetch(`/api/trends?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch trends');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });
};