"use client"

import { FC, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Filter as FilterIcon, 
  X, 
  ChevronDown, 
  ChevronUp,
  Zap,
  TrendingUp,
  Target,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { 
  MatchupRelativeFilters, 
  FilterPreset, 
  FILTER_CONFIGS,
  FILTER_PRESETS 
} from '@/types/matchup-filters';
import { cn } from '@/lib/utils';

interface MatchupFilterPanelProps {
  filters: MatchupRelativeFilters;
  activeFilterCount: number;
  onFilterChange: (filterId: keyof MatchupRelativeFilters, value: any) => void;
  onPresetSelect: (preset: FilterPreset) => void;
  onClearFilters: () => void;
  resultCount?: number;
  totalCount?: number;
  className?: string;
}

const presetInfo: Record<FilterPreset, { label: string; icon: any; description: string }> = {
  'fade-chalk': {
    label: 'Fade Chalk',
    icon: TrendingUp,
    description: 'Favorite has worse stats'
  },
  'stat-dom': {
    label: 'Stat Dom',
    icon: BarChart3,
    description: 'One player dominates categories'
  },
  'coin-flip': {
    label: 'Coin Flip',
    icon: DollarSign,
    description: 'Even matchups'
  },
  'form-play': {
    label: 'Form Play',
    icon: Zap,
    description: 'Position mismatches'
  },
  'value': {
    label: 'Value Hunter',
    icon: Target,
    description: 'Find mispriced players'
  }
};

export const MatchupFilterPanel: FC<MatchupFilterPanelProps> = ({
  filters,
  activeFilterCount,
  onFilterChange,
  onPresetSelect,
  onClearFilters,
  resultCount,
  totalCount,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['odds']));

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const renderFilterControl = (config: typeof FILTER_CONFIGS[0]) => {
    const value = filters[config.id];
    
    switch (config.type) {
      case 'toggle':
        return (
          <div className="flex items-center justify-between py-2">
            <Label htmlFor={config.id} className="text-sm cursor-pointer flex-1">
              <div>
                <div className="font-medium">{config.label}</div>
                <div className="text-xs text-gray-400">{config.description}</div>
              </div>
            </Label>
            <Switch
              id={config.id}
              checked={value === true}
              onCheckedChange={(checked) => onFilterChange(config.id, checked)}
              className="ml-4"
            />
          </div>
        );

      case 'slider':
        return (
          <div className="py-2">
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor={config.id} className="text-sm">
                <div className="font-medium">{config.label}</div>
                <div className="text-xs text-gray-400">{config.description}</div>
              </Label>
              <span className="text-sm font-mono">
                {value ?? config.defaultValue}{config.unit}
              </span>
            </div>
            <Slider
              id={config.id}
              min={config.min}
              max={config.max}
              step={config.step}
              value={[value ?? config.defaultValue ?? config.min ?? 0]}
              onValueChange={([val]) => onFilterChange(config.id, val)}
              className="w-full"
            />
          </div>
        );

      case 'number':
        return (
          <div className="flex items-center justify-between py-2">
            <Label htmlFor={config.id} className="text-sm flex-1">
              <div className="font-medium">{config.label}</div>
              <div className="text-xs text-gray-400">{config.description}</div>
            </Label>
            <input
              id={config.id}
              type="number"
              min={config.min}
              max={config.max}
              value={value ?? config.defaultValue ?? ''}
              onChange={(e) => onFilterChange(config.id, parseInt(e.target.value))}
              className="w-20 px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded"
            />
          </div>
        );
    }
  };

  const filtersByCategory = FILTER_CONFIGS.reduce((acc, config) => {
    if (!acc[config.category]) acc[config.category] = [];
    acc[config.category].push(config);
    return acc;
  }, {} as Record<string, typeof FILTER_CONFIGS>);

  return (
    <Card className={cn("glass-card", className)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FilterIcon className="h-4 w-4" />
            <span className="font-medium">Matchup Filters</span>
            {activeFilterCount > 0 && (
              <>
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount} Active
                </Badge>
                {resultCount !== undefined && totalCount !== undefined && (
                  <Badge variant="outline" className="ml-1 text-xs">
                    {resultCount}/{totalCount} matchups
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="h-8 px-2"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-2">Quick Presets</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(presetInfo) as FilterPreset[]).map(preset => {
              const info = presetInfo[preset];
              const Icon = info.icon;
              return (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  onClick={() => onPresetSelect(preset)}
                  className="h-8 text-xs"
                  title={info.description}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {info.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Expanded Filters */}
        {isExpanded && (
          <div className="space-y-4 border-t border-gray-700 pt-4">
            {/* Odds Comparisons */}
            <div>
              <button
                onClick={() => toggleCategory('odds')}
                className="flex items-center justify-between w-full text-left mb-2 hover:text-gray-300"
              >
                <span className="text-sm font-medium">Odds Comparisons</span>
                {expandedCategories.has('odds') ? 
                  <ChevronUp className="h-3 w-3" /> : 
                  <ChevronDown className="h-3 w-3" />
                }
              </button>
              {expandedCategories.has('odds') && (
                <div className="space-y-2 pl-2">
                  {filtersByCategory.odds?.map(config => (
                    <div key={config.id}>
                      {renderFilterControl(config)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Performance Gaps */}
            <div>
              <button
                onClick={() => toggleCategory('performance')}
                className="flex items-center justify-between w-full text-left mb-2 hover:text-gray-300"
              >
                <span className="text-sm font-medium">Performance Gaps</span>
                {expandedCategories.has('performance') ? 
                  <ChevronUp className="h-3 w-3" /> : 
                  <ChevronDown className="h-3 w-3" />
                }
              </button>
              {expandedCategories.has('performance') && (
                <div className="space-y-2 pl-2">
                  {filtersByCategory.performance?.map(config => (
                    <div key={config.id}>
                      {renderFilterControl(config)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form & Position */}
            <div>
              <button
                onClick={() => toggleCategory('form')}
                className="flex items-center justify-between w-full text-left mb-2 hover:text-gray-300"
              >
                <span className="text-sm font-medium">Form & Position</span>
                {expandedCategories.has('form') ? 
                  <ChevronUp className="h-3 w-3" /> : 
                  <ChevronDown className="h-3 w-3" />
                }
              </button>
              {expandedCategories.has('form') && (
                <div className="space-y-2 pl-2">
                  {filtersByCategory.form?.map(config => (
                    <div key={config.id}>
                      {renderFilterControl(config)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Logic */}
            <div className="border-t border-gray-700 pt-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="requireAll" className="text-sm cursor-pointer">
                  <div className="font-medium">Require All Filters</div>
                  <div className="text-xs text-gray-400">AND logic vs OR logic</div>
                </Label>
                <Switch
                  id="requireAll"
                  checked={filters.requireAll === true}
                  onCheckedChange={(checked) => onFilterChange('requireAll', checked)}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};