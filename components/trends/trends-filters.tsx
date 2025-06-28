'use client';

import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';

interface TrendsFiltersProps {
  filters: {
    category: string;
    period: string;
    type?: string;
    limit: number;
  };
  onFilterChange: (filters: any) => void;
  categories?: any;
  onRecalculate: () => void;
  isRecalculating: boolean;
}

export const TrendsFilters = ({
  filters,
  onFilterChange,
  categories,
  onRecalculate,
  isRecalculating
}: TrendsFiltersProps) => {
  const handleCategoryChange = (value: string) => {
    onFilterChange({ category: value });
  };

  const handlePeriodChange = (value: string) => {
    onFilterChange({ period: value });
  };

  const handleTypeChange = (value: string) => {
    onFilterChange({ type: value === 'all' ? undefined : value });
  };

  return (
    <div className="glass-card p-6">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Category:</label>
          <Select value={filters.category} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-40 glass border-border/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-bright">
              <SelectItem value="all">All Players</SelectItem>
              {categories?.categories && Object.entries(categories.categories).map(([key, cat]: [string, any]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    {cat.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Period:</label>
          <Select value={filters.period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-44 glass border-border/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-bright">
              {categories?.periods && Object.entries(categories.periods).map(([key, period]: [string, any]) => (
                <SelectItem key={key} value={key}>
                  {period.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Trend Type:</label>
          <Select value={filters.type || 'all'} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-48 glass border-border/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-bright">
              <SelectItem value="all">All Types</SelectItem>
              {categories?.trend_types && Object.entries(categories.trend_types).map(([key, type]: [string, any]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <span>{type.icon}</span>
                    {type.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRecalculate}
          disabled={isRecalculating}
          className="ml-auto btn-glass"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
          Recalculate
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing trends for <strong className="text-primary">{filters.category === 'all' ? 'all players' : categories?.categories?.[filters.category]?.name}</strong> 
        {' '}over <strong className="text-primary">{categories?.periods?.[filters.period]?.name.toLowerCase()}</strong>
        {filters.type && (
          <span> filtering by <strong className="text-primary">{categories?.trend_types?.[filters.type]?.name.toLowerCase()}</strong></span>
        )}
      </div>
    </div>
  );
};