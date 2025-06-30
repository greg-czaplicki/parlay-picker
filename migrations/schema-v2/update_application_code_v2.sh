#!/bin/bash
# Update Application Code for v2 Schema Compatibility
# This script updates all table references in the application code

set -e  # Exit on any error

echo "========================================"
echo "Updating Application Code for v2 Schema"
echo "========================================"

# Function to update table references in a file
update_table_references() {
    local file="$1"
    local updated=false
    
    if [[ -f "$file" ]]; then
        echo "Processing: $file"
        
        # Update tournaments -> tournaments_v2
        if grep -q "\.from('tournaments')" "$file"; then
            sed -i "s/\.from('tournaments')/\.from('tournaments_v2')/g" "$file"
            echo "  ✓ Updated tournaments references"
            updated=true
        fi
        
        # Update players -> players_v2  
        if grep -q "\.from('players')" "$file"; then
            sed -i "s/\.from('players')/\.from('players_v2')/g" "$file"
            echo "  ✓ Updated players references"
            updated=true
        fi
        
        # Update tournament_results -> tournament_results_v2
        if grep -q "\.from('tournament_results')" "$file"; then
            sed -i "s/\.from('tournament_results')/\.from('tournament_results_v2')/g" "$file"
            echo "  ✓ Updated tournament_results references"
            updated=true
        fi
        
        if [[ "$updated" == false ]]; then
            echo "  - No updates needed"
        fi
    else
        echo "  ⚠️  File not found: $file"
    fi
}

echo "Updating service files..."

# Core service files
update_table_references "lib/services/sg-momentum-service.ts"
update_table_references "lib/services/tournament-name-resolver.ts"
update_table_references "lib/services/tournament-snapshot-service.ts"

echo ""
echo "Updating API routes..."

# API routes with tournaments references
update_table_references "app/api/parlays/route.ts"
update_table_references "app/api/settle-rounds/route.ts"
update_table_references "app/api/settle-status/route.ts"
update_table_references "app/api/live-stats/sync/route.ts"
update_table_references "app/api/schedule/route.ts"
update_table_references "app/api/player-stats/route.ts"
update_table_references "app/api/live-stats/sync-status/route.ts"
update_table_references "app/api/matchups/ingest/route.ts"
update_table_references "app/api/snapshots/route.ts"
update_table_references "app/api/live-stats/sync-tour/route.ts"
update_table_references "app/api/live-stats/auto-sync/route.ts"
update_table_references "app/api/settle/route.ts"
update_table_references "app/api/debug-player-stats/route.ts"
update_table_references "app/api/schedule/sync/route.ts"
update_table_references "app/api/debug-settlement/route.ts"
update_table_references "app/api/players/sync-skill-ratings/route.ts"

# API routes with tournament_results references
update_table_references "app/api/trends/route.ts"

# API routes with players references
update_table_references "app/api/admin/sync-players/route.ts"

echo ""
echo "Updating hooks..."

# Hook files
update_table_references "hooks/use-active-events-query.ts"
update_table_references "hooks/use-dashboard-debug-diagnostics.ts"
update_table_references "hooks/use-current-week-events-query.ts"

echo ""
echo "Updating other service files..."

# ML and other service files
update_table_references "lib/ml/feature-engineering.ts"

echo ""
echo "Updating script files..."

# Script files
update_table_references "scripts/validate-tournament-names.js"
update_table_references "scripts/test-tournament-resolver.js"
update_table_references "fix-opposite-field-matchups.js"

echo ""
echo "========================================"
echo "Application Code Update Complete!"
echo "========================================"

# Verify the changes
echo ""
echo "Verification - checking for remaining old table references..."

# Check for any remaining old references
remaining_tournaments=$(find . -name "*.ts" -o -name "*.js" | xargs grep -l "\.from('tournaments')" 2>/dev/null | wc -l)
remaining_players=$(find . -name "*.ts" -o -name "*.js" | xargs grep -l "\.from('players')" 2>/dev/null | wc -l)
remaining_results=$(find . -name "*.ts" -o -name "*.js" | xargs grep -l "\.from('tournament_results')" 2>/dev/null | wc -l)

echo "Remaining old table references:"
echo "  - tournaments: $remaining_tournaments files"
echo "  - players: $remaining_players files"  
echo "  - tournament_results: $remaining_results files"

if [[ $remaining_tournaments -eq 0 && $remaining_players -eq 0 && $remaining_results -eq 0 ]]; then
    echo ""
    echo "✅ SUCCESS: All table references have been updated to v2!"
else
    echo ""
    echo "⚠️  WARNING: Some old table references remain. Manual review needed."
    
    if [[ $remaining_tournaments -gt 0 ]]; then
        echo "Files still referencing 'tournaments':"
        find . -name "*.ts" -o -name "*.js" | xargs grep -l "\.from('tournaments')" 2>/dev/null || true
    fi
    
    if [[ $remaining_players -gt 0 ]]; then
        echo "Files still referencing 'players':"
        find . -name "*.ts" -o -name "*.js" | xargs grep -l "\.from('players')" 2>/dev/null || true
    fi
    
    if [[ $remaining_results -gt 0 ]]; then
        echo "Files still referencing 'tournament_results':"
        find . -name "*.ts" -o -name "*.js" | xargs grep -l "\.from('tournament_results')" 2>/dev/null || true
    fi
fi

echo ""
echo "Next steps:"
echo "1. Test the application with updated table references"
echo "2. Verify API routes work correctly"
echo "3. Check parlay creation and settlement functionality"
echo "4. Validate trend calculations"
echo "========================================"