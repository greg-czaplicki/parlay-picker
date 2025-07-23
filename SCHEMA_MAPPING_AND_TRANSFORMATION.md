# Schema Mapping and Transformation Rules
*Database Migration Field-by-Field Mapping*
*Generated: July 23, 2025*

## Overview

This document provides detailed field-by-field mapping between the current database schema and the new AI-optimized schema, including transformation rules, data enrichment requirements, and handling of legacy fields.

**Migration Strategy**: Due to critical data quality issues identified in the assessment, migration will proceed in **two phases**:
1. **Phase 1**: Data remediation and critical fixes (4-6 weeks)
2. **Phase 2**: Schema migration with transformation rules (2-3 weeks)

---

## Table Mapping Overview

### High-Value Data Preservation (85% retention target)

| Current Table | New Schema Table(s) | Preservation Rate | Complexity |
|---------------|-------------------|------------------|------------|
| `tournament_round_snapshots` | `tournament_rounds` | 95% | Medium |
| `matchups_v2` | `betting_markets`, `odds_history` | 92% | High |
| `tournament_results_v2` | `tournament_rounds` | 60%* | High |
| `players_v2` | `players` | 85%* | Medium |
| `tournaments_v2` | `tournaments` | 80%* | Medium |
| `courses_v2` | `courses` | 25%* | High |
| `live_tournament_stats` | `tournament_rounds` | 90% | Low |

*Requires data remediation before migration

---

## Detailed Field Mappings

### 1. Players Data Migration

#### Source: `players_v2` → Target: `players`

| Source Field | Target Field | Transformation Rule | Status | Notes |
|-------------|-------------|-------------------|--------|-------|
| `dg_id` | `dg_id` | Direct copy | ✅ Ready | Primary key preserved |
| `name` | `name` | Name standardization | ⚠️ Needs cleaning | Resolve variations |
| `country` | `country` | External data lookup | ❌ Missing | 100% NULL - requires enrichment |
| `country_code` | `country_code` | External data lookup | ❌ Missing | 100% NULL - requires enrichment |
| - | `pga_id` | External API lookup | 🆕 New | From PGA Tour API |
| - | `owgr_id` | External API lookup | 🆕 New | From OWGR data |
| - | `birth_date` | External data lookup | 🆕 New | For demographic analysis |
| - | `height_cm` | External data lookup | 🆕 New | Physical attributes |
| - | `weight_kg` | External data lookup | 🆕 New | Physical attributes |
| - | `turned_professional` | External data lookup | 🆕 New | Career timeline |
| - | `pga_tour_wins` | Calculate from results | 🆕 New | Derive from tournament data |
| - | `major_wins` | Calculate from results | 🆕 New | Derive from tournament data |
| - | `career_earnings` | External API lookup | 🆕 New | Financial performance |
| - | `playing_style` | AI analysis | 🆕 New | JSON object with style metrics |
| - | `physical_attributes` | External + calculated | 🆕 New | JSON with physical data |
| - | `mental_attributes` | Calculate from performance | 🆕 New | JSON with mental game metrics |
| - | `style_embedding` | AI model generation | 🆕 New | 128-dim vector for similarity |
| - | `performance_embedding` | AI model generation | 🆕 New | 128-dim vector for analysis |

**Transformation Scripts Required**:
```sql
-- Player name standardization
UPDATE players_staging SET name = TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g'));

-- Country data enrichment (external API integration needed)
UPDATE players_staging p SET 
    country = pd.country,
    country_code = pd.country_code
FROM player_demographics_external pd 
WHERE p.dg_id = pd.dg_id;

-- Career statistics calculation
UPDATE players_staging p SET 
    pga_tour_wins = (
        SELECT COUNT(*) FROM tournament_results_v2 tr 
        WHERE tr.player_dg_id = p.dg_id AND tr.final_position = 1
    ),
    major_wins = (
        SELECT COUNT(*) FROM tournament_results_v2 tr 
        JOIN tournaments_v2 t ON tr.event_id = t.event_id
        WHERE tr.player_dg_id = p.dg_id 
        AND tr.final_position = 1 
        AND t.tournament_type = 'major'
    );
```

