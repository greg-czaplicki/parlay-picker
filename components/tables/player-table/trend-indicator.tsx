"use client"

import { ArrowUp, ArrowDown } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type TrendType = {
  type: "up" | "down";
  className: string;
  title: string;
} | null;

interface TrendIndicatorProps {
  trend: TrendType;
}

export function TrendIndicator({ trend }: TrendIndicatorProps) {
  if (!trend) {
    return <span className="inline-block w-[12px] h-[12px] opacity-0" />;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span 
          className={`inline-flex items-center justify-center w-[20px] h-[20px] ml-1 cursor-help ${trend.className}`}
          role="button"
          tabIndex={0}
          aria-label={trend.title}
        >
          {trend.type === "up" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{trend.title}</p>
      </TooltipContent>
    </Tooltip>
  );
}