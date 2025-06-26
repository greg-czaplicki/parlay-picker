"use client"

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MatchupFilters } from "@/types/matchups";

interface MatchupFiltersProps {
  filters: MatchupFilters;
  onFiltersChange: (filters: MatchupFilters) => void;
  compactMode?: boolean;
}

export function MatchupFiltersComponent({
  filters,
  onFiltersChange,
  compactMode = false
}: MatchupFiltersProps) {
  const handleFilterChange = (key: keyof MatchupFilters, value: boolean | string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <div className={`space-y-4 ${compactMode ? "p-2" : "p-4"}`}>
      <div>
        <Label htmlFor="playerSearch">Search Players</Label>
        <Input
          id="playerSearch"
          type="text"
          placeholder="Enter player name..."
          value={filters.playerSearch}
          onChange={(e) => handleFilterChange("playerSearch", e.target.value)}
          className="mt-1"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Switch
            id="showOnlyFavorites"
            checked={filters.showOnlyFavorites}
            onCheckedChange={(checked) => handleFilterChange("showOnlyFavorites", checked)}
          />
          <Label htmlFor="showOnlyFavorites">Show Only Favorites</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="showOnlyPositiveEv"
            checked={filters.showOnlyPositiveEv}
            onCheckedChange={(checked) => handleFilterChange("showOnlyPositiveEv", checked)}
          />
          <Label htmlFor="showOnlyPositiveEv">Show Only Positive EV</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="showOnlyNegativeEv"
            checked={filters.showOnlyNegativeEv}
            onCheckedChange={(checked) => handleFilterChange("showOnlyNegativeEv", checked)}
          />
          <Label htmlFor="showOnlyNegativeEv">Show Only Negative EV</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="showOnlyWithStats"
            checked={filters.showOnlyWithStats}
            onCheckedChange={(checked) => handleFilterChange("showOnlyWithStats", checked)}
          />
          <Label htmlFor="showOnlyWithStats">Show Only With Stats</Label>
        </div>
      </div>
    </div>
  );
} 