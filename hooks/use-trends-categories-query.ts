import { useQuery } from '@tanstack/react-query';

export const useTrendsCategoriesQuery = () => {
  return useQuery({
    queryKey: ['trends-categories'],
    queryFn: async () => {
      const response = await fetch('/api/trends/categories');
      
      if (!response.ok) {
        throw new Error('Failed to fetch trends categories');
      }

      return response.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 2
  });
};