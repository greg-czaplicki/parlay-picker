# Database Schema v2 Migration - Complete Documentation

## Overview

This directory contains the complete database schema v2 migration for the Golf Parlay Picker application. The new schema addresses critical data consistency issues and provides a clean foundation for golf tournament data management.

## Problem Statement

The original schema had several critical issues:
- **Mixed score formats**: Some scores stored as actual values (71, 68), others as relative to par (-2, +1)
- **Fragmented data**: Tournament results scattered across multiple overlapping tables
- **Data inconsistencies**: Broken round_scores arrays storing [total, 0, 0, 0] instead of individual rounds
- **Performance issues**: Missing strategic indexes for common query patterns
- **Trending calculation errors**: Scoring average showing "3.0 avg" instead of proper values like "70.5"

## Solution: Clean Schema v2

### Core Principles
1. **Single Source of Truth**: `player_round_scores_v2` as authoritative scoring data
2. **Actual Scores Only**: Store round scores as 68, 71 (not -2, +1 relative to par)
3. **Referential Integrity**: Proper foreign keys with CASCADE DELETE
4. **Performance Optimized**: 32 strategic indexes for common queries
5. **Data Validation**: Comprehensive constraints preventing invalid data

## Migration Files

### Core Migration Scripts
- **`V001__create_new_schema_complete.sql`** - Complete unified migration script
- **`V001__create_new_schema_complete_rollback.sql`** - Safe rollback script
- **`migrate.sh`** - Migration runner with apply/rollback/status commands

### Individual Component Scripts (for reference)
- **`001_create_core_tournament_tables.sql`** - Core tournament and scoring tables
- **`002_create_player_and_stats_tables.sql`** - Player registry and advanced stats
- **`003_index_documentation.md`** - Detailed index strategy documentation

### Documentation
- **`schema-documentation.md`** - Comprehensive schema reference
- **`ERD.md`** - Visual Entity Relationship Diagram
- **`README.md`** - This overview document

## Database Schema v2 Tables

### 1. Master Tables
- **`tournaments_v2`** - Tournament registry with course information
- **`players_v2`** - Clean player registry with DataGolf IDs

### 2. Core Data Table  
- **`player_round_scores_v2`** - **Single source of truth for all round scoring**
  - Stores actual round scores (68, 71) NOT relative to par
  - Unique constraint: (event_id, dg_id, round_number)

### 3. Derived Tables
- **`tournament_results_v2`** - Calculated tournament results and leaderboards
- **`player_advanced_stats_v2`** - Strokes Gained and advanced metrics

## Key Features

### Data Integrity
- ✅ Actual round scores only (68, 71) - no more relative to par confusion
- ✅ Foreign key constraints with CASCADE DELETE
- ✅ Comprehensive CHECK constraints for reasonable golf values
- ✅ UNIQUE constraints preventing data duplication

### Performance
- ✅ 32 strategic indexes for common query patterns
- ✅ Optimized for tournament leaderboards, player history, and trend analysis
- ✅ Composite indexes for multi-table JOINs

### Maintainability
- ✅ Automatic timestamp updates via triggers
- ✅ Migration tracking with versioned scripts
- ✅ Comprehensive documentation and ERD

## Usage Instructions

### 1. Apply Migration

```bash
# Check current migration status
cd migrations/schema-v2
./migrate.sh status

# Apply the new schema (creates v2 tables)
./migrate.sh apply local

# Verify migration completed successfully
./migrate.sh status
```

### 2. Rollback Migration (if needed)

```bash
# WARNING: This permanently deletes all v2 schema data
./migrate.sh rollback local
```

### 3. Check Migration Status

```bash
# View current migration state and v2 table count
./migrate.sh status
```

## Migration Phases

### ✅ Phase 1: Schema Creation (COMPLETED)
- [x] Created all v2 tables with proper constraints
- [x] Applied 32 performance indexes  
- [x] Set up triggers and validation rules
- [x] Created migration tracking system
- [x] Documented schema with ERD

### 🔄 Phase 2: Data Migration (NEXT)
- [ ] Extract data from existing fragmented tables
- [ ] Transform scores to consistent actual format
- [ ] Validate and load into v2 schema
- [ ] Verify data integrity and completeness

### 🔄 Phase 3: Application Updates (NEXT)  
- [ ] Update API routes to use v2 tables
- [ ] Modify data access layer and services
- [ ] Fix trend calculation service (scoring average issue)
- [ ] Update settlement and parlay processing

### 🔄 Phase 4: Testing and Cleanup (NEXT)
- [ ] Comprehensive testing of new schema
- [ ] Performance validation and optimization
- [ ] Remove old tables after verification
- [ ] Update documentation

## Expected Benefits

### 1. Data Consistency
- **Before**: Mixed formats, broken round arrays, data scattered across tables
- **After**: Single source of truth with actual scores only

### 2. Performance Improvements
- **Before**: Slow queries due to missing indexes and table fragmentation
- **After**: Optimized with 32 strategic indexes for common patterns

### 3. Trend Calculations
- **Before**: Scoring average showing "3.0 avg" due to incorrect calculations
- **After**: Proper scoring averages like "70.5" calculated from actual round scores

### 4. Maintainability
- **Before**: Complex data relationships difficult to understand and modify
- **After**: Clean schema with clear relationships and comprehensive documentation

## Important Notes

### Data Format Changes
- **OLD**: Mixed formats - some actual (71), some relative (-1)
- **NEW**: Actual scores ONLY (68, 71, 74) - relative to par calculated when needed

### Foreign Key Behavior
- All foreign keys use CASCADE DELETE for data consistency
- Deleting a tournament removes all associated scores and results
- Deleting a player removes all their historical data

### Index Strategy
- Indexes optimized for common application queries:
  - Tournament leaderboards
  - Player performance history  
  - Round-by-round analysis
  - Scoring average calculations
  - Strokes Gained analysis

## Next Steps

1. **Execute Data Migration** (Task 45)
   - Extract data from current tables
   - Transform to new format
   - Load and validate in v2 schema

2. **Update Application Code** (Task 47-48)
   - Modify API routes and services
   - Fix trend calculation logic
   - Update parlay processing

3. **Comprehensive Testing** (Task 50)
   - Validate data accuracy
   - Test application functionality
   - Performance benchmarking

4. **Schema Cleanup** (Task 51)
   - Remove old tables
   - Optimize performance
   - Final documentation updates

## Support

For questions or issues with the migration:
1. Review the comprehensive documentation in this directory
2. Check the ERD.md for visual schema representation
3. Examine migration logs for detailed status information
4. Use the rollback capability if issues are encountered

The new schema provides a solid foundation for accurate golf tournament data management and eliminates the data consistency issues that were causing incorrect trend calculations.