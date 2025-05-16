"use client"

import React, { useState, useRef, useEffect } from "react"
import { ArrowUp, ArrowDown } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { type TrendIndicator as TrendIndicatorType } from "@/types/definitions"

interface StatCellProps {
  value: number | null
  colorClass: string
  trend?: TrendIndicatorType
  precision?: number
  isPercentage?: boolean
}

export const StatCell = React.memo(function StatCell({ value, colorClass, trend, precision = 2, isPercentage = false }: StatCellProps) {
  // Debug: log render and props
  // console.log('[StatCell] render', { value, colorClass, trend });
  // Only use inline style for non-heatmap cases
  let dynamicStyle: React.CSSProperties = {};
  let className = colorClass;

  // If no trend, render a simple cell (no tooltip, no event handlers, no state)
  if (!trend) {
    return (
      <div 
        style={dynamicStyle}
        className={`font-medium truncate ${className}`}
      >
        <div className="flex items-center space-x-1">
          <span className="inline-block min-w-[40px] text-center">
            {typeof value === 'number' && !isNaN(value)
              ? isPercentage
                ? `${(value * 100).toFixed(precision)}%`
                : value.toFixed(precision)
              : 'N/A'}
          </span>
          {/* Always render a placeholder for consistent alignment */}
          <span className="inline-flex items-center justify-center w-[20px] h-[20px] ml-1 opacity-0">
            <ArrowUp size={12} />
          </span>
        </div>
      </div>
    )
  }

  // If we have a trend, show a tooltip on hover using pure CSS
  return (
    <div className="relative group">
      <div 
        style={dynamicStyle}
        className={`font-medium truncate ${className}`}
        role="button"
        tabIndex={0}
        aria-label={trend.title || undefined}
      >
        <div className="flex items-center space-x-1">
          <span className="inline-block min-w-[40px] text-center">
            {typeof value === 'number' && !isNaN(value)
              ? isPercentage
                ? `${(value * 100).toFixed(precision)}%`
                : value.toFixed(precision)
              : 'N/A'}
          </span>
          {/* Always render the trend space regardless, but apply opacity if no actual trend */}
          <span className={`inline-flex items-center justify-center w-[20px] h-[20px] ml-1 ${trend ? trend.className : 'opacity-0'}`}>
            {trend ? (trend.type === "up" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUp size={12} />}
          </span>
        </div>
      </div>
      {/* Pure CSS tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-1 z-50 px-3 py-1.5 rounded-md border bg-popover text-sm text-popover-foreground shadow-md pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
        <p>{trend.title}</p>
      </div>
    </div>
  )
})