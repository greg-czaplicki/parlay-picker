"use client"

import { useState, useRef, useEffect } from "react"
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
}

export function StatCell({ value, colorClass, trend, precision = 2 }: StatCellProps) {
  // Manual tooltip handling
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Parse the color class to get inline styles
  let bgColor = "transparent";
  let textColor = "black";
  
  // Map the heatmap classes to colors 
  // These form a more granular diverging scale that better highlights differences in performance
  if (colorClass.includes("heatmap-exceptional")) {
    bgColor = "#00441b"; // Very dark green - top performers
    textColor = "white";
  } else if (colorClass.includes("heatmap-excellent")) {
    bgColor = "#006837"; // Dark green
    textColor = "white";
  } else if (colorClass.includes("heatmap-very-good")) {
    bgColor = "#1a9850"; // Medium-dark green
    textColor = "white";
  } else if (colorClass.includes("heatmap-good")) {
    bgColor = "#41ab5d"; // Medium green
    textColor = "white";
  } else if (colorClass.includes("heatmap-above-average")) {
    bgColor = "#78c679"; // Light-medium green
    textColor = "black";
  } else if (colorClass.includes("heatmap-slightly-good")) {
    bgColor = "#c2e699"; // Light green
    textColor = "black";
  } else if (colorClass.includes("heatmap-neutral")) {
    bgColor = "#ffffbf"; // Pale yellow/almost white
    textColor = "black";
  } else if (colorClass.includes("heatmap-slightly-poor")) {
    bgColor = "#fdae61"; // Light orange
    textColor = "black";
  } else if (colorClass.includes("heatmap-poor")) {
    bgColor = "#e6550d"; // Medium-dark orange/red
    textColor = "white";
  } else if (colorClass.includes("heatmap-very-poor")) {
    bgColor = "#a50026"; // Dark red
    textColor = "white";
  } else if (colorClass.includes("heatmap-terrible")) {
    bgColor = "#7f0000"; // Very dark red
    textColor = "white";
  }
  
  const style = {
    backgroundColor: bgColor,
    color: textColor
  };
  
  // Prepare tooltip content if trend exists
  const tooltipContent = trend ? trend.title : null;
  
  // Handle hover start - set a timeout before showing tooltip
  const handleMouseEnter = () => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set a new timeout
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 750); // 750ms delay
  };
  
  // Handle hover end - immediately hide tooltip and clear timeout
  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShowTooltip(false);
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  // If we have a trend, use custom tooltip logic
  if (tooltipContent) {
    return (
      <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <div 
          style={{
            ...style,
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px 8px",
            cursor: "pointer"
          }}
          className={`font-medium truncate ${colorClass}`}
          role="button"
          tabIndex={0}
          aria-label={tooltipContent}
        >
          <div className="flex items-center space-x-1">
            <span>
              {value !== null ? value.toFixed(precision) : 'N/A'}
            </span>
            <span className={`inline-flex items-center justify-center w-[20px] h-[20px] ml-1 ${trend.className}`}>
              {trend.type === "up" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            </span>
          </div>
        </div>
        
        {/* Manual tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-1 z-50 px-3 py-1.5 rounded-md border bg-popover text-sm text-popover-foreground shadow-md pointer-events-none whitespace-nowrap">
            <p>{tooltipContent}</p>
          </div>
        )}
      </div>
    );
  }
  
  // If no trend, just render the cell without a tooltip
  return (
    <div 
      style={{
        ...style,
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 8px"
      }}
      className={`font-medium truncate ${colorClass}`}
    >
      <div className="flex items-center">
        <span>
          {value !== null ? value.toFixed(precision) : 'N/A'}
        </span>
      </div>
    </div>
  )
}