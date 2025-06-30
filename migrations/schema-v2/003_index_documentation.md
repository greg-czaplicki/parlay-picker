# Database Schema v2 - Index Documentation

This document describes all performance indexes created for the new database schema and their intended use cases.

## Index Summary

### Tournaments Table (tournaments_v2)
| Index Name | Columns | Purpose |
|------------|---------|---------|
| `tournaments_v2_pkey` | `event_id` | Primary key - unique tournament identification |
| `idx_tournaments_tour_v2` | `tour` | Filter tournaments by tour (PGA, Euro, etc.) |
| `idx_tournaments_status_v2` | `status` | Filter tournaments by status (upcoming, active, completed) |
| `idx_tournaments_start_date_v2` | `start_date` | Date range queries, chronological ordering |

### Players Table (players_v2)
| Index Name | Columns | Purpose |
|------------|---------|---------|
| `players_v2_pkey` | `dg_id` | Primary key - unique player identification |
| `idx_players_name_v2` | `name` | Player name searches and sorting |
| `idx_players_country_v2` | `country` | Filter players by country |
| `idx_players_country_code_v2` | `country_code` | Filter players by country code |

### Player Round Scores Table (player_round_scores_v2)
| Index Name | Columns | Purpose |
|------------|---------|---------|
| `player_round_scores_v2_pkey` | `id` | Primary key - unique record identification |
| `player_round_scores_v2_event_id_dg_id_round_number_key` | `event_id, dg_id, round_number` | Unique constraint - prevent duplicate round entries |
| `idx_player_round_scores_event_id_v2` | `event_id` | Tournament-based queries |
| `idx_player_round_scores_dg_id_v2` | `dg_id` | Player-based queries |
| `idx_player_round_scores_player_name_v2` | `player_name` | Player name searches |
| `idx_player_round_scores_round_number_v2` | `round_number` | Round-specific queries |
| `idx_player_round_scores_event_player_v2` | `event_id, dg_id` | Player performance in specific tournaments |

### Tournament Results Table (tournament_results_v2)
| Index Name | Columns | Purpose |
|------------|---------|---------|
| `tournament_results_v2_pkey` | `id` | Primary key - unique record identification |
| `tournament_results_v2_event_id_dg_id_key` | `event_id, dg_id` | Unique constraint - one result per player per tournament |
| `idx_tournament_results_event_id_v2` | `event_id` | Tournament leaderboards |
| `idx_tournament_results_dg_id_v2` | `dg_id` | Player history queries |
| `idx_tournament_results_player_name_v2` | `player_name` | Player name searches |
| `idx_tournament_results_final_position_v2` | `final_position` | Position-based filters (top 10, winners, etc.) |
| `idx_tournament_results_scoring_average_v2` | `scoring_average` | Scoring average analysis and trends |

### Player Advanced Stats Table (player_advanced_stats_v2)
| Index Name | Columns | Purpose |
|------------|---------|---------|
| `player_advanced_stats_v2_pkey` | `id` | Primary key - unique record identification |
| `player_advanced_stats_v2_event_id_dg_id_round_number_key` | `event_id, dg_id, round_number` | Unique constraint - prevent duplicate stat entries |
| `idx_player_advanced_stats_event_id_v2` | `event_id` | Tournament-based stats queries |
| `idx_player_advanced_stats_dg_id_v2` | `dg_id` | Player-based stats queries |
| `idx_player_advanced_stats_round_number_v2` | `round_number` | Round-specific stats analysis |
| `idx_player_advanced_stats_event_player_v2` | `event_id, dg_id` | Player stats in specific tournaments |
| `idx_player_advanced_stats_sg_total_v2` | `sg_total` | Total strokes gained analysis |
| `idx_player_advanced_stats_sg_ott_v2` | `sg_ott` | Off-the-tee performance analysis |
| `idx_player_advanced_stats_sg_app_v2` | `sg_app` | Approach shot analysis |
| `idx_player_advanced_stats_sg_putt_v2` | `sg_putt` | Putting performance analysis |

## Common Query Patterns Optimized

### 1. Tournament Leaderboards
```sql
-- Optimized by: idx_tournament_results_event_id_v2, idx_tournament_results_final_position_v2
SELECT * FROM tournament_results_v2 
WHERE event_id = 12345 
ORDER BY final_position;
```

### 2. Player Performance History
```sql
-- Optimized by: idx_tournament_results_dg_id_v2, idx_tournament_results_scoring_average_v2
SELECT * FROM tournament_results_v2 
WHERE dg_id = 10091 
ORDER BY scoring_average;
```

### 3. Round-by-Round Analysis
```sql
-- Optimized by: idx_player_round_scores_event_player_v2
SELECT * FROM player_round_scores_v2 
WHERE event_id = 12345 AND dg_id = 10091 
ORDER BY round_number;
```

### 4. Strokes Gained Analysis
```sql
-- Optimized by: idx_player_advanced_stats_sg_total_v2
SELECT * FROM player_advanced_stats_v2 
WHERE sg_total > 2.0 
ORDER BY sg_total DESC;
```

### 5. Tour-Specific Queries
```sql
-- Optimized by: idx_tournaments_tour_v2, idx_tournaments_status_v2
SELECT * FROM tournaments_v2 
WHERE tour = 'pga' AND status = 'active';
```

## Index Maintenance Notes

- All indexes are B-tree indexes suitable for equality and range queries
- Composite indexes follow the principle of most selective columns first
- Foreign key columns are indexed for efficient JOIN operations
- Unique constraints automatically create indexes
- Consider REINDEX operations during maintenance windows if query performance degrades

## Future Index Considerations

As the application evolves, consider adding indexes for:
- Date range queries on updated_at/created_at columns
- Composite indexes for complex WHERE clauses that become common
- Partial indexes for frequently filtered subsets of data
- GIN indexes if full-text search is needed on player/tournament names