### 2. Tournament Data Migration

#### Source: `tournaments_v2` → Target: `tournaments`

| Source Field | Target Field | Transformation Rule | Status | Notes |
|-------------|-------------|-------------------|--------|-------|
| `event_id` | `event_id` | Direct copy | ✅ Ready | Preserve for referential integrity |
| `event_name` | `name` | Direct copy with cleaning | ⚠️ Needs cleaning | Standardize tournament names |
| `course_name` | - | Map to course_id | ❌ Critical | 98.8% missing - requires reconstruction |
| `course_par` | - | Move to courses table | ⚠️ Available | Transfer during course rebuild |
| `start_date` | `start_date` | Direct copy | ✅ Ready | Date format consistent |
| `end_date` | `end_date` | Direct copy | ✅ Ready | Date format consistent |
| `tour` | `tour` | Value mapping | ⚠️ Needs mapping | Map to standardized values |
| `status` | `status` | Value mapping | ⚠️ Needs mapping | Map to new enum values |
| - | `course_id` | Course reconstruction | ❌ Critical | Must rebuild course associations |
| - | `purse` | External API lookup | 🆕 New | Prize money information |
| - | `fedex_cup_points` | External API lookup | 🆕 New | Points allocation |
| - | `world_ranking_points` | External API lookup | 🆕 New | OWGR points |
| - | `tournament_type` | Business rules | 🆕 New | Classify majors, WGC, etc. |
| - | `field_strength` | Calculate from participants | 🆕 New | Average world ranking |
| - | `cut_rule` | External data lookup | 🆕 New | Tournament-specific cut rules |
| - | `weather_conditions` | External API integration | 🆕 New | Weather during tournament |
| - | `course_setup` | External data lookup | 🆕 New | Pin positions, conditions |
| - | `field_quality_metrics` | Calculate from field | 🆕 New | Field analysis metrics |
| - | `tournament_embedding` | AI model generation | 🆕 New | 32-dim vector for similarity |

**Critical Transformation - Course Association Rebuild**:
```sql
-- Step 1: Reconstruct courses table from tournament venue data
INSERT INTO courses (name, location, city, state_province, country, par)
SELECT DISTINCT 
    course_name,
    'Unknown' as location, -- Requires external lookup
    'Unknown' as city,     -- Requires external lookup
    'Unknown' as state_province, -- Requires external lookup
    'USA' as country,      -- Default, requires validation
    course_par
FROM tournaments_v2 
WHERE course_name IS NOT NULL;

-- Step 2: Update tournament course associations
UPDATE tournaments t SET course_id = c.id
FROM courses c 
WHERE t.course_name = c.name;
```

### 3. Tournament Results Migration

#### Source: `tournament_results_v2` → Target: `tournament_rounds`

| Source Field | Target Field | Transformation Rule | Status | Notes |
|-------------|-------------|-------------------|--------|-------|
| `event_id` | `tournament_id` | FK mapping | ✅ Ready | Map to tournaments.id |
| `player_dg_id` | `player_id` | FK mapping | ✅ Ready | Map to players.id |
| `round1_score` | Multiple records | Create separate round records | ⚠️ Complex | One record per round |
| `round2_score` | Multiple records | Create separate round records | ⚠️ Complex | One record per round |
| `round3_score` | Multiple records | Create separate round records | ⚠️ Complex | One record per round |
| `round4_score` | Multiple records | Create separate round records | ⚠️ Complex | One record per round |
| `final_position` | `position` | Value cleaning | ❌ Critical | 96.8% missing - needs backfill |
| `total_score` | Calculate | Sum of round scores | ✅ Ready | Derive from round scores |
| - | `round_number` | Generate | 🆕 New | 1, 2, 3, 4 for each round |
| - | `round_date` | Calculate | 🆕 New | tournament_start + round_number |
| - | `strokes` | Parse from round scores | 🆕 New | Actual strokes for round |
| - | `score_to_par` | Calculate | 🆕 New | strokes - course_par |
| - | `position_numeric` | Parse position | ❌ Critical | Extract number from position |
| - | `holes_completed` | Default 18 | 🆕 New | Default to 18, handle WD/DQ |

