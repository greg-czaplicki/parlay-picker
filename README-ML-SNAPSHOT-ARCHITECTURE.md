# 🧠 Tournament Snapshot Architecture for ML & Trend Analysis

## 🎯 Overview

This architecture creates a **parallel snapshot system** that preserves historical tournament states for machine learning and trend analysis. Your current `live_tournament_stats` system continues working unchanged while we build rich historical data.

## 📋 What's Created

### 1. Database Tables

**`tournament_round_snapshots`** - Main historical data table
- Preserves complete leaderboard states at each round completion
- ML-optimized with denormalized player stats (position, scores, SG data)
- Position change tracking and momentum scores
- Unique constraints prevent duplicate snapshots

**`player_round_changes`** - Position movement tracking  
- Round-to-round position changes (T1 → T3 = dropped 2 spots)
- Score deltas and improvement streak indicators
- References to snapshot IDs for data lineage

**`tournament_momentum_summary`** - Aggregated ML features
- Per-player tournament summary statistics
- Trend indicators (improving/declining/steady)
- Quick access table for ML queries

### 2. Supporting Infrastructure

**Helper Functions:**
- `extract_position_numeric()` - Converts "T1", "CUT" to sortable numbers
- `calculate_momentum_score()` - Weighted position change indicator

**Performance Indexes:**
- Event/round/player lookups optimized for fast queries
- Composite indexes for common ML access patterns

**ML-Ready Views:**
- `latest_tournament_snapshots` - Most recent snapshot per player/round
- `player_tournament_trends` - Time-series data with rolling averages

### 3. TypeScript Service Layer

**`TournamentSnapshotService`** class provides:
- `createTournamentSnapshot()` - Capture current tournament state
- `getPositionChanges()` - Track player movement between rounds
- `getTournamentTrends()` - ML-ready trend analysis data

## 🚀 Quick Start

### Step 1: Run the Database Migration

```sql
-- Copy content from migrations/001_create_tournament_snapshot_tables.sql
-- Run in your Supabase SQL editor or via migration tool
```

### Step 2: Install the Service

```typescript
// Copy lib/services/tournament-snapshot-service.ts to your project
import { TournamentSnapshotService } from '@/lib/services/tournament-snapshot-service'

const snapshotService = new TournamentSnapshotService()
```

### Step 3: Start Capturing Snapshots

```typescript
// Integrate into your existing tournament sync process
await snapshotService.createTournamentSnapshot(
  eventId,      // e.g., 12345
  roundNumber,  // e.g., "2" 
  'live_update' // or 'round_end' for major milestones
)
```

## 📊 ML Features Enabled

### Position Tracking
```sql
-- See who moved up/down between rounds
SELECT player_name, position_change, improving 
FROM player_round_changes 
WHERE event_id = 12345 AND to_round = '2'
ORDER BY position_change ASC -- Biggest improvers first
```

### Momentum Analysis
```sql
-- Players with hottest momentum
SELECT player_name, momentum_score, position_trend
FROM tournament_momentum_summary 
WHERE event_id = 12345 
ORDER BY momentum_score DESC
```

### Historical Reconstruction
```sql
-- Exact leaderboard state after Round 1
SELECT player_name, position, total_score, round_score
FROM tournament_round_snapshots 
WHERE event_id = 12345 AND round_num = '1'
ORDER BY position_numeric
```

### ML Training Data
```sql
-- Rich feature set for predictive models
SELECT 
  dg_id,
  round_num,
  position_numeric,
  total_score,
  sg_total,
  momentum_score,
  position_change,
  -- Rolling averages
  sg_total_3round_avg,
  avg_last_2rounds
FROM player_tournament_trends 
WHERE event_name = 'U.S. Open'
```

## 🔄 Integration Strategy

### Phase 1: Parallel Collection (Current)
- ✅ Schema created
- ⏳ Snapshot service built
- ⏳ Integration with existing sync process
- **Zero disruption** to current system

### Phase 2: Enhanced Analytics (Next)
- Build trend analysis dashboards
- Create ML features from historical data  
- Add momentum indicators to UI

### Phase 3: Full ML Pipeline (Future)
- Cut line predictions
- Final position forecasting
- Head-to-head matchup predictions
- DFS optimal lineup suggestions

## 🎨 UI Features Coming

With this data foundation, you can build:

**Real-time Momentum Indicators:**
- 🔥 "Hot" players (improving position)
- 📉 "Struggling" players (losing ground)
- ⚡ "Streak" players (3+ rounds improving)

**Trend Visualizations:**
- Position change charts over tournament
- Round-by-round score progressions
- Pressure performance (early vs late rounds)

**Predictive Features:**
- "Most likely to move up" suggestions
- Cut line probability indicators
- Final leaderboard predictions

## 📁 Files to Create

1. **migrations/001_create_tournament_snapshot_tables.sql**
2. **lib/services/tournament-snapshot-service.ts**

Both files contain the complete implementation. Run the migration first, then integrate the service into your existing tournament sync workflow.

## 💡 Next Steps

1. **Run the migration** to create tables
2. **Test snapshot creation** with current U.S. Open data
3. **Integrate triggers** into your existing sync process  
4. **Start building ML features** with 2-3 tournaments of data

This gives you the foundation for advanced golf analytics while keeping your current system working perfectly! 🏌️‍♂️⚡ 