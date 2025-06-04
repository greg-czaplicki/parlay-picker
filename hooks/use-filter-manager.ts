import { useState, useEffect, useCallback } from 'react'
import { FilterOptions } from '@/filters/types'
import { 
  FilterPersistence, 
  FilterPreset, 
  FilterCombination,
  FilterPerformanceMonitor 
} from '@/lib/filter-utils'
import { useDebounce } from './use-debounce'

interface UseFilterManagerOptions {
  autoSave?: boolean
  debounceMs?: number
  enablePerformanceTracking?: boolean
}

interface FilterManagerState {
  selectedFilters: string[]
  filterOptions: Record<string, FilterOptions>
  combination: FilterCombination | null
  presets: FilterPreset[]
  isLoading: boolean
}

export function useFilterManager(options: UseFilterManagerOptions = {}) {
  const {
    autoSave = true,
    debounceMs = 500,
    enablePerformanceTracking = false
  } = options

  // Core state
  const [state, setState] = useState<FilterManagerState>({
    selectedFilters: [],
    filterOptions: {},
    combination: null,
    presets: [],
    isLoading: true
  })

  // Debounced state for auto-save
  const debouncedFilters = useDebounce(state.selectedFilters, debounceMs)
  const debouncedOptions = useDebounce(state.filterOptions, debounceMs)

  // Initialize from localStorage
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const presets = FilterPersistence.getPresets()
        const recent = FilterPersistence.getRecentFilters()

        setState(prev => ({
          ...prev,
          presets,
          selectedFilters: recent?.filterIds || [],
          filterOptions: recent?.filterOptions || {},
          isLoading: false
        }))
      } catch (error) {
        console.error('Failed to load filter state:', error)
        setState(prev => ({ ...prev, isLoading: false }))
      }
    }

    loadInitialState()
  }, [])

  // Auto-save recent filters
  useEffect(() => {
    if (autoSave && !state.isLoading) {
      FilterPersistence.saveRecentFilters(debouncedFilters, debouncedOptions)
    }
  }, [debouncedFilters, debouncedOptions, autoSave, state.isLoading])

  // Filter management methods
  const addFilter = useCallback((filterId: string, options: FilterOptions = {}) => {
    setState(prev => ({
      ...prev,
      selectedFilters: prev.selectedFilters.includes(filterId) 
        ? prev.selectedFilters 
        : [...prev.selectedFilters, filterId],
      filterOptions: {
        ...prev.filterOptions,
        [filterId]: options
      }
    }))
  }, [])

  const removeFilter = useCallback((filterId: string) => {
    setState(prev => {
      const newOptions = { ...prev.filterOptions }
      delete newOptions[filterId]
      
      return {
        ...prev,
        selectedFilters: prev.selectedFilters.filter(id => id !== filterId),
        filterOptions: newOptions
      }
    })
  }, [])

  const toggleFilter = useCallback((filterId: string, options: FilterOptions = {}) => {
    setState(prev => {
      if (prev.selectedFilters.includes(filterId)) {
        // Remove filter
        const newOptions = { ...prev.filterOptions }
        delete newOptions[filterId]
        
        return {
          ...prev,
          selectedFilters: prev.selectedFilters.filter(id => id !== filterId),
          filterOptions: newOptions
        }
      } else {
        // Add filter
        return {
          ...prev,
          selectedFilters: [...prev.selectedFilters, filterId],
          filterOptions: {
            ...prev.filterOptions,
            [filterId]: options
          }
        }
      }
    })
  }, [])

  const updateFilterOptions = useCallback((filterId: string, options: FilterOptions) => {
    setState(prev => ({
      ...prev,
      filterOptions: {
        ...prev.filterOptions,
        [filterId]: options
      }
    }))
  }, [])

  const clearAllFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedFilters: [],
      filterOptions: {},
      combination: null
    }))
  }, [])

  const setFilterCombination = useCallback((combination: FilterCombination | null) => {
    setState(prev => ({
      ...prev,
      combination
    }))
  }, [])

  // Preset management
  const savePreset = useCallback((name: string, description?: string) => {
    const preset = FilterPersistence.savePreset({
      name,
      description,
      filterIds: state.selectedFilters,
      filterOptions: state.filterOptions,
      combination: state.combination || undefined
    })

    setState(prev => ({
      ...prev,
      presets: [...prev.presets, preset]
    }))

    return preset
  }, [state.selectedFilters, state.filterOptions, state.combination])

  const loadPreset = useCallback((presetId: string) => {
    const preset = state.presets.find(p => p.id === presetId)
    if (preset) {
      setState(prev => ({
        ...prev,
        selectedFilters: preset.filterIds,
        filterOptions: preset.filterOptions,
        combination: preset.combination || null
      }))

      FilterPersistence.markPresetUsed(presetId)
      
      // Update presets with new lastUsed time
      setState(prev => ({
        ...prev,
        presets: prev.presets.map(p => 
          p.id === presetId 
            ? { ...p, lastUsed: new Date() }
            : p
        )
      }))
    }
  }, [state.presets])

  const deletePreset = useCallback((presetId: string) => {
    FilterPersistence.deletePreset(presetId)
    setState(prev => ({
      ...prev,
      presets: prev.presets.filter(p => p.id !== presetId)
    }))
  }, [])

  // Performance tracking
  const recordFilterPerformance = useCallback((
    operation: string,
    duration: number,
    filterCount: number,
    dataSize: number
  ) => {
    if (enablePerformanceTracking) {
      FilterPerformanceMonitor.recordOperation(operation, duration, filterCount, dataSize)
    }
  }, [enablePerformanceTracking])

  const getPerformanceStats = useCallback(() => {
    return enablePerformanceTracking ? FilterPerformanceMonitor.getStats() : null
  }, [enablePerformanceTracking])

  // Utility methods
  const isFilterActive = useCallback((filterId: string) => {
    return state.selectedFilters.includes(filterId)
  }, [state.selectedFilters])

  const getFilterOptions = useCallback((filterId: string) => {
    return state.filterOptions[filterId] || {}
  }, [state.filterOptions])

  const hasFilters = state.selectedFilters.length > 0

  const exportState = useCallback(() => {
    return {
      selectedFilters: state.selectedFilters,
      filterOptions: state.filterOptions,
      combination: state.combination,
      timestamp: new Date().toISOString()
    }
  }, [state])

  const importState = useCallback((exportedState: any) => {
    if (exportedState && exportedState.selectedFilters && exportedState.filterOptions) {
      setState(prev => ({
        ...prev,
        selectedFilters: exportedState.selectedFilters,
        filterOptions: exportedState.filterOptions,
        combination: exportedState.combination || null
      }))
    }
  }, [])

  return {
    // State
    selectedFilters: state.selectedFilters,
    filterOptions: state.filterOptions,
    combination: state.combination,
    presets: state.presets,
    isLoading: state.isLoading,
    hasFilters,

    // Filter management
    addFilter,
    removeFilter,
    toggleFilter,
    updateFilterOptions,
    clearAllFilters,
    setFilterCombination,

    // Preset management
    savePreset,
    loadPreset,
    deletePreset,

    // Utilities
    isFilterActive,
    getFilterOptions,
    recordFilterPerformance,
    getPerformanceStats,
    exportState,
    importState,
  }
} 