**Complex Transformation - Round Denormalization**:
```sql
-- Transform single result record into multiple round records
INSERT INTO tournament_rounds (tournament_id, player_id, round_number, strokes, round_date)
SELECT 
    t.id as tournament_id,
    p.id as player_id,
    rounds.round_number,
    rounds.score as strokes,
    t.start_date + (rounds.round_number - 1) * INTERVAL '1 day' as round_date
FROM tournament_results_v2 tr
JOIN tournaments t ON tr.event_id = t.event_id
JOIN players p ON tr.player_dg_id = p.dg_id
CROSS JOIN (
    VALUES 
        (1, tr.round1_score),
        (2, tr.round2_score), 
        (3, tr.round3_score),
        (4, tr.round4_score)
) AS rounds(round_number, score)
WHERE rounds.score IS NOT NULL;
```

### 4. Tournament Round Snapshots Migration

#### Source: `tournament_round_snapshots` → Target: `tournament_rounds`

**This is our highest quality data source (37MB, 116k records)**

| Source Field | Target Field | Transformation Rule | Status | Notes |
|-------------|-------------|-------------------|--------|-------|
| `event_id` | `tournament_id` | FK mapping | ✅ Ready | Map to tournaments.id |
| `player_dg_id` | `player_id` | FK mapping | ✅ Ready | Map to players.id |
| `round_num` | `round_number` | Parse round number | ⚠️ Needs parsing | Handle 'event_avg' values |
| `snapshot_timestamp` | `round_date` | Extract date | ✅ Ready | Use snapshot date |
| `current_position` | `position` | Direct copy | ✅ Ready | Best position data available |
| `current_position` | `position_numeric` | Parse to integer | ⚠️ Needs parsing | Extract numeric value |
| `today_score` | `score_to_par` | Direct copy | ✅ Ready | Already relative to par |
| `total_score` | Calculate | Aggregate by tournament | ✅ Ready | Sum all rounds |
| `sg_total` | `sg_total` | Direct copy | ✅ Ready | High-quality SG data |
| `sg_ott` | `sg_off_tee` | Direct copy | ✅ Ready | Strokes gained off tee |
| `sg_app` | `sg_approach` | Direct copy | ✅ Ready | Strokes gained approach |
| `sg_arg` | `sg_around_green` | Direct copy | ✅ Ready | Strokes gained around green |
| `sg_putt` | `sg_putting` | Direct copy | ✅ Ready | Strokes gained putting |
| `driving_distance` | `driving_distance` | Direct copy | ✅ Ready | Driving stats |
| `driving_accuracy` | `driving_accuracy` | Convert to percentage | ⚠️ Needs conversion | Convert to decimal |
| `gir` | `greens_in_regulation` | Convert to percentage | ⚠️ Needs conversion | Convert to decimal |
| `putts_per_round` | `putts` | Direct copy | ✅ Ready | Total putts |

**Transformation Logic**:
```sql
-- Handle round number parsing
UPDATE tournament_rounds_staging SET 
    round_number = CASE 
        WHEN round_num ~ '^[0-9]+$' THEN round_num::INTEGER
        WHEN round_num = 'event_avg' THEN NULL  -- Skip aggregate records
        ELSE NULL
    END;

-- Calculate actual strokes from score_to_par
UPDATE tournament_rounds_staging tr SET 
    strokes = tr.score_to_par + c.par
FROM tournaments t 
JOIN courses c ON t.course_id = c.id
WHERE tr.tournament_id = t.id;

-- Convert percentages to decimals
UPDATE tournament_rounds_staging SET 
    driving_accuracy = driving_accuracy / 100.0,
    greens_in_regulation = greens_in_regulation / 100.0;
```

### 5. Betting Data Migration

#### Source: `matchups_v2` → Target: `betting_markets` + `odds_history`

