# Database Schema Audit Report
*Generated: July 23, 2025*

## Executive Summary

Your current database has **23 tables** (22 base tables + 1 view) with a total size of **~58 MB**. The data is fragmented across multiple schemas with some good foundational elements but lacks the AI-optimized structure needed for sophisticated parlay analytics.

## Table Inventory by Size & Importance

### 🔥 High-Value Data (Worth Preserving)

#### 1. `tournament_round_snapshots` (37 MB, 116k records)
- **Purpose**: Historical tournament leaderboard snapshots for ML analysis
- **Key Data**: Player positions, scores, strokes gained stats by round
- **AI Value**: ⭐⭐⭐⭐⭐ Perfect for time-series ML models
- **Migration**: **PRESERVE** - Core foundation for new schema

#### 2. `matchups_v2` (3.8 MB, 10k records) 
- **Purpose**: Head-to-head betting matchups with odds
- **Key Data**: Player matchups, betting odds, results
- **AI Value**: ⭐⭐⭐⭐⭐ Essential for parlay correlation analysis
- **Migration**: **PRESERVE & ENHANCE** - Core betting data

#### 3. `tournament_results_v2` (392 KB, 778 records)
- **Purpose**: Final tournament results
- **Key Data**: Final positions, scores, round-by-round data
- **AI Value**: ⭐⭐⭐⭐ Good for outcome prediction
- **Migration**: **PRESERVE** - Merge with tournament_round_snapshots

#### 4. `players_v2` (240 KB, 605 records)
- **Purpose**: Master player registry
- **Key Data**: Player names, DataGolf IDs, countries
- **AI Value**: ⭐⭐⭐⭐ Core reference data
- **Migration**: **PRESERVE & ENHANCE** - Add player attributes

#### 5. `tournaments_v2` (128 KB, 81 records)
- **Purpose**: Tournament metadata
- **Key Data**: Tournament names, dates, courses, status
- **AI Value**: ⭐⭐⭐⭐ Core reference data
- **Migration**: **PRESERVE & ENHANCE** - Add course details

### 📊 Medium-Value Data (Transform & Merge)

#### 6. `player_round_changes` (9.8 MB, 56k records)
- **Purpose**: Position changes between rounds
- **AI Value**: ⭐⭐⭐ Good for momentum analysis
- **Migration**: **MERGE** into round snapshots as calculated fields

#### 7. `live_tournament_stats` (2.3 MB, 604 records)
- **Purpose**: Real-time tournament statistics
- **AI Value**: ⭐⭐⭐⭐ Good for live analytics
- **Migration**: **MERGE** with tournament_round_snapshots

#### 8. `courses_v2` (248 KB)
- **Purpose**: Course information
- **AI Value**: ⭐⭐⭐ Important for course fit analysis
- **Migration**: **ENHANCE** - Add detailed course characteristics

### 🗑️ Low-Value Data (Consider Dropping)

- `settlement_history` (3.5 MB) - Betting settlement data (low AI value)
- `tournament_momentum_summary` (536 KB) - Can be recalculated
- `player_trends` (160 KB) - Can be recalculated from snapshots
- `bet_snapshots` (24 KB) - Minimal data

## Current Architecture Issues

### ❌ Problems Identified

1. **Data Fragmentation**: Tournament data split across 4+ tables
2. **Missing Correlations**: No player correlation analysis
3. **No ML Features**: No pre-computed features for AI models
4. **Limited Betting Data**: Only basic matchup odds, no market analysis
5. **No Time-Series Optimization**: Not optimized for historical analysis
6. **Duplicate Data**: Player names stored redundantly across tables
7. **Missing Relationships**: Some tables lack proper foreign keys

### ✅ Strengths to Build On

1. **Good Core Data**: Solid tournament and player data foundation
2. **Historical Depth**: 116k+ tournament snapshots for ML training
3. **Proper Normalization**: v2 tables show good design principles
4. **Foreign Key Relationships**: Most critical relationships exist
5. **DataGolf Integration**: Consistent use of DataGolf IDs

## Schema Relationships Map

```
tournaments_v2 (81 records)
    ├── tournament_results_v2 (778 records) [event_id FK]
    ├── tournament_round_snapshots (116k records) [event_id implied]
    ├── matchups_v2 (10k records) [event_id FK]
    └── player_advanced_stats_v2 [event_id FK]

players_v2 (605 records) [dg_id PK]
    ├── matchups_v2 [player1_dg_id, player2_dg_id, player3_dg_id FK]
    └── player_advanced_stats_v2 [dg_id FK]

courses_v2
    └── hole_statistics [course_id FK]

parlays_v2 (21 records)
    └── parlay_picks_v2 (205 records) [parlay_id FK]
        └── matchups_v2 [matchup_id FK]
```

## Data Quality Assessment

### Tournament Data Quality: ⭐⭐⭐⭐ (Good)
- Complete DataGolf IDs for player tracking
- Consistent tournament naming
- Proper date handling
- Good strokes gained data coverage

### Player Data Quality: ⭐⭐⭐ (Fair)
- Missing player attributes (age, height, experience)
- Limited biographical data
- Some inconsistent naming

### Betting Data Quality: ⭐⭐ (Needs Work)  
- Basic odds data only
- No line movement tracking
- No sportsbook comparison
- Limited market types

## Migration Strategy Recommendations

### Phase 1: Core Data Consolidation
1. **Merge tournament tables** into unified time-series structure
2. **Enhance player profiles** with additional attributes
3. **Create unified scoring history** table

### Phase 2: AI Optimization
1. **Add correlation analysis** tables
2. **Create ML feature** storage
3. **Implement edge detection** system

### Phase 3: Betting Enhancement
1. **Expand odds tracking** with multiple sportsbooks
2. **Add market analysis** capabilities
3. **Implement parlay optimization** engine

## Estimated Migration Effort

- **Data Preservation**: 85% of current data is valuable
- **Schema Changes**: Major restructuring needed
- **Downtime**: ~2-4 hours for migration
- **Risk Level**: Medium (good backup/rollback plan essential)

## Next Steps

1. ✅ **Complete this audit** (current step)
2. 🔄 **Design new AI-optimized schema**
3. 🔄 **Create data mapping & transformation rules**  
4. 🔄 **Build migration scripts with validation**
5. 🔄 **Test migration in staging environment**
6. 🔄 **Execute production migration**

---

**Bottom Line**: You have a solid foundation with valuable tournament and betting data. The migration will consolidate fragmented data into an AI-optimized structure while preserving 85% of existing data value.