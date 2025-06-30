# Database Schema Migration PRD

## Project Overview
Complete database schema redesign and migration for the golf parlay picker application to eliminate data inconsistencies, redundancies, and mixed data formats that are causing scoring average calculation errors and other analytical issues.

## Problem Statement
Current database has critical issues:
- Mixed score formats in live_tournament_stats (912 actual scores vs 1,516 relative scores)
- Broken round_scores arrays in tournament_results (all storing [total, 0, 0, 0] instead of individual rounds)
- Data fragmentation across multiple overlapping tables
- Inconsistent player and event data across tables
- No single source of truth for round-by-round scoring

## Success Criteria
1. **Single Source of Truth**: Each data type has one authoritative table
2. **Consistent Score Format**: All scores stored as actual values (68, 71, etc.) not relative to par
3. **Accurate Trend Calculations**: Scoring averages display correctly (e.g., 70.5 not 3.0)
4. **Clean Data Relationships**: Proper foreign keys and constraints
5. **API-First Design**: Schema structure matches DataGolf API format
6. **Zero Data Loss**: All existing betting/parlay data preserved during migration

## Core Requirements

### 1. Schema Design
- Design clean tournament data tables with proper relationships
- Create unified player round scoring table as single source of truth
- Establish derived results tables with calculated fields
- Maintain separate advanced stats tables
- Preserve existing clean betting/parlay tables
- Create optimized views for common queries

### 2. Data Migration Strategy
- Extract and validate existing data
- Convert relative scores to actual scores using course par information
- Migrate clean data to new schema
- Preserve all parlay and betting history
- Create data validation scripts

### 3. Application Updates
- Update API routes to use new schema
- Modify trend calculation service to use actual scores
- Update scoring average calculations
- Adjust settlement service data queries
- Update all database queries in components

### 4. Testing & Validation
- Create comprehensive test data
- Validate scoring average calculations
- Test trend analysis functionality
- Verify parlay settlement still works correctly
- Performance testing for new schema

## Technical Specifications

### New Schema Structure

#### Core Tournament Tables
```sql
tournaments (
  event_id INTEGER PRIMARY KEY,
  event_name TEXT NOT NULL,
  course_name TEXT,
  course_par INTEGER DEFAULT 72,
  start_date DATE,
  end_date DATE,
  tour TEXT,
  status TEXT DEFAULT 'upcoming',
  created_at TIMESTAMP DEFAULT NOW()
);

player_round_scores (
  id BIGSERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES tournaments(event_id),
  dg_id BIGINT NOT NULL,
  player_name TEXT NOT NULL,
  round_number INTEGER CHECK (round_number BETWEEN 1 AND 4),
  round_score INTEGER, -- Actual score: 68, 71, etc.
  position INTEGER,
  holes_completed INTEGER DEFAULT 0,
  made_cut BOOLEAN,
  tee_time TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(event_id, dg_id, round_number)
);

tournament_results (
  id BIGSERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES tournaments(event_id),
  dg_id BIGINT NOT NULL,
  player_name TEXT NOT NULL,
  final_position INTEGER,
  total_score INTEGER,
  rounds_completed INTEGER,
  made_cut BOOLEAN,
  round_1_score INTEGER,
  round_2_score INTEGER,
  round_3_score INTEGER,
  round_4_score INTEGER,
  scoring_average DECIMAL(4,2),
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(event_id, dg_id)
);
```

#### Player and Stats Tables
```sql
players (
  dg_id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  country_code TEXT(3),
  created_at TIMESTAMP DEFAULT NOW()
);

player_advanced_stats (
  id BIGSERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES tournaments(event_id),
  dg_id BIGINT REFERENCES players(dg_id),
  round_number INTEGER,
  sg_total DECIMAL(4,2),
  sg_ott DECIMAL(4,2),
  sg_app DECIMAL(4,2),
  sg_arg DECIMAL(4,2),
  sg_putt DECIMAL(4,2),
  sg_t2g DECIMAL(4,2),
  accuracy DECIMAL(4,1),
  distance DECIMAL(5,1),
  gir DECIMAL(4,1),
  scrambling DECIMAL(4,1),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(event_id, dg_id, round_number)
);
```

### Migration Phases
1. **Schema Creation**: Create new tables with constraints and indexes
2. **Data Extraction**: Extract clean data from existing tables
3. **Score Conversion**: Convert relative scores using course par data
4. **Data Population**: Migrate validated data to new schema
5. **Application Update**: Update all API routes and services
6. **Testing**: Comprehensive testing of all functionality
7. **Cleanup**: Remove old tables and update views
8. **Performance Optimization**: Add indexes and optimize queries

## Acceptance Criteria
- [ ] New schema created with proper constraints
- [ ] All existing tournament data migrated accurately
- [ ] Round scores stored as actual values (68, 71, etc.)
- [ ] Scoring averages calculate correctly in trends page
- [ ] Parlay settlement functionality preserved
- [ ] All API routes updated to use new schema
- [ ] Comprehensive test coverage
- [ ] Performance benchmarks maintained or improved
- [ ] Data validation scripts confirm accuracy
- [ ] Old tables safely removed

## Risk Mitigation
- Full database backup before migration
- Staged migration with rollback capability
- Comprehensive testing in development environment
- Data validation at each migration step
- Preserve all betting/parlay data integrity
- Performance monitoring during migration

## Timeline
Estimated 3-5 days for complete migration including testing and validation.