| Source Field | Target Field | Transformation Rule | Status | Notes |
|-------------|-------------|-------------------|--------|-------|
| `event_id` | `tournament_id` | FK mapping | ✅ Ready | Map to tournaments.id |
| `round_num` | Market context | Include in market_rules | ✅ Ready | JSON field |
| `type` | `market_type` | Value mapping | ⚠️ Needs mapping | '2ball' → 'head_to_head' |
| `player1_dg_id` | `players_involved` | Array construction | ⚠️ Complex | Build UUID array |
| `player2_dg_id` | `players_involved` | Array construction | ⚠️ Complex | Build UUID array |
| `player3_dg_id` | `players_involved` | Array construction | ⚠️ Complex | Build UUID array (optional) |
| `fanduel_player1_odds` | `odds_history` records | Create odds records | ⚠️ Complex | Split into odds table |
| `fanduel_player2_odds` | `odds_history` records | Create odds records | ⚠️ Complex | Split into odds table |
| `bet365_player1_odds` | `odds_history` records | Create odds records | ⚠️ Complex | Split into odds table |
| `bet365_player2_odds` | `odds_history` records | Create odds records | ⚠️ Complex | Split into odds table |
| - | `sportsbook_id` | Lookup/create | 🆕 New | Create FanDuel/Bet365 records |
| - | `market_name` | Generate | 🆕 New | "Player1 vs Player2 vs Player3" |
| - | `market_description` | Generate | 🆕 New | Descriptive text |

**Complex Transformation - Betting Market Normalization**:
```sql
-- Step 1: Create sportsbooks
INSERT INTO sportsbooks (name, display_name, country) VALUES
('fanduel', 'FanDuel', 'USA'),
('bet365', 'Bet365', 'UK');

-- Step 2: Create betting markets
INSERT INTO betting_markets (tournament_id, sportsbook_id, market_type, market_name, players_involved)
SELECT DISTINCT
    t.id as tournament_id,
    sb.id as sportsbook_id,
    CASE m.type WHEN '2ball' THEN 'head_to_head' WHEN '3ball' THEN 'three_ball' END as market_type,
    CASE 
        WHEN m.type = '2ball' THEN p1.name || ' vs ' || p2.name
        WHEN m.type = '3ball' THEN p1.name || ' vs ' || p2.name || ' vs ' || p3.name
    END as market_name,
    CASE 
        WHEN m.type = '2ball' THEN ARRAY[p1.id, p2.id]
        WHEN m.type = '3ball' THEN ARRAY[p1.id, p2.id, p3.id]
    END as players_involved
FROM matchups_v2 m
JOIN tournaments t ON m.event_id = t.event_id
JOIN players p1 ON m.player1_dg_id = p1.dg_id
JOIN players p2 ON m.player2_dg_id = p2.dg_id
LEFT JOIN players p3 ON m.player3_dg_id = p3.dg_id
CROSS JOIN sportsbooks sb;

-- Step 3: Create odds history records
INSERT INTO odds_history (market_id, player_id, sportsbook_id, decimal_odds, american_odds, implied_probability, timestamp)
SELECT 
    bm.id as market_id,
    p.id as player_id,
    sb.id as sportsbook_id,
    odds_data.decimal_odds,
    odds_data.american_odds,
    (1.0 / odds_data.decimal_odds) as implied_probability,
    COALESCE(m.updated_at, m.created_at) as timestamp
FROM matchups_v2 m
JOIN betting_markets bm ON ... -- Complex join logic
JOIN sportsbooks sb ON sb.name = odds_data.sportsbook
JOIN players p ON p.dg_id = odds_data.player_dg_id
CROSS JOIN LATERAL (
    VALUES 
        ('fanduel', m.player1_dg_id, m.fanduel_player1_odds),
        ('fanduel', m.player2_dg_id, m.fanduel_player2_odds),
        ('bet365', m.player1_dg_id, m.bet365_player1_odds),
        ('bet365', m.player2_dg_id, m.bet365_player2_odds)
) AS odds_data(sportsbook, player_dg_id, american_odds)
WHERE odds_data.american_odds IS NOT NULL;
```

---

## Data Enrichment Requirements

