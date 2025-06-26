"use client"

import { useState, useCallback, useRef } from "react"
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
import { debounce } from "lodash"

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
      <CardContent className="space-y-4 pt-4">
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
          <Label className="text-sm font-medium sr-only">Available Filters</Label>
          <FilterSelector
            selectedFilters={selectedFilters}
            onFilterToggle={handleFilterToggle}
            onFilterSelect={handleFilterSelect}
            multiSelect={multiSelect}
            showDescriptions={false}
            groupByCategory={true}
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

interface SGHeavyOptions extends FilterOptions {
  minSgThreshold?: number;
  tournamentWeight?: number;
  minOddsGap?: number;
  sortBy?: 'sg' | 'odds-gap' | 'composite';
  seasonDataSource?: 'pga' | 'datagolf' | 'aggregate';
}

interface GenericFilterOptions extends FilterOptions {
  threshold?: number;
}

type AllFilterOptions = SGHeavyOptions | GenericFilterOptions;

function FilterOptionsEditor({ filterId, options, onChange }: FilterOptionsEditorProps) {
  const filterService = FilterService.getInstance();
  const filter = filterService.getFilterById(filterId);
  if (!filter) return null;

  const handleOptionChange = (key: keyof AllFilterOptions, value: any) => {
    onChange({ ...options, [key]: value });
  };

  const handleSliderChange = (key: keyof AllFilterOptions, value: number) => {
    handleOptionChange(key, value);
  };

  function getSliderValue(key: keyof SGHeavyOptions, defaultValue: number): number {
    const value = (options as SGHeavyOptions)[key];
    return typeof value === 'number' ? value : defaultValue;
  }

  if (filterId === 'sg-heavy') {
    const sgOptions = options as SGHeavyOptions;
    return (
      <div className="p-3 border rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium">{filter.name} Options</h5>
          <Badge variant="outline" className="text-xs">
            Enhanced SG Analysis
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Minimum SG Threshold */}
          <div className="space-y-2">
            <Label htmlFor={`${filterId}-minSgThreshold`} className="text-xs font-medium">
              Minimum SG Threshold
            </Label>
            <Slider
              id={`${filterId}-minSgThreshold`}
              min={-2}
              max={3}
              step={0.1}
              value={[getSliderValue('minSgThreshold', 0)]}
              onValueChange={([value]) => handleSliderChange('minSgThreshold', value)}
              className="transition-opacity"
            />
            <div className="text-xs text-gray-400">
              Current: {getSliderValue('minSgThreshold', 0).toFixed(1)} strokes gained
              <div className="mt-1">
                Filter out players performing below this Strokes Gained threshold
              </div>
            </div>
          </div>

          {/* Tournament Weight */}
          <div className="space-y-2">
            <Label htmlFor={`${filterId}-tournamentWeight`} className="text-xs font-medium">
              Tournament Weight
            </Label>
            <Slider
              id={`${filterId}-tournamentWeight`}
              min={0}
              max={1}
              step={0.1}
              value={[getSliderValue('tournamentWeight', 0.6)]}
              onValueChange={([value]) => handleSliderChange('tournamentWeight', value)}
              className="transition-opacity"
            />
            <div className="text-xs text-gray-400">
              Current: {(getSliderValue('tournamentWeight', 0.6) * 100).toFixed(0)}% tournament, {((1 - getSliderValue('tournamentWeight', 0.6)) * 100).toFixed(0)}% season
            </div>
          </div>

          {/* Season Data Source */}
          <div className="space-y-2">
            <Label htmlFor={`${filterId}-seasonDataSource`} className="text-xs font-medium">
              Season Data Source
            </Label>
            <select
              id={`${filterId}-seasonDataSource`}
              value={sgOptions.seasonDataSource || 'pga'}
              onChange={(e) => handleOptionChange('seasonDataSource', e.target.value as 'pga' | 'datagolf' | 'aggregate')}
              className="w-full h-8 px-2 text-xs border rounded"
            >
              <option value="pga">PGA Tour</option>
              <option value="datagolf">Data Golf</option>
              <option value="aggregate">Aggregate (Both)</option>
            </select>
            <div className="text-xs text-gray-400">
              Choose where to pull season-long stats from: PGA Tour official, Data Golf, or aggregate (both)
            </div>
          </div>

          {/* Sort By */}
          <div className="space-y-2">
            <Label htmlFor={`${filterId}-sortBy`} className="text-xs font-medium">
              Sort Results By
            </Label>
            <select
              id={`${filterId}-sortBy`}
              value={sgOptions.sortBy || 'sg'}
              onChange={(e) => handleOptionChange('sortBy', e.target.value as 'sg' | 'odds-gap' | 'composite')}
              className="w-full h-8 px-2 text-xs border rounded"
            >
              <option value="sg">SG Performance</option>
              <option value="odds-gap">Odds Gap</option>
              <option value="composite">Composite Score</option>
            </select>
            <div className="text-xs text-gray-400">
              Note: Players must first meet all filter criteria (min. odds gap, etc.)
              <br />
              Then results are ordered by:
              <br />
              SG Performance: Best strokes gained first
              <br />
              Odds Gap: Largest odds advantage first
              <br />
              Composite: Balance of SG and odds advantage
            </div>
          </div>

          {/* Minimum Odds Gap */}
          <div className="space-y-2">
            <Label htmlFor={`${filterId}-minOddsGap`} className="text-xs font-medium">
              Minimum Odds Gap
            </Label>
            <Slider
              id={`${filterId}-minOddsGap`}
              min={0}
              max={2}
              step={0.1}
              value={[getSliderValue('minOddsGap', 0)]}
              onValueChange={([value]) => handleSliderChange('minOddsGap', value)}
              className="transition-opacity"
            />
            <div className="text-xs text-gray-400">
              Current: {getSliderValue('minOddsGap', 0).toFixed(1)} decimal odds gap
            </div>
          </div>

          {/* Include Underdogs */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id={`${filterId}-includeUnderdogs`}
                checked={Boolean(sgOptions.includeUnderdogs)}
                onCheckedChange={(checked: boolean) => handleOptionChange('includeUnderdogs', checked)}
              />
              <Label htmlFor={`${filterId}-includeUnderdogs`} className="text-xs font-medium">
                Include Underdogs
              </Label>
            </div>
            <div className="text-xs text-gray-400">
              When enabled, includes players who aren't favorites but meet the SG criteria. Otherwise, only shows the top SG player if they're the favorite.
            </div>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="text-xs text-gray-500">
            <strong>Pro Tip:</strong> Use higher tournament weight (0.8+) during active tournaments, 
            or composite sort for balanced SG + odds analysis.
          </div>
        </div>
      </div>
    );
  }

  // Handle SG Category Leaders filter
  if (filterId === 'sg-category-leaders') {
    return (
      <div className="p-3 border rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium">{filter.name} Options</h5>
          <Badge variant="outline" className="text-xs">
            Category Specialist
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category Focus */}
          <div className="space-y-2">
            <Label htmlFor={`${filterId}-category`} className="text-xs font-medium">
              SG Category Focus
            </Label>
            <select
              id={`${filterId}-category`}
              value={options.category || 'total'}
              onChange={(e) => onChange({ ...options, category: e.target.value })}
              className="w-full h-8 px-2 text-xs border rounded"
            >
              <option value="total">Total (Overall SG)</option>
              <option value="putting">Putting</option>
              <option value="approach">Approach</option>
              <option value="around-green">Around the Green</option>
              <option value="off-tee">Off the Tee</option>
              <option value="all">Best in Any Category</option>
            </select>
          </div>

          {/* Minimum Category Value */}
          <div className="space-y-2">
            <Label htmlFor={`${filterId}-minCategoryValue`} className="text-xs font-medium">
              Minimum Category Value
            </Label>
            <Slider
              id={`${filterId}-minCategoryValue`}
              min={0}
              max={2}
              step={0.1}
              value={[Number(options.minCategoryValue) || 0.5]}
              onValueChange={([value]) => onChange({ ...options, minCategoryValue: value })}
            />
            <div className="text-xs text-gray-400">
              Current: {(options.minCategoryValue || 0.5).toFixed(1)} strokes gained
            </div>
          </div>

          {/* Minimum Percentile */}
          <div className="space-y-2">
            <Label htmlFor={`${filterId}-minPercentile`} className="text-xs font-medium">
              Minimum Percentile Rank
            </Label>
            <Slider
              id={`${filterId}-minPercentile`}
              min={50}
              max={95}
              step={5}
              value={[Number(options.minPercentile) || 70]}
              onValueChange={([value]) => onChange({ ...options, minPercentile: value })}
            />
            <div className="text-xs text-gray-400">
              Current: Top {100 - (options.minPercentile || 70)}% of players
            </div>
          </div>

          {/* Require Consistency */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id={`${filterId}-requireConsistency`}
                checked={Boolean(options.requireConsistency)}
                onCheckedChange={(checked) => onChange({ ...options, requireConsistency: checked })}
              />
              <Label htmlFor={`${filterId}-requireConsistency`} className="text-xs font-medium">
                Require Multi-Category Consistency
              </Label>
            </div>
            <div className="text-xs text-gray-400">
              {options.requireConsistency ? 'Players must be strong across multiple SG categories' : 'Focus only on selected category'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Handle Heavy Favorites filter
  if (filterId === 'heavy-favorites') {
    return (
      <div className="p-3 border rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium">{filter.name} Options</h5>
          <Badge variant="outline" className="text-xs">
            Odds Analysis
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${filterId}-oddsGap`} className="text-xs font-medium">
              Minimum Odds Gap
            </Label>
            <Slider
              id={`${filterId}-oddsGap`}
              min={0.1}
              max={1.5}
              step={0.1}
              value={[Number(options.oddsGap) || 0.4]}
              onValueChange={([value]) => onChange({ ...options, oddsGap: value })}
            />
            <div className="text-xs text-gray-400">
              Current: {(options.oddsGap || 0.4).toFixed(1)} decimal odds gap required
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Generic fallback for other filters
  return (
    <div className="p-3 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-medium">{filter.name} Options</h5>
        <Badge variant="outline" className="text-xs">
          {filter.category}
        </Badge>
      </div>
      
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
            value={[getSliderValue('threshold', 50)]}
            onValueChange={([value]) => handleSliderChange('threshold', value)}
            className="transition-opacity"
          />
          <div className="text-xs text-gray-400">
            Current: {Math.round(getSliderValue('threshold', 50))}
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
            onChange={(e) => onChange({ ...options, weight: parseFloat(e.target.value) || 1 })}
            className="h-8"
          />
        </div>
      </div>
    </div>
  )
} 