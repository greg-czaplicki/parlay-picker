"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FilterService } from "@/filters/filter-service"
import { Filter, FilterCategory } from "@/filters/types"
import { Check, Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface FilterSelectorProps {
  selectedFilters: string[]
  onFilterToggle: (filterId: string) => void
  onFilterSelect: (filterId: string) => void
  multiSelect?: boolean
  showDescriptions?: boolean
  groupByCategory?: boolean
}

interface FilterGroup {
  category: FilterCategory
  filters: Filter[]
}

export function FilterSelector({
  selectedFilters = [],
  onFilterToggle,
  onFilterSelect,
  multiSelect = false,
  showDescriptions = true,
  groupByCategory = true,
}: FilterSelectorProps) {
  const filterService = FilterService.getInstance()
  const allFilters = filterService.getFilters()

  // Group filters by category
  const filterGroups: FilterGroup[] = groupByCategory
    ? Object.values(FilterCategory).map(category => ({
        category,
        filters: filterService.getFiltersByCategory(category),
      })).filter(group => group.filters.length > 0)
    : [{ category: FilterCategory.CUSTOM, filters: allFilters }]

  const handleFilterClick = (filterId: string) => {
    if (multiSelect) {
      onFilterToggle(filterId)
    } else {
      onFilterSelect(filterId)
    }
  }

  const isSelected = (filterId: string) => selectedFilters.includes(filterId)

  const getCategoryLabel = (category: FilterCategory): string => {
    switch (category) {
      case FilterCategory.PLAYER:
        return "Player Filters"
      case FilterCategory.TEAM:
        return "Team Filters"
      case FilterCategory.MATCHUP:
        return "Matchup Filters"
      case FilterCategory.CUSTOM:
        return "Custom Filters"
      default:
        return "Filters"
    }
  }

  const getCategoryDescription = (category: FilterCategory): string => {
    switch (category) {
      case FilterCategory.PLAYER:
        return "Filter individual player performance and characteristics"
      case FilterCategory.TEAM:
        return "Filter team-based metrics and statistics"
      case FilterCategory.MATCHUP:
        return "Filter head-to-head and group matchup data"
      case FilterCategory.CUSTOM:
        return "User-defined and advanced filtering options"
      default:
        return "Available filtering options"
    }
  }

  if (allFilters.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-center">
          <p className="text-gray-400">No filters available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {filterGroups.map(({ category, filters }) => (
          <Card key={category} className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{getCategoryLabel(category)}</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {filters.length} available
                </Badge>
              </div>
              {showDescriptions && (
                <p className="text-sm text-gray-400 mt-1">
                  {getCategoryDescription(category)}
                </p>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filters.map((filter) => {
                  const selected = isSelected(filter.id)
                  return (
                    <Tooltip key={filter.id}>
                      <TooltipTrigger asChild>
                        <Button
                          variant={selected ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleFilterClick(filter.id)}
                          className={`
                            h-auto p-3 text-left justify-start relative
                            ${selected 
                              ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                              : "hover:bg-accent hover:text-accent-foreground"
                            }
                          `}
                        >
                          <div className="flex items-start justify-between w-full">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {filter.name}
                              </div>
                              {showDescriptions && (
                                <div className="text-xs mt-1 opacity-80 line-clamp-2">
                                  {filter.description}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              {selected && (
                                <Check className="h-4 w-4 text-primary-foreground" />
                              )}
                              <Info className="h-3 w-3 opacity-60" />
                            </div>
                          </div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <div>
                          <p className="font-medium">{filter.name}</p>
                          <p className="text-sm mt-1">{filter.description}</p>
                          <p className="text-xs mt-2 text-gray-400">
                            Category: {filter.category}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  )
} 