### External Data Sources Needed

#### 1. Player Demographics and Attributes
**Priority**: Critical (Migration Blocker)
- **Source**: DataGolf API, PGA Tour API, ESPN API
- **Data Points**: Country, birth_date, height, weight, turned_professional
- **Estimated Effort**: 8-12 hours
- **Cost**: API costs + development time

#### 2. Tournament Prize Money and Points
**Priority**: High
- **Source**: PGA Tour API, tournament websites
- **Data Points**: Purse, FedEx Cup points, world ranking points
- **Estimated Effort**: 12-16 hours
- **Cost**: Medium (some manual research required)

#### 3. Course Characteristics and Details
**Priority**: Critical (Migration Blocker)
- **Source**: Course websites, golf databases, Google Maps API
- **Data Points**: Location, designer, yardage, par, course type
- **Estimated Effort**: 20-30 hours
- **Cost**: High (extensive research and data entry)

#### 4. Historical Tournament Results
**Priority**: Critical (Migration Blocker)
- **Source**: DataGolf API, PGA Tour API backfill
- **Data Points**: Final positions, prize money, cut status
- **Estimated Effort**: 40-80 hours
- **Cost**: High (API costs and development time)

### AI-Generated Fields

#### 1. Player Embeddings
**Generation Method**: Similarity analysis based on performance patterns
```sql
-- Style embedding calculation (simplified)
UPDATE players SET style_embedding = 
    calculate_style_embedding(
        driving_distance_avg,
        driving_accuracy_avg,
        approach_proximity_avg,
        putting_avg,
        course_preferences,
        playing_tendencies
    );
```

#### 2. Course Embeddings
**Generation Method**: Course characteristics analysis
```sql
-- Course embedding calculation
UPDATE courses SET course_embedding = 
    calculate_course_embedding(
        yardage,
        par,
        course_type,
        difficulty_metrics,
        weather_patterns,
        historical_scoring
    );
```

#### 3. Tournament Embeddings
**Generation Method**: Tournament context and field analysis
```sql
-- Tournament embedding calculation  
UPDATE tournaments SET tournament_embedding = 
    calculate_tournament_embedding(
        field_strength,
        tournament_type,
        course_characteristics,
        weather_conditions,
        historical_data
    );
```

---

## Legacy Field Handling

### Fields Not Migrated (Drop Strategy)

#### From `player_season_stats` table
- **Reason**: Redundant with tournament_round_snapshots data
- **Action**: Archive table, do not migrate
- **Risk**: Low - data available in better format elsewhere

#### From settlement and betting history tables
- **Reason**: Low AI value, high storage cost
- **Action**: Archive for compliance, do not migrate to new schema
- **Risk**: Low - not critical for core analytics

### Fields Requiring Manual Review

#### Player Names with Variations
```sql
-- Identify name variations requiring manual review
SELECT name, COUNT(*) as variations
FROM (
    SELECT DISTINCT name FROM players_v2
    UNION ALL
    SELECT DISTINCT player1_name FROM matchups_v2
    UNION ALL  
    SELECT DISTINCT player2_name FROM matchups_v2
    UNION ALL
    SELECT DISTINCT player3_name FROM matchups_v2
) name_variants
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY variations DESC;
```

#### Tournament Name Standardization
```sql
-- Identify tournament name inconsistencies
SELECT event_name, COUNT(*) as occurrences
FROM tournaments_v2
GROUP BY event_name
ORDER BY event_name;
```

---

## Data Type Conversions

### Numeric Precision Changes

| Current Type | Target Type | Conversion Rule | Validation |
|-------------|-------------|----------------|------------|
| `INTEGER` (scores) | `INTEGER` | Direct copy | Range validation |
| `DECIMAL` (percentages) | `DECIMAL(5,2)` | Precision adjustment | 0-100 range check |
| `NUMERIC` (SG stats) | `DECIMAL(6,3)` | Precision standardization | Reasonable range check |
| `BIGINT` (IDs) | `UUID` | Generate UUIDs | Uniqueness validation |

### String Standardization

