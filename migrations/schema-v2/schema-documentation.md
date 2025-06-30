# Golf Parlay Picker - Database Schema v2 Documentation

## Overview

This document provides comprehensive documentation for the new database schema v2, designed to replace the fragmented tournament data structure with a clean, consistent format where all scores are stored as actual values (not relative to par).

## Design Principles

1. **Single Source of Truth**: Eliminate data duplication and inconsistencies
2. **Actual Scores Only**: Store round scores as actual values (68, 71) not relative to par (-2, +1)
3. **Referential Integrity**: Proper foreign key relationships with CASCADE DELETE
4. **Data Validation**: Comprehensive constraints to prevent invalid data
5. **Performance Optimized**: Strategic indexing for common query patterns

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  ┌─────────────────────┐              ┌─────────────────────┐                  │
│  │   tournaments_v2    │              │     players_v2      │                  │
│  │                     │              │                     │                  │
│  │ • event_id (PK)     │              │ • dg_id (PK)        │                  │
│  │ • event_name        │              │ • name              │                  │
│  │ • course_name       │              │ • country           │                  │
│  │ • course_par        │              │ • country_code      │                  │
│  │ • start_date        │              │ • created_at        │                  │
│  │ • end_date          │              │ • updated_at        │                  │
│  │ • tour              │              │                     │                  │
│  │ • status            │              └─────────────────────┘                  │
│  │ • created_at        │                         │                             │
│  │ • updated_at        │                         │                             │
│  └─────────────────────┘                         │                             │
│            │                                     │                             │
│            │                                     │                             │
│            ├─────────────────────────────────────┼─────────────────────────────┤
│            │                                     │                             │
│            ▼                                     ▼                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┤
│  │                    player_round_scores_v2                                   │
│  │                                                                             │
│  │ • id (PK)                                                                   │
│  │ • event_id (FK → tournaments_v2.event_id)                                  │
│  │ • dg_id (FK → players_v2.dg_id)                                            │
│  │ • player_name                                                              │
│  │ • round_number (1-4)                                                       │
│  │ • round_score (actual score: 68, 71, not relative to par)                 │
│  │ • position                                                                 │
│  │ • holes_completed                                                          │
│  │ • made_cut                                                                 │
│  │ • tee_time                                                                 │
│  │ • created_at, updated_at                                                   │
│  │                                                                             │
│  │ UNIQUE(event_id, dg_id, round_number) -- Prevent duplicate round entries   │
│  └─────────────────────────────────────────────────────────────────────────────┤
│            │                                     │                             │
│            │                                     │                             │
│            ├─────────────────────────────────────┤                             │
│            │                                     │                             │
│            ▼                                     ▼                             │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────────┐ │
│  │      tournament_results_v2      │   │    player_advanced_stats_v2         │ │
│  │                                 │   │                                     │ │
│  │ • id (PK)                       │   │ • id (PK)                           │ │
│  │ • event_id (FK)                 │   │ • event_id (FK)                     │ │
│  │ • dg_id (FK)                    │   │ • dg_id (FK)                        │ │
│  │ • player_name                   │   │ • round_number                      │ │
│  │ • final_position                │   │ • sg_total, sg_ott, sg_app          │ │
│  │ • total_score                   │   │ • sg_arg, sg_putt, sg_t2g           │ │
│  │ • rounds_completed              │   │ • accuracy, distance, gir           │ │
│  │ • made_cut                      │   │ • prox_fw, scrambling               │ │
│  │ • round_1_score, round_2_score  │   │ • created_at, updated_at            │ │
│  │ • round_3_score, round_4_score  │   │                                     │ │
│  │ • scoring_average               │   │ UNIQUE(event_id, dg_id,             │ │
│  │ • relative_to_par               │   │        round_number)                │ │
│  │ • calculated_at, updated_at     │   │                                     │ │
│  │                                 │   └─────────────────────────────────────┘ │
│  │ UNIQUE(event_id, dg_id)         │                                           │
│  └─────────────────────────────────┘                                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Table Definitions

