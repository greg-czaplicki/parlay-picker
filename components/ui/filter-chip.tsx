"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FilterService } from "@/filters/filter-service"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface FilterChipProps {
  filterId: string
  onRemove?: (filterId: string) => void
  variant?: "default" | "secondary" | "outline"
  size?: "sm" | "md" | "lg"
  showRemoveButton?: boolean
  showTooltip?: boolean
  className?: string
}

export function FilterChip({
  filterId,
  onRemove,
  variant = "default",
  size = "sm",
  showRemoveButton = true,
  showTooltip = true,
  className,
}: FilterChipProps) {
  const filterService = FilterService.getInstance()
  const filter = filterService.getFilterById(filterId)

  if (!filter) {
    return null
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove?.(filterId)
  }

  const chipContent = (
    <Badge
      variant={variant}
      className={cn(
        "inline-flex items-center gap-1.5 transition-colors",
        {
          "text-xs px-2 py-1": size === "sm",
          "text-sm px-3 py-1.5": size === "md", 
          "text-base px-4 py-2": size === "lg",
        },
        className
      )}
    >
      <span className="truncate max-w-[120px]">{filter.name}</span>
      {showRemoveButton && onRemove && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          className={cn(
            "shrink-0 hover:bg-destructive/20 hover:text-destructive",
            {
              "h-4 w-4": size === "sm",
              "h-5 w-5": size === "md",
              "h-6 w-6": size === "lg",
            }
          )}
        >
          <X className={cn({
            "h-3 w-3": size === "sm",
            "h-4 w-4": size === "md", 
            "h-5 w-5": size === "lg",
          })} />
          <span className="sr-only">Remove {filter.name} filter</span>
        </Button>
      )}
    </Badge>
  )

  if (!showTooltip) {
    return chipContent
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {chipContent}
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="max-w-xs">
            <p className="font-medium">{filter.name}</p>
            <p className="text-sm mt-1">{filter.description}</p>
            <p className="text-xs mt-2 text-gray-400">
              Category: {filter.category}
            </p>
            {showRemoveButton && onRemove && (
              <p className="text-xs mt-1 text-gray-400">
                Click × to remove filter
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface FilterChipListProps {
  filterIds: string[]
  onRemove?: (filterId: string) => void
  onClearAll?: () => void
  variant?: "default" | "secondary" | "outline"
  size?: "sm" | "md" | "lg"
  showClearAll?: boolean
  maxVisible?: number
  className?: string
}

export function FilterChipList({
  filterIds,
  onRemove,
  onClearAll,
  variant = "default",
  size = "sm",
  showClearAll = true,
  maxVisible,
  className,
}: FilterChipListProps) {
  if (filterIds.length === 0) {
    return null
  }

  const visibleFilters = maxVisible ? filterIds.slice(0, maxVisible) : filterIds
  const remainingCount = maxVisible ? Math.max(0, filterIds.length - maxVisible) : 0

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {visibleFilters.map((filterId) => (
          <FilterChip
            key={filterId}
            filterId={filterId}
            onRemove={onRemove}
            variant={variant}
            size={size}
            showTooltip={true}
          />
        ))}
        {remainingCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            +{remainingCount} more
          </Badge>
        )}
      </div>
      {showClearAll && filterIds.length > 1 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          Clear all
        </Button>
      )}
    </div>
  )
} 