| Field Type | Standardization Rule | Example |
|-----------|---------------------|---------|
| Player Names | Title case, trim whitespace | "TIGER WOODS" → "Tiger Woods" |
| Country Names | ISO standard names | "United States" → "USA" |
| Tournament Names | Official names | "The Masters Tournament" → "The Masters" |
| Course Names | Official course names | "Augusta National GC" → "Augusta National Golf Club" |

### Date/Time Handling

```sql
-- Ensure consistent timezone handling
ALTER TABLE tournaments_staging 
ALTER COLUMN start_date SET DATA TYPE TIMESTAMPTZ 
USING start_date AT TIME ZONE 'UTC';

-- Handle tournament dates across timezones
UPDATE tournaments_staging SET 
    start_date = start_date AT TIME ZONE tournament_timezone;
```

---

## Derived and Calculated Fields

### Tournament-Level Calculations

```sql
-- Field strength calculation
UPDATE tournaments SET field_strength = (
    SELECT AVG(world_ranking)
    FROM tournament_participants tp
    JOIN players p ON tp.player_id = p.id
    WHERE tp.tournament_id = tournaments.id
    AND p.world_ranking IS NOT NULL
);

-- Cut line calculation
UPDATE tournaments SET cut_line = (
    SELECT score_to_par
    FROM tournament_rounds tr
    WHERE tr.tournament_id = tournaments.id
    AND tr.round_number = 2
    ORDER BY position_numeric
    LIMIT 1 OFFSET 69  -- Typical cut at 70th position
);
```

### Player-Level Aggregations

```sql
-- Career statistics calculation
UPDATE players SET 
    pga_tour_wins = (
        SELECT COUNT(*) 
        FROM tournament_rounds tr
        JOIN tournaments t ON tr.tournament_id = t.id
        WHERE tr.player_id = players.id 
        AND tr.position_numeric = 1
        AND t.tour = 'pga'
    ),
    career_earnings = (
        SELECT SUM(prize_money)
        FROM tournament_results tr
        WHERE tr.player_id = players.id
    );
```

### Performance Metrics

```sql
-- Consistency metrics calculation
UPDATE players SET consistency_score = (
    SELECT 1.0 / (1.0 + STDDEV(score_to_par))
    FROM tournament_rounds tr
    WHERE tr.player_id = players.id
    AND tr.round_date > NOW() - INTERVAL '2 years'
);

-- Course fit scores
INSERT INTO player_course_fit (player_id, course_id, fit_score)
SELECT 
    tr.player_id,
    t.course_id,
    AVG(tr.sg_total) - (
        SELECT AVG(sg_total) 
        FROM tournament_rounds tr2 
        WHERE tr2.player_id = tr.player_id
    ) as fit_score
FROM tournament_rounds tr
JOIN tournaments t ON tr.tournament_id = t.id
WHERE t.course_id IS NOT NULL
GROUP BY tr.player_id, t.course_id
HAVING COUNT(*) >= 3;  -- Minimum 3 rounds for reliable fit score
```

---

## Validation Rules

### Pre-Migration Validation

```sql
-- Ensure all critical foreign keys can be resolved
SELECT 'Players validation' as check_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN dg_id IN (SELECT dg_id FROM players_v2) THEN 1 END) as valid_references
FROM tournament_round_snapshots;

-- Validate date ranges
SELECT 'Date validation' as check_name,
    COUNT(*) as total_tournaments,
    COUNT(CASE WHEN start_date <= end_date THEN 1 END) as valid_date_ranges
FROM tournaments_v2;

-- Check for reasonable score values
SELECT 'Score validation' as check_name,
    COUNT(*) as total_scores,
    COUNT(CASE WHEN today_score BETWEEN -15 AND 15 THEN 1 END) as reasonable_scores
FROM tournament_round_snapshots;
```

### Post-Migration Validation