### 1. tournaments_v2
**Purpose**: Master tournament registry with course information

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| event_id | INTEGER | PRIMARY KEY | Unique tournament identifier from DataGolf API |
| event_name | TEXT | NOT NULL | Tournament name |
| course_name | TEXT | | Golf course name |
| course_par | INTEGER | DEFAULT 72, CHECK (68-74) | Course par value |
| start_date | DATE | | Tournament start date |
| end_date | DATE | | Tournament end date |
| tour | TEXT | CHECK (pga, euro, dp_world, korn_ferry, liv) | Tour identifier |
| status | TEXT | DEFAULT 'upcoming', CHECK status values | Tournament status |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update time |

### 2. players_v2
**Purpose**: Clean player registry with DataGolf ID as primary key

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| dg_id | BIGINT | PRIMARY KEY | DataGolf unique player identifier |
| name | TEXT | NOT NULL, non-empty | Player full name |
| country | TEXT | | Player country of origin |
| country_code | TEXT | LENGTH = 2, UPPERCASE | Two-letter ISO country code |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update time |

### 3. player_round_scores_v2
**Purpose**: Single source of truth for round-by-round scoring data

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Unique record identifier |
| event_id | INTEGER | NOT NULL, FK → tournaments_v2 | Tournament reference |
| dg_id | BIGINT | NOT NULL, FK → players_v2 | Player reference |
| player_name | TEXT | NOT NULL | Player name for redundancy |
| round_number | INTEGER | NOT NULL, CHECK (1-4) | Round number (1-4) |
| round_score | INTEGER | CHECK (55-100) | **Actual round score (68, 71) NOT relative to par** |
| position | INTEGER | CHECK (> 0) | Player position after round |
| holes_completed | INTEGER | DEFAULT 0, CHECK (0-18) | Holes completed in round |
| made_cut | BOOLEAN | | Whether player made the cut |
| tee_time | TIMESTAMP WITH TIME ZONE | | Tee time for the round |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update time |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation time |

**Key Constraint**: `UNIQUE(event_id, dg_id, round_number)` - Prevents duplicate round entries

### 4. tournament_results_v2
**Purpose**: Derived/calculated tournament results (computed from round scores)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Unique record identifier |
| event_id | INTEGER | NOT NULL, FK → tournaments_v2 | Tournament reference |
| dg_id | BIGINT | NOT NULL, FK → players_v2 | Player reference |
| player_name | TEXT | NOT NULL | Player name for redundancy |
| final_position | INTEGER | CHECK (> 0) | Final tournament position |
| total_score | INTEGER | | Sum of all round scores |
| rounds_completed | INTEGER | DEFAULT 0, CHECK (0-4) | Number of rounds completed |
| made_cut | BOOLEAN | DEFAULT FALSE | Whether player made the cut |
| round_1_score | INTEGER | | Individual round score for easy access |
| round_2_score | INTEGER | | Individual round score for easy access |
| round_3_score | INTEGER | | Individual round score for easy access |
| round_4_score | INTEGER | | Individual round score for easy access |
| scoring_average | DECIMAL(5,2) | CHECK (55-100) | Total score / rounds completed |
| relative_to_par | INTEGER | | Total strokes relative to course par |
| calculated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | When results were calculated |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update time |

**Key Constraint**: `UNIQUE(event_id, dg_id)` - One result per player per tournament

### 5. player_advanced_stats_v2
**Purpose**: Advanced statistics separate from core scoring data

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Unique record identifier |
| event_id | INTEGER | NOT NULL, FK → tournaments_v2 | Tournament reference |
| dg_id | BIGINT | NOT NULL, FK → players_v2 | Player reference |
| round_number | INTEGER | CHECK (1-4) | Round number for stats |
| sg_total | DECIMAL(6,3) | CHECK (-15 to 15) | Total strokes gained vs field |
| sg_ott | DECIMAL(6,3) | CHECK (-8 to 8) | Strokes gained off the tee |
| sg_app | DECIMAL(6,3) | CHECK (-8 to 8) | Strokes gained approach |
| sg_arg | DECIMAL(6,3) | CHECK (-8 to 8) | Strokes gained around green |
| sg_putt | DECIMAL(6,3) | CHECK (-8 to 8) | Strokes gained putting |
| sg_t2g | DECIMAL(6,3) | CHECK (-12 to 12) | Strokes gained tee to green |
| accuracy | DECIMAL(5,2) | CHECK (0-100) | Driving accuracy percentage |
| distance | DECIMAL(6,1) | CHECK (200-400) | Driving distance in yards |
| gir | DECIMAL(5,2) | CHECK (0-100) | Greens in regulation percentage |
| prox_fw | DECIMAL(6,1) | | Proximity to hole from fairway (feet) |
| scrambling | DECIMAL(5,2) | CHECK (0-100) | Scrambling percentage |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update time |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation time |

