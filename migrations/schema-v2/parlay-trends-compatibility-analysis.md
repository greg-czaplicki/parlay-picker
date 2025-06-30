# Parlay and Trends Tables - v2 Schema Compatibility Analysis

## Overview

This document provides a comprehensive analysis of the changes required to make parlay and trends tables compatible with the new v2 schema, ensuring the core parlay functionality continues to work seamlessly.

## Current State Analysis

### Parlay Tables

#### 1. `parlays` table
- **Status**: ✅ **No changes required**
- **Reason**: This table is self-contained with no direct references to tournament/player data
- **Dependencies**: Only references `users` table which is unchanged

#### 2. `parlay_picks` table
- **Status**: 🔄 **Requires Updates**
- **Critical Issues**:
  - `picked_player_dg_id INTEGER` → needs to be `BIGINT` to match `players_v2.dg_id`
  - FK constraint points to old `players` table → needs to point to `players_v2`
  - `event_id INTEGER` stored but not FK constrained → should reference `tournaments_v2`

### Trends Tables

#### 1. `player_trends` table
- **Status**: 🔄 **Requires Updates**
- **Issues**:
  - `dg_id INTEGER` → needs to be `BIGINT` for v2 compatibility
  - No FK constraints (flexible design) → keep flexible but ensure type compatibility

#### 2. `player_tournament_trends` table
- **Status**: 🔄 **Requires Updates**
- **Issues**:
  - No primary key → should add for better data management
  - `dg_id INTEGER` → needs to be `BIGINT` for v2 compatibility
  - Uses `event_name` for tournament reference → should add `event_id` for direct FK to `tournaments_v2`

#### 3. `scoring_trends` table
- **Status**: 🔄 **Requires Updates**
- **Issues**:
  - No primary key → should add for better data management
  - `dg_id INTEGER` → needs to be `BIGINT` for v2 compatibility

## Migration Strategy

### Phase 1: Data Type Alignment ✅

#### Update `parlay_picks`
```sql
-- Drop old FK constraint
ALTER TABLE parlay_picks DROP CONSTRAINT parlay_picks_picked_player_dg_id_fkey;

-- Update data type
ALTER TABLE parlay_picks ALTER COLUMN picked_player_dg_id TYPE BIGINT;

-- Add v2 FK constraints
ALTER TABLE parlay_picks 
ADD CONSTRAINT fk_parlay_picks_picked_player_dg_id_v2 
FOREIGN KEY (picked_player_dg_id) REFERENCES players_v2(dg_id) ON DELETE SET NULL;

ALTER TABLE parlay_picks 
ADD CONSTRAINT fk_parlay_picks_event_id_v2 
FOREIGN KEY (event_id) REFERENCES tournaments_v2(event_id) ON DELETE SET NULL;
```

#### Update Trends Tables
```sql
-- Add primary keys where missing
ALTER TABLE player_tournament_trends ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE scoring_trends ADD COLUMN id BIGSERIAL PRIMARY KEY;

-- Update data types to BIGINT
ALTER TABLE player_trends ALTER COLUMN dg_id TYPE BIGINT;
ALTER TABLE player_tournament_trends ALTER COLUMN dg_id TYPE BIGINT;
ALTER TABLE scoring_trends ALTER COLUMN dg_id TYPE BIGINT;

-- Add event_id for direct tournament reference
ALTER TABLE player_tournament_trends ADD COLUMN event_id INTEGER;
```

### Phase 2: Backward Compatibility ✅

#### Compatibility Views
```sql
-- Create views for seamless transition
CREATE VIEW players AS SELECT * FROM players_v2;
CREATE VIEW tournaments AS SELECT * FROM tournaments_v2;
```

This allows existing application code to continue working during the transition period.

### Phase 3: Performance Optimization ✅

#### Strategic Indexes
```sql
-- Parlay performance indexes
CREATE INDEX idx_parlay_picks_picked_player_dg_id_v2 ON parlay_picks(picked_player_dg_id);
CREATE INDEX idx_parlay_picks_event_id_v2 ON parlay_picks(event_id);
CREATE INDEX idx_parlay_picks_settlement_status_v2 ON parlay_picks(settlement_status);

-- Trends performance indexes
CREATE INDEX idx_player_trends_dg_id_v2 ON player_trends(dg_id);
CREATE INDEX idx_player_tournament_trends_dg_id_v2 ON player_tournament_trends(dg_id);
CREATE INDEX idx_scoring_trends_dg_id_v2 ON scoring_trends(dg_id);
```

### Phase 4: Data Validation ✅

