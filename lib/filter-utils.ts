import { FilterService } from '@/filters/filter-service'
import { FilterOptions } from '@/filters/types'

/**
 * Utility for combining multiple filters with AND/OR logic
 */
export interface FilterCombination {
  operator: 'AND' | 'OR'
  filters: Array<{
    id: string
    options?: FilterOptions
    negate?: boolean // Apply filter in reverse (exclude matches)
  }>
}

export class FilterCombinator {
  private static instance: FilterCombinator | null = null

  static getInstance(): FilterCombinator {
    if (!FilterCombinator.instance) {
      FilterCombinator.instance = new FilterCombinator()
    }
    return FilterCombinator.instance
  }

  /**
   * Apply a combination of filters to data
   */
  applyCombination<T>(
    data: T[], 
    combination: FilterCombination,
    performanceTracking = false
  ): {
    filtered: T[]
    excluded: T[]
    appliedFilters: string[]
    performance: {
      totalTime: number
      filterTimes: Record<string, number>
    }
  } {
    const startTime = performance.now()
    const filterService = FilterService.getInstance()
    const performance_data = {
      totalTime: 0,
      filterTimes: {} as Record<string, number>
    }

    if (combination.operator === 'AND') {
      // AND logic: item must pass ALL filters
      let result = data
      let appliedFilters: string[] = []

      for (const filterConfig of combination.filters) {
        const filter = filterService.getFilterById(filterConfig.id)
        if (!filter) continue

        const filterStart = performance.now()
        const filterResult = filter.applyFilter(result, filterConfig.options || {})
        const filterEnd = performance.now()

        if (performanceTracking) {
          performance_data.filterTimes[filterConfig.id] = filterEnd - filterStart
        }

        if (filterConfig.negate) {
          // Use items NOT in filtered result when negating
          result = result.filter(item => !filterResult.filtered.includes(item))
        } else {
          result = filterResult.filtered
        }

        appliedFilters.push(filterConfig.id)
      }

      const excluded = data.filter(item => !result.includes(item))
      const endTime = performance.now()
      performance_data.totalTime = endTime - startTime

      return {
        filtered: result,
        excluded,
        appliedFilters,
        performance: performance_data
      }
    } else {
      // OR logic: item must pass AT LEAST ONE filter
      const allFiltered = new Set<T>()
      let appliedFilters: string[] = []

      for (const filterConfig of combination.filters) {
        const filter = filterService.getFilterById(filterConfig.id)
        if (!filter) continue

        const filterStart = performance.now()
        const filterResult = filter.applyFilter(data, filterConfig.options || {})
        const filterEnd = performance.now()

        if (performanceTracking) {
          performance_data.filterTimes[filterConfig.id] = filterEnd - filterStart
        }

        if (filterConfig.negate) {
          // Add items NOT in filtered result when negating
          const excluded = data.filter(item => !filterResult.filtered.includes(item))
          excluded.forEach((item: T) => allFiltered.add(item))
        } else {
          filterResult.filtered.forEach((item: T) => allFiltered.add(item))
        }

        appliedFilters.push(filterConfig.id)
      }

      const filtered = Array.from(allFiltered)
      const excluded = data.filter(item => !allFiltered.has(item))

      const endTime = performance.now()
      performance_data.totalTime = endTime - startTime

      return {
        filtered,
        excluded,
        appliedFilters,
        performance: performance_data
      }
    }
  }
}

/**
 * Filter persistence manager for saving/loading user preferences
 */
export interface FilterPreset {
  id: string
  name: string
  description?: string
  filterIds: string[]
  filterOptions: Record<string, FilterOptions>
  combination?: FilterCombination
  created: Date
  lastUsed: Date
}

export class FilterPersistence {
  private static readonly STORAGE_KEY = 'golf-parlay-filter-presets'
  private static readonly RECENT_KEY = 'golf-parlay-recent-filters'