**Key Constraint**: `UNIQUE(event_id, dg_id, round_number)` - Prevents duplicate stat entries

## Data Flow and Relationships

### Foreign Key Relationships
1. **player_round_scores_v2**:
   - `event_id` → `tournaments_v2.event_id` (CASCADE DELETE)
   - `dg_id` → `players_v2.dg_id` (CASCADE DELETE)

2. **tournament_results_v2**:
   - `event_id` → `tournaments_v2.event_id` (CASCADE DELETE)  
   - `dg_id` → `players_v2.dg_id` (CASCADE DELETE)

3. **player_advanced_stats_v2**:
   - `event_id` → `tournaments_v2.event_id` (CASCADE DELETE)
   - `dg_id` → `players_v2.dg_id` (CASCADE DELETE)

### Data Flow
1. **Primary Data Entry**: `player_round_scores_v2` is the single source of truth
2. **Derived Calculations**: `tournament_results_v2` is computed from round scores
3. **Advanced Metrics**: `player_advanced_stats_v2` stores supplementary statistics

## Key Features

### 1. Data Integrity
- Comprehensive CHECK constraints for reasonable golf values
- Foreign key constraints with CASCADE DELETE
- UNIQUE constraints to prevent data duplication
- Non-null constraints on critical fields

### 2. Performance Optimization
- 32 strategic indexes for common query patterns
- Composite indexes for multi-column queries
- Foreign key columns are indexed for efficient JOINs

### 3. Automatic Maintenance
- Triggers for automatic `updated_at` timestamp updates
- Migration tracking with `schema_migrations` table
- Comprehensive logging and error handling

### 4. Validation Rules
- **Scoring**: Round scores between 55-100 (reasonable for professional golf)
- **Strokes Gained**: Values within realistic ranges for professional play
- **Country Codes**: Must be uppercase two-letter ISO codes
- **Tournament Dates**: Logical constraints on start/end dates
- **Player Names**: Cannot be empty or whitespace-only

## Migration Strategy

### Phase 1: Schema Creation ✅
- [x] Create all v2 tables with constraints and indexes
- [x] Set up triggers and validation rules
- [x] Create migration tracking system

### Phase 2: Data Migration (Next)
- [ ] Extract data from existing fragmented tables
- [ ] Transform and validate data for new schema
- [ ] Load data into v2 tables with integrity checks

### Phase 3: Application Updates (Next)
- [ ] Update API routes to use new tables
- [ ] Modify data access layer
- [ ] Update trend calculation services

### Phase 4: Testing and Cleanup (Next)
- [ ] Comprehensive testing of new schema
- [ ] Performance validation
- [ ] Remove old tables after verification

## Common Query Patterns

The new schema is optimized for these common application queries:

1. **Tournament Leaderboards**: Fast access via `tournament_results_v2` with position indexing
2. **Player Performance History**: Efficient player-based queries across tournaments
3. **Round-by-Round Analysis**: Direct access to individual round data
4. **Scoring Average Calculations**: Pre-calculated in `tournament_results_v2`
5. **Strokes Gained Analysis**: Dedicated table with performance indexes

## Benefits Over Previous Schema

1. **Eliminated Data Duplication**: Single source of truth for round scores
2. **Consistent Score Format**: All scores stored as actual values (68, 71)
3. **Proper Relationships**: Clean foreign key structure
4. **Performance Improvements**: Strategic indexing reduces query time
5. **Data Validation**: Comprehensive constraints prevent invalid data
6. **Scalability**: Design supports future growth and additional statistics

## Next Steps

1. **Complete Data Migration**: Move existing data to new schema
2. **Update Application Code**: Modify services to use new tables
3. **Performance Testing**: Validate query performance improvements
4. **Monitoring Setup**: Track database performance and integrity