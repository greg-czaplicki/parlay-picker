/**
 * Heatmap utilities for color-coding table cells based on statistical performance
 * Optimized for golf statistics where some metrics are "higher is better" vs "lower is better"
 */

export interface HeatmapConfig {
  /** Whether higher values are better (true) or lower values are better (false) */
  higherIsBetter: boolean
  /** Number of color intensity levels (default: 5) */
  levels?: number
  /** Use subtle colors for better readability */
  subtle?: boolean
}

/**
 * Calculate percentile ranking for a value within a dataset
 */
function calculatePercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0
  
  let count = 0
  for (const val of sortedValues) {
    if (val <= value) count++
  }
  
  return count / sortedValues.length
}

/**
 * Generate color information (CSS classes + inline styles) for heatmap coloring
 */
export function generateHeatmapColors(
  values: (number | null)[],
  config: HeatmapConfig
): Array<{ className: string; style?: React.CSSProperties }> {
  const { higherIsBetter = true, levels = 5, subtle = true } = config
  
  // Filter out null values and sort for percentile calculation
  const validValues = values.filter((v): v is number => v !== null && !isNaN(v))
  const sortedValues = [...validValues].sort((a, b) => a - b)
  
  if (sortedValues.length === 0) {
    return values.map(() => ({ className: '' }))
  }
  
  return values.map(value => {
    if (value === null || isNaN(value)) return { className: '' }
    
    const percentile = calculatePercentile(value, sortedValues)
    
    // Adjust percentile based on whether higher is better
    const adjustedPercentile = higherIsBetter ? percentile : 1 - percentile
    
    if (subtle) {
      // Predefined subtle classes that won't be purged
      if (adjustedPercentile >= 0.8) {
        return {
          className: 'heatmap-excellent',
          style: {
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            color: 'rgb(187, 247, 208)',
            borderColor: 'rgba(34, 197, 94, 0.25)'
          }
        }
      } else if (adjustedPercentile >= 0.6) {
        return {
          className: 'heatmap-good',
          style: {
            backgroundColor: 'rgba(34, 197, 94, 0.08)',
            color: 'rgb(220, 252, 231)',
            borderColor: 'rgba(34, 197, 94, 0.15)'
          }
        }
      } else if (adjustedPercentile >= 0.4) {
        return {
          className: 'heatmap-neutral',
          style: {
            backgroundColor: 'rgba(156, 163, 175, 0.05)',
            color: 'rgb(209, 213, 219)',
            borderColor: 'rgba(156, 163, 175, 0.15)'
          }
        }
      } else if (adjustedPercentile >= 0.2) {
        return {
          className: 'heatmap-poor',
          style: {
            backgroundColor: 'rgba(251, 191, 36, 0.08)',
            color: 'rgb(254, 240, 138)',
            borderColor: 'rgba(251, 191, 36, 0.15)'
          }
        }
      } else {
        return {
          className: 'heatmap-bad',
          style: {
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: 'rgb(254, 202, 202)',
            borderColor: 'rgba(239, 68, 68, 0.25)'
          }
        }
      }
    } else {
      // More vibrant colors for high contrast
      if (adjustedPercentile >= 0.8) {
        return {
          className: 'heatmap-excellent-bold',
          style: {
            backgroundColor: 'rgba(34, 197, 94, 0.3)',
            color: 'rgb(187, 247, 208)',
            borderColor: 'rgba(34, 197, 94, 0.5)'
          }
        }
      } else if (adjustedPercentile >= 0.6) {
        return {
          className: 'heatmap-good-bold',
          style: {
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            color: 'rgb(220, 252, 231)',
            borderColor: 'rgba(34, 197, 94, 0.4)'
          }
        }
      } else if (adjustedPercentile >= 0.4) {
        return {
          className: 'heatmap-neutral-bold',
          style: {
            backgroundColor: 'rgba(107, 114, 128, 0.1)',
            color: 'rgb(209, 213, 219)',
            borderColor: 'rgba(107, 114, 128, 0.3)'
          }
        }
      } else if (adjustedPercentile >= 0.2) {
        return {
          className: 'heatmap-poor-bold',
          style: {
            backgroundColor: 'rgba(251, 191, 36, 0.2)',
            color: 'rgb(254, 240, 138)',
            borderColor: 'rgba(251, 191, 36, 0.4)'
          }
        }
      } else {
        return {
          className: 'heatmap-bad-bold',
          style: {
            backgroundColor: 'rgba(239, 68, 68, 0.3)',
            color: 'rgb(254, 202, 202)',
            borderColor: 'rgba(239, 68, 68, 0.5)'
          }
        }
      }
    }
  })
}

/**
 * Golf-specific stat configurations
 */
export const GOLF_STAT_CONFIGS: Record<string, HeatmapConfig> = {
  // Strokes Gained - higher is better
  sg_total: { higherIsBetter: true, subtle: true },
  sg_ott: { higherIsBetter: true, subtle: true },
  sg_app: { higherIsBetter: true, subtle: true },
  sg_arg: { higherIsBetter: true, subtle: true },
  sg_putt: { higherIsBetter: true, subtle: true },
  
  // Driving stats - higher is generally better
  driving_accuracy: { higherIsBetter: true, subtle: true },
  driving_distance: { higherIsBetter: true, subtle: true },
  
  // Scoring - lower is better
  scoring_average: { higherIsBetter: false, subtle: true },
  
  // Generic configurations
  higher_better: { higherIsBetter: true, subtle: true },
  lower_better: { higherIsBetter: false, subtle: true },
}

/**
 * Get heatmap color information for a specific value and stat type
 */
export function getHeatmapColor(
  value: number | null,
  values: (number | null)[],
  statKey: string
): { className: string; style?: React.CSSProperties } {
  if (value === null || isNaN(value)) return { className: '' }
  
  const config = GOLF_STAT_CONFIGS[statKey] || GOLF_STAT_CONFIGS.higher_better
  const colors = generateHeatmapColors(values, config)
  const index = values.indexOf(value)
  
  return index >= 0 ? colors[index] : { className: '' }
} 