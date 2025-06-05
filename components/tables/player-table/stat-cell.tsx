"use client"

import React, { useState, useRef, useEffect } from "react"
import { ArrowUp, ArrowDown } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { type TrendIndicator as TrendIndicatorType } from "@/types/definitions"

// Add styles to ensure the table cells have consistent width
import './table-styles.css'

interface StatCellProps {
  value: number | null
  colorClass: string
  trend?: TrendIndicatorType
  precision?: number
  isPercentage?: boolean
}

export const StatCell = React.memo(function StatCell({ value, colorClass, trend, precision = 2, isPercentage = false }: StatCellProps) {
  // Parse heatmap style information if provided
  let dynamicStyle: React.CSSProperties = {}
  let className = colorClass

  // Check if colorClass contains heatmap style information (JSON format)
  if (colorClass.startsWith('{') && colorClass.endsWith('}')) {
    try {
      const styleInfo = JSON.parse(colorClass)
      if (styleInfo.style) {
        dynamicStyle = styleInfo.style
        className = styleInfo.className || ''
      }
    } catch (e) {
      // If parsing fails, treat as regular className
      className = colorClass
    }
  }

  // If no trend, render a simple cell (no tooltip, no event handlers, no state)
  if (!trend) {
    return (
      <div 
        style={dynamicStyle}
        className={`font-medium truncate ${className} w-full flex justify-center items-center rounded px-1`}
      >
        <div className="flex items-center justify-center">
          <span className="inline-block min-w-[32px] text-center">
            {typeof value === 'number' && !isNaN(value)
              ? isPercentage
                ? `${(value * 100).toFixed(precision)}%`
                : value.toFixed(precision)
              : 'N/A'}
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
        className={`font-medium truncate ${className} w-full flex justify-center items-center rounded px-1`}
        role="button"
        tabIndex={0}
        aria-label={trend.title || undefined}
      >
        <div className="flex items-center justify-center">
          <span className="inline-block min-w-[32px] text-center">
            {typeof value === 'number' && !isNaN(value)
              ? isPercentage
                ? `${(value * 100).toFixed(precision)}%`
                : value.toFixed(precision)
              : 'N/A'}
          </span>
          {/* Display trend indicators */}
          <span className={`inline-flex items-center justify-center w-[12px] h-[12px] ml-1 ${trend ? trend.className : 'opacity-0'}`}>
            {trend ? (trend.type === "up" ? <ArrowUp size={8} /> : <ArrowDown size={8} />) : <ArrowUp size={8} />}
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