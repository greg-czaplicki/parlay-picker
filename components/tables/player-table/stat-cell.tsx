"use client"

import { TrendIndicator } from "./trend-indicator"
import { type TrendIndicator as TrendIndicatorType } from "@/types/definitions"

interface StatCellProps {
  value: number | null
  colorClass: string
  trend?: TrendIndicatorType
  precision?: number
}

export function StatCell({ value, colorClass, trend, precision = 2 }: StatCellProps) {
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
      <div className="flex items-center space-x-1">
        <span>
          {value !== null ? value.toFixed(precision) : 'N/A'}
        </span>
        <TrendIndicator trend={trend} />
      </div>
    </div>
  )
}