#### Constraints for Data Integrity
```sql
-- Ensure positive dg_id values
ALTER TABLE player_trends ADD CONSTRAINT check_player_trends_dg_id_positive CHECK (dg_id > 0);

-- Ensure non-negative tournament counts
ALTER TABLE scoring_trends ADD CONSTRAINT check_scoring_trends_non_negative_counts 
CHECK (sub_70_avg_tournaments >= 0 AND total_tournaments >= 0);
```

## Impact Analysis

### ✅ **Low Risk Areas**
- **`parlays` table**: No changes needed
- **Trends tables**: No FK constraints to break, flexible design maintained
- **Backward compatibility**: Views provide seamless transition

### ⚠️ **Medium Risk Areas**
- **Data type conversions**: INTEGER → BIGINT is safe expansion
- **New FK constraints**: SET NULL behavior prevents cascade failures
- **Performance**: New indexes improve query performance

### 🚨 **High Risk Areas**
- **`parlay_picks` FK changes**: Critical for parlay functionality
- **Settlement service dependencies**: Must be tested thoroughly
- **Application code references**: Need coordinated updates

## Testing Strategy

### 1. Data Integrity Testing
```sql
-- Verify FK constraints work correctly
INSERT INTO parlay_picks (picked_player_dg_id) VALUES (999999999); -- Should fail if player doesn't exist
INSERT INTO parlay_picks (event_id) VALUES (999999); -- Should fail if tournament doesn't exist
```

### 2. Application Functionality Testing
- **Parlay Creation**: Test creating parlays with new schema
- **Settlement Processing**: Verify settlement service works with v2 schema
- **Trend Calculations**: Ensure trend calculations use updated tables correctly

### 3. Performance Testing
```sql
-- Test query performance with new indexes
EXPLAIN ANALYZE SELECT * FROM parlay_picks WHERE picked_player_dg_id = 10091;
EXPLAIN ANALYZE SELECT * FROM player_trends WHERE dg_id = 10091;
```

## Application Code Impact

### Files Requiring Updates

Based on codebase analysis, these areas need attention:

#### 1. Settlement Service
- **File**: `/lib/services/settlement-service.ts`
- **Changes**: Update to use `players_v2` and `tournaments_v2` table references
- **Risk**: High - core business logic

#### 2. Parlay API Routes
- **File**: `/app/api/parlays/route.ts`
- **Changes**: Ensure compatibility with new FK constraints
- **Risk**: Medium - user-facing functionality

#### 3. Trends Calculation
- **File**: `/app/api/trends/categories/route.ts`
- **Changes**: Update to use new table structure and data types
- **Risk**: Medium - affects trend display

#### 4. Data Access Layer
- **Files**: Any TypeScript interfaces or types
- **Changes**: Update `dg_id` type from `number` to `bigint` where applicable
- **Risk**: Low - TypeScript will catch type mismatches

## Rollback Strategy

### Automatic Rollback
- Complete rollback script available: `004_update_parlay_trends_compatibility_rollback.sql`
- Reverts all data type changes and FK constraints
- Removes added columns and indexes
- Restores original table structure

### Manual Intervention Required
If rollback is executed:
1. **Restore original FK constraints** to old `players` table (if it still exists)
2. **Update application code** to use old table references
3. **Verify parlay functionality** works with reverted schema

## Benefits of v2 Compatibility

### 1. Data Consistency
- **Before**: Mixed INTEGER/BIGINT types across related tables
- **After**: Consistent BIGINT for all player references

### 2. Referential Integrity
- **Before**: `parlay_picks` had no FK constraint to tournaments
- **After**: Proper FK relationships prevent orphaned records

### 3. Performance Improvements
- **Before**: Missing indexes on key lookup columns
- **After**: Strategic indexes for common query patterns

### 4. Future-Proofing
- **Before**: Tables incompatible with v2 schema
- **After**: Full compatibility with clean v2 architecture

## Next Steps

1. **Execute Migration**: Apply `004_update_parlay_trends_compatibility.sql`
2. **Update Application Code**: Modify services to use v2 table names
3. **Test Functionality**: Comprehensive testing of parlay and trends features
4. **Monitor Performance**: Verify query performance improvements
5. **Remove Compatibility Views**: After application code is updated

## Success Criteria

✅ **Database Level**
- All FK constraints properly reference v2 tables
- Data types consistent across related tables
- Performance indexes provide query optimization

✅ **Application Level**
- Parlay creation and settlement work correctly
- Trend calculations produce accurate results
- No functionality regressions

✅ **Data Level**
- No data loss during migration
- All existing parlays and trends preserved
- Referential integrity maintained

This compatibility update ensures the parlay system continues to function seamlessly while leveraging the benefits of the new v2 schema architecture.