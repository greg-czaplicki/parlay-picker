"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { FilterService } from "@/filters/filter-service"
import { FilterOptions } from "@/filters/types"
import { FilterSelector } from "./filter-selector"
import { FilterChipList } from "./filter-chip"
import { 
  Settings, 
  Filter as FilterIcon, 
  RotateCcw, 
  Save,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface FilterPanelProps {
  selectedFilters: string[]
  onFiltersChange: (filterIds: string[]) => void
  filterOptions?: Record<string, FilterOptions>
  onFilterOptionsChange?: (filterId: string, options: FilterOptions) => void
  multiSelect?: boolean
  showResultCount?: boolean
  resultCount?: number
  isLoading?: boolean
  compact?: boolean
}

export function FilterPanel({
  selectedFilters = [],
  onFiltersChange,
  filterOptions = {},
  onFilterOptionsChange,
  multiSelect = true,
  showResultCount = true,
  resultCount,
  isLoading = false,
  compact = false,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(!compact)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleFilterToggle = (filterId: string) => {
    if (multiSelect) {
      const newFilters = selectedFilters.includes(filterId)
        ? selectedFilters.filter(id => id !== filterId)
        : [...selectedFilters, filterId]
      onFiltersChange(newFilters)
    } else {
      onFiltersChange([filterId])
    }
  }

  const handleFilterSelect = (filterId: string) => {
    onFiltersChange([filterId])
  }

  const handleFilterRemove = (filterId: string) => {
    onFiltersChange(selectedFilters.filter(id => id !== filterId))
  }

  const handleClearAll = () => {
    onFiltersChange([])
  }

  const handleResetOptions = () => {
    if (onFilterOptionsChange) {
      selectedFilters.forEach(filterId => {
        onFilterOptionsChange(filterId, {})
      })
    }
  }

  if (compact) {
    return (
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FilterIcon className="h-4 w-4" />
              <span className="font-medium text-sm">Filters</span>
              {selectedFilters.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedFilters.length} active
                </Badge>
              )}
              {showResultCount && resultCount !== undefined && (
                <Badge variant="outline" className="text-xs">
                  {isLoading ? "..." : `${resultCount} results`}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Filter Configuration</DialogTitle>
                  </DialogHeader>
                  <FilterSelector
                    selectedFilters={selectedFilters}
                    onFilterToggle={handleFilterToggle}
                    onFilterSelect={handleFilterSelect}
                    multiSelect={multiSelect}
                    showDescriptions={true}
                    groupByCategory={true}
                  />
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleContent>
              <FilterChipList
                filterIds={selectedFilters}
                onRemove={handleFilterRemove}
                onClearAll={handleClearAll}
                maxVisible={5}
                className="mb-3"
              />
              
              {selectedFilters.length > 0 && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    {showAdvanced ? "Hide" : "Show"} Options
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetOptions}
                    className="text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </div>
              )}
              
              {showAdvanced && selectedFilters.length > 0 && (
                <div className="mt-3 space-y-3 p-3 bg-accent/20 rounded-lg">
                  <h4 className="text-sm font-medium">Filter Options</h4>
                  {selectedFilters.map(filterId => (
                    <FilterOptionsEditor
                      key={filterId}
                      filterId={filterId}
                      options={filterOptions[filterId] || {}}
                      onChange={(options) => onFilterOptionsChange?.(filterId, options)}
                    />
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FilterIcon className="h-5 w-5" />
            Filter & Search
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectedFilters.length > 0 && (
              <Badge variant="secondary">
                {selectedFilters.length} active
              </Badge>
            )}
            {showResultCount && resultCount !== undefined && (
              <Badge variant="outline">
                {isLoading ? "Loading..." : `${resultCount} results`}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Filters */}
        {selectedFilters.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Active Filters</Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetOptions}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset Options
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-xs text-destructive"
                >
                  Clear All
                </Button>
              </div>
            </div>
            <FilterChipList
              filterIds={selectedFilters}
              onRemove={handleFilterRemove}
              onClearAll={handleClearAll}
            />
          </div>
        )}

        {/* Filter Selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Available Filters</Label>
          <FilterSelector
            selectedFilters={selectedFilters}
            onFilterToggle={handleFilterToggle}
            onFilterSelect={handleFilterSelect}
            multiSelect={multiSelect}
            showDescriptions={false}
            groupByCategory={false}
          />
        </div>

        {/* Filter Options */}
        {selectedFilters.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Filter Configuration</Label>
            {selectedFilters.map(filterId => (
              <FilterOptionsEditor
                key={filterId}
                filterId={filterId}
                options={filterOptions[filterId] || {}}
                onChange={(options) => onFilterOptionsChange?.(filterId, options)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface FilterOptionsEditorProps {
  filterId: string
  options: FilterOptions
  onChange: (options: FilterOptions) => void
}

function FilterOptionsEditor({ filterId, options, onChange }: FilterOptionsEditorProps) {
  const filterService = FilterService.getInstance()
  const filter = filterService.getFilterById(filterId)

  if (!filter) return null

  // This is a basic editor - in a real implementation, 
  // filters would define their own configuration schema
  const handleOptionChange = (key: string, value: unknown) => {
    onChange({ ...options, [key]: value })
  }

  return (
    <div className="p-3 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-medium">{filter.name} Options</h5>
        <Badge variant="outline" className="text-xs">
          {filter.category}
        </Badge>
      </div>
      
      {/* Generic options - filters can define their own UI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${filterId}-threshold`} className="text-xs">
            Threshold
          </Label>
          <Slider
            id={`${filterId}-threshold`}
            min={0}
            max={100}
            step={1}
            value={[Number(options.threshold) || 50]}
            onValueChange={([value]) => handleOptionChange('threshold', value)}
          />
          <div className="text-xs text-gray-400">
            Current: {options.threshold || 50}
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor={`${filterId}-weight`} className="text-xs">
            Weight
          </Label>
          <Input
            id={`${filterId}-weight`}
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={String(options.weight || 1)}
            onChange={(e) => handleOptionChange('weight', parseFloat(e.target.value) || 1)}
            className="h-8"
          />
        </div>
      </div>
    </div>
  )
} 