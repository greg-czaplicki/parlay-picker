# Entity Relationship Diagram - Golf Parlay Picker Schema v2

## Visual Schema Representation

```
                Golf Parlay Picker Database Schema v2
                =====================================

┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                     │
│                                    Master Tables (Independent)                                                     │
│                                                                                                                     │
│  ┌──────────────────────────────────────┐                    ┌──────────────────────────────────────┐            │
│  │           tournaments_v2             │                    │             players_v2               │            │
│  │  ──────────────────────────────────  │                    │  ──────────────────────────────────  │            │
│  │  🔑 event_id        INTEGER (PK)     │                    │  🔑 dg_id           BIGINT (PK)      │            │
│  │     event_name      TEXT             │                    │     name            TEXT             │            │
│  │     course_name     TEXT             │                    │     country         TEXT             │            │
│  │     course_par      INTEGER          │                    │     country_code    TEXT             │            │
│  │     start_date      DATE             │                    │     created_at      TIMESTAMP        │            │
│  │     end_date        DATE             │                    │     updated_at      TIMESTAMP        │            │
│  │     tour            TEXT             │                    │                                      │            │
│  │     status          TEXT             │                    │  Constraints:                        │            │
│  │     created_at      TIMESTAMP        │                    │  • name NOT NULL, non-empty          │            │
│  │     updated_at      TIMESTAMP        │                    │  • country_code = 2 chars, UPPER    │            │
│  │                                      │                    │                                      │            │
│  │  Constraints:                        │                    │  Indexes:                            │            │
│  │  • course_par BETWEEN 68-74          │                    │  • idx_players_name_v2               │            │
│  │  • tour IN (pga, euro, dp_world...)  │                    │  • idx_players_country_v2            │            │
│  │  • status IN (upcoming, active...)   │                    │  • idx_players_country_code_v2       │            │
│  │                                      │                    │                                      │            │
│  │  Indexes:                            │                    └──────────────────────────────────────┘            │
│  │  • idx_tournaments_tour_v2           │                                           │                             │
│  │  • idx_tournaments_status_v2         │                                           │                             │
│  │  • idx_tournaments_start_date_v2     │                                           │                             │
│  └──────────────────────────────────────┘                                           │                             │
│                     │                                                               │                             │
│                     │                                                               │                             │
│                     │               Fact Table (Core Data)                         │                             │
│                     │               ───────────────────────                        │                             │
│                     │                                                               │                             │
│                     └───────────────────────────┐                 ┌─────────────────┘                             │
│                                                 │                 │                                               │
│                                                 ▼                 ▼                                               │
│          ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│          │                              player_round_scores_v2                                                  │  │
│          │  ─────────────────────────────────────────────────────────────────────────────────────────────────  │  │
│          │  🔑 id                 BIGSERIAL (PK)                                                                │  │
│          │  🔗 event_id           INTEGER (FK → tournaments_v2.event_id) CASCADE DELETE                       │  │
│          │  🔗 dg_id              BIGINT (FK → players_v2.dg_id) CASCADE DELETE                               │  │
│          │     player_name        TEXT                                                                         │  │
│          │     round_number       INTEGER (1-4)                                                               │  │
│          │  ⭐ round_score        INTEGER  -- ACTUAL SCORE: 68, 71 (NOT relative to par!)                   │  │
│          │     position           INTEGER                                                                      │  │
│          │     holes_completed    INTEGER (0-18)                                                              │  │
│          │     made_cut           BOOLEAN                                                                      │  │
│          │     tee_time           TIMESTAMP WITH TIME ZONE                                                    │  │
│          │     updated_at         TIMESTAMP WITH TIME ZONE                                                    │  │
│          │     created_at         TIMESTAMP WITH TIME ZONE                                                    │  │
│          │                                                                                                     │  │
│          │  Constraints:                                                                                       │  │
│          │  • UNIQUE(event_id, dg_id, round_number)  -- Prevent duplicate rounds                             │  │
│          │  • round_score BETWEEN 55-100  -- Reasonable golf scores                                          │  │
│          │  • round_number BETWEEN 1-4                                                                        │  │
│          │  • position > 0                                                                                    │  │
│          │  • holes_completed BETWEEN 0-18                                                                    │  │
│          │                                                                                                     │  │
│          │  Indexes:                                                                                           │  │
│          │  • idx_player_round_scores_event_id_v2                                                             │  │
│          │  • idx_player_round_scores_dg_id_v2                                                                │  │
│          │  • idx_player_round_scores_player_name_v2                                                          │  │
│          │  • idx_player_round_scores_round_number_v2                                                         │  │
│          │  • idx_player_round_scores_event_player_v2 (event_id, dg_id)                                      │  │
│          └─────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                 │                                                                   │
│                                                 │                                                                   │
│                                    Derived Tables (Computed Data)                                                  │
│                                    ──────────────────────────────                                                  │
│                                                 │                                                                   │
│                         ┌───────────────────────┴──────────────────────┐                                          │
│                         │                                               │                                          │
│                         ▼                                               ▼                                          │
│  ┌─────────────────────────────────────────────┐        ┌─────────────────────────────────────────────┐          │
│  │          tournament_results_v2              │        │        player_advanced_stats_v2             │          │
│  │  ─────────────────────────────────────────  │        │  ─────────────────────────────────────────  │          │
│  │  🔑 id               BIGSERIAL (PK)         │        │  🔑 id               BIGSERIAL (PK)         │          │
│  │  🔗 event_id         INTEGER (FK)           │        │  🔗 event_id         INTEGER (FK)           │          │
│  │  🔗 dg_id            BIGINT (FK)            │        │  🔗 dg_id            BIGINT (FK)            │          │
│  │     player_name      TEXT                  │        │     round_number     INTEGER (1-4)         │          │
│  │     final_position   INTEGER                │        │                                             │          │
│  │     total_score      INTEGER                │        │  Strokes Gained:                            │          │
│  │     rounds_completed INTEGER (0-4)          │        │     sg_total         DECIMAL(6,3)          │          │
│  │     made_cut         BOOLEAN                │        │     sg_ott           DECIMAL(6,3)          │          │
│  │                                             │        │     sg_app           DECIMAL(6,3)          │          │
│  │  Individual Rounds:                         │        │     sg_arg           DECIMAL(6,3)          │          │
│  │     round_1_score    INTEGER                │        │     sg_putt          DECIMAL(6,3)          │          │
│  │     round_2_score    INTEGER                │        │     sg_t2g           DECIMAL(6,3)          │          │
│  │     round_3_score    INTEGER                │        │                                             │          │
│  │     round_4_score    INTEGER                │        │  Traditional Stats:                         │          │
│  │                                             │        │     accuracy         DECIMAL(5,2) (0-100%) │          │
│  │  Calculated Metrics:                        │        │     distance         DECIMAL(6,1) (200-400)│          │
│  │  ⭐ scoring_average  DECIMAL(5,2)           │        │     gir              DECIMAL(5,2) (0-100%) │          │
│  │     relative_to_par  INTEGER                │        │     prox_fw          DECIMAL(6,1)          │          │
│  │     calculated_at    TIMESTAMP              │        │     scrambling       DECIMAL(5,2) (0-100%) │          │
│  │     updated_at       TIMESTAMP              │        │                                             │          │
│  │                                             │        │     updated_at       TIMESTAMP             │          │
│  │  Constraints:                               │        │     created_at       TIMESTAMP             │          │
│  │  • UNIQUE(event_id, dg_id)                 │        │                                             │          │
│  │  • scoring_average BETWEEN 55-100          │        │  Constraints:                               │          │
│  │  • final_position > 0                      │        │  • UNIQUE(event_id, dg_id, round_number)   │          │
│  │  • rounds_completed BETWEEN 0-4            │        │  • sg_total BETWEEN -15 to 15              │          │
│  │                                             │        │  • sg_* values BETWEEN -8 to 8             │          │
│  │  Indexes:                                   │        │  • sg_t2g BETWEEN -12 to 12                │          │
│  │  • idx_tournament_results_event_id_v2       │        │  • accuracy, gir, scrambling: 0-100%       │          │
│  │  • idx_tournament_results_dg_id_v2          │        │  • distance BETWEEN 200-400 yards          │          │
│  │  • idx_tournament_results_player_name_v2    │        │                                             │          │
│  │  • idx_tournament_results_final_position_v2 │        │  Indexes:                                   │          │
│  │  • idx_tournament_results_scoring_average_v2│        │  • idx_player_advanced_stats_event_id_v2   │          │
│  └─────────────────────────────────────────────┘        │  • idx_player_advanced_stats_dg_id_v2      │          │
│                                                          │  • idx_player_advanced_stats_round_number_v2│         │
│                                                          │  • idx_player_advanced_stats_event_player_v2│         │
│                                                          │  • idx_player_advanced_stats_sg_total_v2   │          │
│                                                          │  • idx_player_advanced_stats_sg_ott_v2     │          │
│                                                          │  • idx_player_advanced_stats_sg_app_v2     │          │
│                                                          │  • idx_player_advanced_stats_sg_putt_v2    │          │
│                                                          └─────────────────────────────────────────────┘          │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Relationship Details

### Primary Relationships

1. **tournaments_v2 ← player_round_scores_v2**
   - Type: One-to-Many
   - Foreign Key: `event_id`
   - Delete Behavior: CASCADE (deleting tournament removes all round scores)

2. **players_v2 ← player_round_scores_v2**
   - Type: One-to-Many  
   - Foreign Key: `dg_id`
   - Delete Behavior: CASCADE (deleting player removes all their scores)

3. **player_round_scores_v2 → tournament_results_v2**
   - Type: Data Flow (computed relationship)
   - tournament_results_v2 is derived from aggregating player_round_scores_v2

4. **tournaments_v2 ← tournament_results_v2**
   - Type: One-to-Many
   - Foreign Key: `event_id`
   - Delete Behavior: CASCADE

5. **players_v2 ← tournament_results_v2**
   - Type: One-to-Many
   - Foreign Key: `dg_id` 
   - Delete Behavior: CASCADE

6. **tournaments_v2 ← player_advanced_stats_v2**
   - Type: One-to-Many
   - Foreign Key: `event_id`
   - Delete Behavior: CASCADE

7. **players_v2 ← player_advanced_stats_v2**
   - Type: One-to-Many
   - Foreign Key: `dg_id`
   - Delete Behavior: CASCADE

### Key Design Decisions

#### 1. Single Source of Truth
- **player_round_scores_v2** is the authoritative source for all scoring data
- **tournament_results_v2** contains derived/calculated values for performance
- This eliminates data inconsistencies and ensures accuracy

#### 2. Actual Scores (Not Relative to Par)
- **round_score** column stores actual scores: 68, 71, 74
- **relative_to_par** is calculated as: total_score - (course_par × rounds_completed)
- This handles courses with different par values correctly

#### 3. Referential Integrity
- All foreign keys use CASCADE DELETE to maintain consistency
- Deleting a tournament removes all associated scores and results
- Deleting a player removes all their historical data

#### 4. Performance Optimization
- Strategic indexes on commonly queried columns
- Composite indexes for multi-table joins
- Unique constraints prevent data duplication

#### 5. Data Validation
- Comprehensive CHECK constraints ensure data quality
- Reasonable ranges for golf-specific values
- Business rule enforcement at the database level

## Data Flow Example

```
1. Tournament Created:
   INSERT INTO tournaments_v2 (event_id, event_name, course_par)
   VALUES (12345, 'PGA Championship', 72);

2. Player Registered:
   INSERT INTO players_v2 (dg_id, name)
   VALUES (10091, 'Tiger Woods');

3. Round Scores Recorded:
   INSERT INTO player_round_scores_v2 (event_id, dg_id, player_name, round_number, round_score)
   VALUES (12345, 10091, 'Tiger Woods', 1, 68);

4. Tournament Results Calculated:
   INSERT INTO tournament_results_v2 (event_id, dg_id, total_score, scoring_average, relative_to_par)
   SELECT event_id, dg_id, 
          SUM(round_score) as total_score,
          AVG(round_score) as scoring_average,
          SUM(round_score) - (72 * COUNT(*)) as relative_to_par
   FROM player_round_scores_v2
   WHERE event_id = 12345 AND dg_id = 10091;

5. Advanced Stats Recorded:
   INSERT INTO player_advanced_stats_v2 (event_id, dg_id, round_number, sg_total, sg_putt)
   VALUES (12345, 10091, 1, 2.1, 0.8);
```

This schema provides a clean, efficient foundation for accurate golf tournament data management and analysis.