```sql
-- Record count reconciliation
WITH source_counts AS (
    SELECT 
        (SELECT COUNT(*) FROM players_v2) as players_old,
        (SELECT COUNT(*) FROM tournaments_v2) as tournaments_old,
        (SELECT COUNT(*) FROM tournament_round_snapshots) as rounds_old
),
target_counts AS (
    SELECT 
        (SELECT COUNT(*) FROM players) as players_new,
        (SELECT COUNT(*) FROM tournaments) as tournaments_new,
        (SELECT COUNT(*) FROM tournament_rounds) as rounds_new
)
SELECT 
    'Players: ' || sc.players_old || ' → ' || tc.players_new as player_migration,
    'Tournaments: ' || sc.tournaments_old || ' → ' || tc.tournaments_new as tournament_migration,
    'Rounds: ' || sc.rounds_old || ' → ' || tc.rounds_new as rounds_migration
FROM source_counts sc, target_counts tc;
```

---

## Migration Phases and Dependencies

### Phase 1: Data Remediation (PREREQUISITE)
**Duration**: 4-6 weeks
**Must Complete Before Migration**

1. **Week 1-2**: Tournament results backfill
   - Source final positions from external APIs
   - Validate data against known results
   - Update tournament_results_v2 table

2. **Week 3-4**: Course data reconstruction  
   - Research and rebuild course database
   - Establish tournament-course associations
   - Validate course characteristics

3. **Week 5-6**: Player data enrichment
   - Import nationality and demographic data
   - Standardize player names across tables
   - Validate player information accuracy

### Phase 2: Schema Migration
**Duration**: 2-3 weeks  
**After Data Remediation Complete**

1. **Week 1**: Core entity migration
   - Migrate players, courses, tournaments
   - Apply transformation rules
   - Validate referential integrity

2. **Week 2**: Performance data migration
   - Migrate tournament_round_snapshots
   - Transform tournament_results_v2
   - Create betting market structures

3. **Week 3**: Final validation and optimization
   - Run comprehensive validation queries
   - Create indexes and materialized views
   - Performance testing and optimization

---

## Risk Mitigation Strategies

### Data Loss Prevention

1. **Complete Database Backup**
   ```bash
   pg_dump golf_parlay_db > backup_pre_migration_$(date +%Y%m%d).sql
   ```

2. **Staging Environment Testing**
   - Test all transformations in isolated environment
   - Validate transformation accuracy with sample data
   - Measure performance impact of transformations

3. **Rollback Procedures**
   - Maintain original tables during migration
   - Create rollback scripts for each migration step
   - Test rollback procedures in staging

### Data Quality Assurance

1. **Automated Validation Checks**
   - Run validation queries after each migration step
   - Implement automated data quality monitoring
   - Alert on data quality degradation

2. **Business Logic Validation**
   - Verify business rules are enforced in new schema
   - Test edge cases and boundary conditions
   - Validate calculated fields and aggregations

3. **User Acceptance Testing**
   - Test critical application workflows
   - Validate API responses and data formats
   - Verify reporting and analytics functionality

---

## Implementation Checklist

### Pre-Migration Checklist

- [ ] Complete data remediation phase
- [ ] Validate data quality improvements
- [ ] Create comprehensive database backup
- [ ] Set up staging environment
- [ ] Test transformation scripts
- [ ] Validate rollback procedures
- [ ] Prepare monitoring and alerting
- [ ] Schedule migration window
- [ ] Communicate with stakeholders

### Migration Execution Checklist

- [ ] Execute database backup
- [ ] Run pre-migration validation queries
- [ ] Create new schema structures
- [ ] Execute data transformations
- [ ] Validate referential integrity
- [ ] Run post-migration validation
- [ ] Create indexes and constraints
- [ ] Update application connection strings
- [ ] Test critical application functions
- [ ] Monitor system performance

### Post-Migration Checklist

- [ ] Verify all data migrated successfully
- [ ] Run comprehensive validation queries
- [ ] Test application functionality
- [ ] Monitor system performance
- [ ] Update documentation
- [ ] Train users on new features
- [ ] Schedule follow-up reviews
- [ ] Archive old schema (after validation period)

---

**This mapping document serves as the definitive guide for migrating from the current fragmented schema to the new AI-optimized database structure. All transformation rules must be validated in staging before production migration.**