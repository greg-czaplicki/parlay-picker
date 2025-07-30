import { useState, useEffect } from 'react';
import { FilterPreset } from '@/types/matchup-filters';

export interface FilterConfidenceData {
  filterPreset: FilterPreset;
  confidenceScore: number; // 0-1
  winRate: number;
  edgeDetected: number;
  sampleSize: number;
  trendDirection: 'improving' | 'declining' | 'stable';
  lastUpdated: Date;
}

export interface UseFilterConfidenceResult {
  confidence: Record<FilterPreset, FilterConfidenceData | null>;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useFilterConfidence(): UseFilterConfidenceResult {
  const [confidence, setConfidence] = useState<Record<FilterPreset, FilterConfidenceData | null>>({
    'fade-chalk': null,
    'stat-dom': null,
    'form-play': null,
    'value': null,
    'data-intel': null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfidenceData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch historical performance data for confidence scores
      const response = await fetch('/api/filter-performance?includeHistorical=true&period=last_30_days');
      
      if (!response.ok) {
        throw new Error('Failed to fetch filter confidence data');
      }
      
      const data = await response.json();
      const historicalData = data.historical || [];
      
      // Also fetch recent performance for current win rates
      const recentResponse = await fetch('/api/filter-performance');
      const recentData = await recentResponse.json();
      const recentSnapshots = recentData.recent || [];
      
      // Process historical data into confidence scores
      const newConfidence: Record<FilterPreset, FilterConfidenceData | null> = {
        'fade-chalk': null,
        'stat-dom': null,
        'form-play': null,
        'value': null,
        'data-intel': null
      };
      
      // Group recent snapshots by filter for current metrics
      const recentByFilter = new Map<FilterPreset, any[]>();
      recentSnapshots.forEach((snapshot: any) => {
        const filter = snapshot.filter_preset as FilterPreset;
        if (!recentByFilter.has(filter)) {
          recentByFilter.set(filter, []);
        }
        recentByFilter.get(filter)!.push(snapshot);
      });
      
      historicalData.forEach((hist: any) => {
        const filterPreset = hist.filter_preset as FilterPreset;
        const recentSnaps = recentByFilter.get(filterPreset) || [];
        
        // Calculate current win rate from recent snapshots
        const currentWinRate = recentSnaps.length > 0 
          ? recentSnaps.reduce((sum, s) => sum + (s.win_rate || 0), 0) / recentSnaps.length
          : hist.overall_win_rate || 0;
        
        // Calculate sample size from recent snapshots
        const sampleSize = recentSnaps.reduce((sum, s) => sum + (s.matchups_flagged_by_filter || 0), 0);
        
        newConfidence[filterPreset] = {
          filterPreset,
          confidenceScore: hist.confidence_score || 0,
          winRate: currentWinRate,
          edgeDetected: hist.overall_edge || 0,
          sampleSize,
          trendDirection: hist.trend_direction || 'stable',
          lastUpdated: new Date(hist.last_updated || Date.now())
        };
      });
      
      setConfidence(newConfidence);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching filter confidence:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfidenceData();
  }, []);

  return {
    confidence,
    isLoading,
    error,
    refresh: fetchConfidenceData
  };
}