  /**
   * Save a filter preset
   */
  static savePreset(preset: Omit<FilterPreset, 'id' | 'created' | 'lastUsed'>): FilterPreset {
    const presets = this.getPresets()
    const newPreset: FilterPreset = {
      ...preset,
      id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created: new Date(),
      lastUsed: new Date()
    }

    presets.push(newPreset)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets))
    return newPreset
  }

  /**
   * Get all saved presets
   */
  static getPresets(): FilterPreset[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []
      
      const presets = JSON.parse(stored)
      return presets.map((p: any) => ({
        ...p,
        created: new Date(p.created),
        lastUsed: new Date(p.lastUsed)
      }))
    } catch (error) {
      console.error('Failed to load filter presets:', error)
      return []
    }
  }

  /**
   * Update when a preset was last used
   */
  static markPresetUsed(presetId: string): void {
    const presets = this.getPresets()
    const preset = presets.find(p => p.id === presetId)
    if (preset) {
      preset.lastUsed = new Date()
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets))
    }
  }

  /**
   * Delete a preset
   */
  static deletePreset(presetId: string): void {
    const presets = this.getPresets().filter(p => p.id !== presetId)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets))
  }

  /**
   * Save recent filter state (for session continuity)
   */
  static saveRecentFilters(filterIds: string[], filterOptions: Record<string, FilterOptions>): void {
    const recent = {
      filterIds,
      filterOptions,
      timestamp: new Date().toISOString()
    }
    localStorage.setItem(this.RECENT_KEY, JSON.stringify(recent))
  }

  /**
   * Get recent filter state
   */
  static getRecentFilters(): { filterIds: string[], filterOptions: Record<string, FilterOptions> } | null {
    try {
      const stored = localStorage.getItem(this.RECENT_KEY)
      if (!stored) return null
      
      const recent = JSON.parse(stored)
      const timestamp = new Date(recent.timestamp)
      const now = new Date()
      
      // Only return recent filters if they're less than 24 hours old
      if (now.getTime() - timestamp.getTime() < 24 * 60 * 60 * 1000) {
        return {
          filterIds: recent.filterIds || [],
          filterOptions: recent.filterOptions || {}
        }
      }
      
      return null
    } catch (error) {
      console.error('Failed to load recent filters:', error)
      return null
    }
  }

  /**
   * Clear all saved data
   */
  static clearAll(): void {
    localStorage.removeItem(this.STORAGE_KEY)
    localStorage.removeItem(this.RECENT_KEY)
  }
}

/**
 * Performance monitoring utilities for filter operations
 */
export class FilterPerformanceMonitor {
  private static metrics: Array<{
    operation: string
    duration: number
    filterCount: number
    dataSize: number
    timestamp: Date
  }> = []

  /**
   * Record a filter operation for performance analysis
   */
  static recordOperation(
    operation: string,
    duration: number,
    filterCount: number,
    dataSize: number
  ): void {
    this.metrics.push({
      operation,
      duration,
      filterCount,
      dataSize,
      timestamp: new Date()
    })

    // Keep only the last 100 metrics to prevent memory bloat
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100)
    }
  }

  /**
   * Get performance statistics
   */
  static getStats(): {
    averageDuration: number
    slowestOperation: number
    totalOperations: number
    recentOperations: number
  } {
    if (this.metrics.length === 0) {
      return {
        averageDuration: 0,
        slowestOperation: 0,
        totalOperations: 0,
        recentOperations: 0
      }
    }

    const durations = this.metrics.map(m => m.duration)
    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length
    const slowestOperation = Math.max(...durations)
    
    // Count operations in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const recentOperations = this.metrics.filter(m => m.timestamp > fiveMinutesAgo).length

    return {
      averageDuration,
      slowestOperation,
      totalOperations: this.metrics.length,
      recentOperations
    }
  }

  /**
   * Check if performance is degraded
   */
  static isPerformanceDegraded(): boolean {
    const stats = this.getStats()
    return stats.averageDuration > 100 || // Average over 100ms
           stats.slowestOperation > 500 ||  // Any operation over 500ms
           stats.recentOperations > 10      // More than 10 operations in 5 min
  }

  /**
   * Clear all metrics
   */
  static clearMetrics(): void {
    this.metrics = []
  }
}

/**
 * Helper to create common filter combinations
 */
export const FilterPresets = {
  BALANCED_STRATEGY: {
    operator: 'AND' as const,
    filters: [
      { id: 'balanced', options: { weight: 1.0 } },
      { id: 'sg-value', options: { threshold: 60, weight: 0.8 } }
    ]
  },

  HEAVY_FAVORITES_ONLY: {
    operator: 'AND' as const,
    filters: [
      { id: 'heavy-favorites', options: { threshold: 70, weight: 1.0 } },
      { id: 'sg-heavy', options: { weight: 0.9 } }
    ]
  },

  VALUE_HUNTING: {
    operator: 'OR' as const,
    filters: [
      { id: 'sg-value', options: { threshold: 70, weight: 1.0 } },
      { id: 'balanced', options: { weight: 0.8 } }
    ]
  },

  EXCLUDE_POOR_FORM: {
    operator: 'AND' as const,
    filters: [
      { id: 'sg-heavy', options: { threshold: 50 }, negate: true }, // Exclude poor SG players
      { id: 'balanced', options: { weight: 1.0 } }
    ]
  }
} 