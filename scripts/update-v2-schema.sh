#!/bin/bash

# Script to update all v2 table references to current schema

echo "🔄 Updating all v2 table references to current schema..."

# List of files to update
FILES=(
  "app/api/live-stats/sync-status/route.ts"
  "app/api/live-stats/auto-sync/route.ts"
  "app/api/debug-settlement/route.ts"
  "app/api/debug-golf-data/route.ts"
  "app/api/player-stats/route.ts"
  "app/api/schedule/sync/route.ts"
  "app/api/cron/live-tournament-sync/route.ts"
  "app/api/cron/weekly-maintenance/route.ts"
  "app/api/players/sync-skill-ratings/route.ts"
  "app/api/settle-status/route.ts"
  "app/api/trends/route.ts"
  "app/api/trends/populate-results/route.ts"
  "app/api/settle-rounds/route.ts"
  "app/api/parlay-picks/route.ts"
  "app/api/snapshots/route.ts"
  "app/api/ml-data/route.ts"
  "app/api/admin/reverse-settlement/route.ts"
  "lib/services/sg-momentum-service.ts"
  "lib/services/trends-calculation-service.ts"
  "lib/snapshot-service.ts"
  "lib/ml/feature-engineering.ts"
  "hooks/use-dashboard-debug-diagnostics.ts"
)

# Update table names
echo "📝 Updating table references..."

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  - Updating $file"
    
    # Replace v2 table names with current schema
    sed -i 's/tournaments_v2/tournaments/g' "$file"
    sed -i 's/players_v2/players/g' "$file"
    sed -i 's/matchups_v2/betting_markets/g' "$file"
    sed -i 's/parlays_v2/parlays/g' "$file"
    sed -i 's/parlay_picks_v2/parlay_picks/g' "$file"
    sed -i 's/tournament_results_v2/tournament_results/g' "$file"
    sed -i 's/player_advanced_stats_v2/player_advanced_stats/g' "$file"
    sed -i 's/courses_v2/courses/g' "$file"
  else
    echo "  ⚠️  File not found: $file"
  fi
done

echo "✅ Schema update complete!"
echo ""
echo "🔍 Remaining v2 references (excluding test/migration files):"
grep -r "_v2" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=migrations --exclude-dir=scripts --exclude-dir=testing-scripts . | grep -v "test\|migration\|backup" | wc -l