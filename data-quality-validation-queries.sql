-- Data Quality Validation Queries
-- Use these queries to monitor and validate data quality before and after migration
-- Generated: July 23, 2025

-- =========================================
-- CRITICAL ISSUE VALIDATION QUERIES
-- =========================================

-- 1. Tournament Results Final Position Completeness
-- CRITICAL: 96.8% missing final positions
SELECT 
    'Tournament Results Final Positions' as check_name,
    COUNT(*) as total_records,
    COUNT(final_position) as records_with_positions,
    ROUND((COUNT(final_position) * 100.0 / COUNT(*)), 1) as completion_percentage,
    CASE 
        WHEN (COUNT(final_position) * 100.0 / COUNT(*)) > 90 THEN '✅ GOOD'
        WHEN (COUNT(final_position) * 100.0 / COUNT(*)) > 50 THEN '⚠️ NEEDS_WORK'
        ELSE '❌ CRITICAL'
    END as status
FROM tournament_results_v2;

-- 2. Course Data Coverage
-- CRITICAL: 98.8% of tournaments missing course association
SELECT 
    'Course Data Coverage' as check_name,
    (SELECT COUNT(*) FROM courses_v2) as total_courses,
    (SELECT COUNT(*) FROM tournaments_v2) as total_tournaments,
    (SELECT COUNT(*) FROM tournaments_v2 WHERE course_name IS NOT NULL) as tournaments_with_course,
    ROUND(((SELECT COUNT(*) FROM tournaments_v2 WHERE course_name IS NOT NULL) * 100.0 / 
           (SELECT COUNT(*) FROM tournaments_v2)), 1) as coverage_percentage,
    CASE 
        WHEN ((SELECT COUNT(*) FROM tournaments_v2 WHERE course_name IS NOT NULL) * 100.0 / 
              (SELECT COUNT(*) FROM tournaments_v2)) > 90 THEN '✅ GOOD'
        WHEN ((SELECT COUNT(*) FROM tournaments_v2 WHERE course_name IS NOT NULL) * 100.0 / 
              (SELECT COUNT(*) FROM tournaments_v2)) > 50 THEN '⚠️ NEEDS_WORK'
        ELSE '❌ CRITICAL'
    END as status;

-- 3. Player Nationality Data Completeness
-- CRITICAL: 100% missing nationality data
SELECT 
    'Player Nationality Data' as check_name,
    COUNT(*) as total_players,
    COUNT(country) as players_with_country,
    COUNT(country_code) as players_with_country_code,
    ROUND((COUNT(country) * 100.0 / COUNT(*)), 1) as country_completion_percentage,
    CASE 
        WHEN (COUNT(country) * 100.0 / COUNT(*)) > 95 THEN '✅ GOOD'
        WHEN (COUNT(country) * 100.0 / COUNT(*)) > 80 THEN '⚠️ NEEDS_WORK'
        ELSE '❌ CRITICAL'
    END as status
FROM players_v2;

-- =========================================
-- BETTING DATA QUALITY CHECKS
-- =========================================

-- 4. Matchups Odds Coverage
-- Issue: 73.4% missing FanDuel odds, 26.6% missing Bet365 odds
SELECT 
    'Matchups Odds Coverage' as check_name,
    COUNT(*) as total_matchups,
    COUNT(fanduel_player1_odds) as fanduel_coverage,
    COUNT(bet365_player1_odds) as bet365_coverage,
    ROUND((COUNT(fanduel_player1_odds) * 100.0 / COUNT(*)), 1) as fanduel_percentage,
    ROUND((COUNT(bet365_player1_odds) * 100.0 / COUNT(*)), 1) as bet365_percentage,
    CASE 
        WHEN (COUNT(fanduel_player1_odds) * 100.0 / COUNT(*)) > 85 THEN '✅ GOOD'
        WHEN (COUNT(fanduel_player1_odds) * 100.0 / COUNT(*)) > 70 THEN '⚠️ NEEDS_WORK'
        ELSE '❌ POOR'
    END as fanduel_status,
    CASE 
        WHEN (COUNT(bet365_player1_odds) * 100.0 / COUNT(*)) > 85 THEN '✅ GOOD'
        WHEN (COUNT(bet365_player1_odds) * 100.0 / COUNT(*)) > 70 THEN '⚠️ NEEDS_WORK'
        ELSE '❌ POOR'
    END as bet365_status
FROM matchups_v2;

-- 5. Parlay Settlement Status
-- Check for pending settlements that may be stale
SELECT 
    'Parlay Settlement Health' as check_name,
    COUNT(*) as total_parlays,
    COUNT(CASE WHEN outcome = 'pending' THEN 1 END) as pending_parlays,
    COUNT(CASE WHEN outcome IN ('win', 'loss') THEN 1 END) as settled_parlays,
    ROUND((COUNT(CASE WHEN outcome IN ('win', 'loss') THEN 1 END) * 100.0 / COUNT(*)), 1) as settlement_percentage,
    COUNT(CASE WHEN outcome = 'pending' AND created_at < NOW() - INTERVAL '7 days' THEN 1 END) as stale_pending,
    CASE 
        WHEN COUNT(CASE WHEN outcome = 'pending' AND created_at < NOW() - INTERVAL '7 days' THEN 1 END) = 0 THEN '✅ GOOD'
        WHEN COUNT(CASE WHEN outcome = 'pending' AND created_at < NOW() - INTERVAL '7 days' THEN 1 END) < 10 THEN '⚠️ NEEDS_ATTENTION'
        ELSE '❌ STALE_DATA'
    END as status
FROM parlays_v2;

-- =========================================
-- DATA CONSISTENCY CHECKS
-- =========================================

-- 6. Referential Integrity Check - Players in Matchups
SELECT 
    'Player Referential Integrity' as check_name,
    COUNT(*) as total_matchup_players,
    COUNT(DISTINCT p1.dg_id) + COUNT(DISTINCT p2.dg_id) + COUNT(DISTINCT p3.dg_id) as valid_player_references,
    CASE 
        WHEN COUNT(*) = (SELECT COUNT(*) FROM matchups_v2 WHERE 
                        player1_dg_id IN (SELECT dg_id FROM players_v2) AND
                        player2_dg_id IN (SELECT dg_id FROM players_v2) AND
                        (player3_dg_id IS NULL OR player3_dg_id IN (SELECT dg_id FROM players_v2))
                       ) THEN '✅ PERFECT'
        ELSE '❌ BROKEN_REFERENCES'
    END as status
FROM matchups_v2 m
LEFT JOIN players_v2 p1 ON m.player1_dg_id = p1.dg_id
LEFT JOIN players_v2 p2 ON m.player2_dg_id = p2.dg_id
LEFT JOIN players_v2 p3 ON m.player3_dg_id = p3.dg_id;

-- 7. Tournament Date Consistency
SELECT 
    'Tournament Date Consistency' as check_name,
    COUNT(*) as total_tournaments,
    COUNT(CASE WHEN start_date <= end_date THEN 1 END) as valid_date_ranges,
    COUNT(CASE WHEN start_date > end_date THEN 1 END) as invalid_date_ranges,
    COUNT(CASE WHEN start_date IS NULL OR end_date IS NULL THEN 1 END) as missing_dates,
    CASE 
        WHEN COUNT(CASE WHEN start_date > end_date THEN 1 END) = 0 AND 
             COUNT(CASE WHEN start_date IS NULL OR end_date IS NULL THEN 1 END) = 0 THEN '✅ PERFECT'
        WHEN COUNT(CASE WHEN start_date > end_date THEN 1 END) > 0 THEN '❌ INVALID_DATES'
        ELSE '⚠️ MISSING_DATES'
    END as status
FROM tournaments_v2;

-- 8. Player Name Consistency Across Tables
SELECT 
    'Player Name Consistency' as check_name,
    COUNT(DISTINCT m.player1_name) + COUNT(DISTINCT m.player2_name) + COUNT(DISTINCT m.player3_name) as matchup_unique_names,
    COUNT(DISTINCT p.name) as player_table_unique_names,
    ABS(COUNT(DISTINCT p.name) - (COUNT(DISTINCT m.player1_name) + COUNT(DISTINCT m.player2_name) + COUNT(DISTINCT m.player3_name))) as name_variance,
    CASE 
        WHEN ABS(COUNT(DISTINCT p.name) - (COUNT(DISTINCT m.player1_name) + COUNT(DISTINCT m.player2_name) + COUNT(DISTINCT m.player3_name))) < 10 THEN '✅ CONSISTENT'
        WHEN ABS(COUNT(DISTINCT p.name) - (COUNT(DISTINCT m.player1_name) + COUNT(DISTINCT m.player2_name) + COUNT(DISTINCT m.player3_name))) < 50 THEN '⚠️ MINOR_VARIATIONS'
        ELSE '❌ MAJOR_INCONSISTENCIES'
    END as status
FROM players_v2 p
CROSS JOIN matchups_v2 m;

-- =========================================
-- DATA FRESHNESS CHECKS
-- =========================================

-- 9. Live Tournament Stats Freshness
SELECT 
    'Live Stats Freshness' as check_name,
    COUNT(*) as total_live_records,
    COUNT(CASE WHEN data_golf_updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as fresh_records,
    COUNT(CASE WHEN data_golf_updated_at < NOW() - INTERVAL '3 days' THEN 1 END) as stale_records,
    ROUND((COUNT(CASE WHEN data_golf_updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) * 100.0 / COUNT(*)), 1) as freshness_percentage,
    CASE 
        WHEN COUNT(CASE WHEN data_golf_updated_at < NOW() - INTERVAL '3 days' THEN 1 END) = 0 THEN '✅ FRESH'
        WHEN COUNT(CASE WHEN data_golf_updated_at < NOW() - INTERVAL '3 days' THEN 1 END) < COUNT(*) * 0.1 THEN '⚠️ MOSTLY_FRESH'
        ELSE '❌ STALE_DATA'
    END as status
FROM live_tournament_stats;

-- 10. Tournament Round Snapshots Data Coverage
SELECT 
    'Snapshot Data Coverage' as check_name,
    COUNT(*) as total_snapshots,
    COUNT(DISTINCT event_id) as unique_tournaments,
    COUNT(CASE WHEN sg_total IS NOT NULL THEN 1 END) as snapshots_with_sg,
    ROUND((COUNT(CASE WHEN sg_total IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)), 1) as sg_coverage_percentage,
    CASE 
        WHEN (COUNT(CASE WHEN sg_total IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)) > 90 THEN '✅ EXCELLENT'
        WHEN (COUNT(CASE WHEN sg_total IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)) > 70 THEN '⚠️ GOOD'
        ELSE '❌ POOR_COVERAGE'
    END as status
FROM tournament_round_snapshots;

-- =========================================
-- DUPLICATE DETECTION QUERIES
-- =========================================

-- 11. Duplicate Players Detection
SELECT 
    'Duplicate Players' as check_name,
    COUNT(*) as total_players,
    COUNT(DISTINCT name) as unique_names,
    COUNT(*) - COUNT(DISTINCT name) as potential_duplicates,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT name) THEN '✅ NO_DUPLICATES'
        WHEN (COUNT(*) - COUNT(DISTINCT name)) < 10 THEN '⚠️ FEW_DUPLICATES'
        ELSE '❌ MANY_DUPLICATES'
    END as status
FROM players_v2;

-- Show potential duplicate names
SELECT 
    'Potential Duplicate Player Names' as check_name,
    name,
    COUNT(*) as occurrence_count
FROM players_v2
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 12. Duplicate Matchups Detection
SELECT 
    'Duplicate Matchups' as check_name,
    COUNT(*) as total_matchups,
    COUNT(DISTINCT (event_id, round_num, player1_dg_id, player2_dg_id, COALESCE(player3_dg_id, -1))) as unique_matchups,
    COUNT(*) - COUNT(DISTINCT (event_id, round_num, player1_dg_id, player2_dg_id, COALESCE(player3_dg_id, -1))) as duplicate_matchups,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT (event_id, round_num, player1_dg_id, player2_dg_id, COALESCE(player3_dg_id, -1))) THEN '✅ NO_DUPLICATES'
        WHEN (COUNT(*) - COUNT(DISTINCT (event_id, round_num, player1_dg_id, player2_dg_id, COALESCE(player3_dg_id, -1)))) < 50 THEN '⚠️ FEW_DUPLICATES'
        ELSE '❌ MANY_DUPLICATES'
    END as status
FROM matchups_v2;

-- =========================================
-- DATA COMPLETENESS SUMMARY
-- =========================================

-- 13. Overall Data Completeness Summary
WITH table_stats AS (
    SELECT 'players_v2' as table_name, COUNT(*) as record_count, 
           ROUND((COUNT(country) * 100.0 / COUNT(*)), 1) as completeness_score FROM players_v2
    UNION ALL
    SELECT 'tournaments_v2', COUNT(*), 
           ROUND((COUNT(course_name) * 100.0 / COUNT(*)), 1) FROM tournaments_v2
    UNION ALL
    SELECT 'tournament_results_v2', COUNT(*), 
           ROUND((COUNT(final_position) * 100.0 / COUNT(*)), 1) FROM tournament_results_v2
    UNION ALL
    SELECT 'matchups_v2', COUNT(*), 
           ROUND((COUNT(fanduel_player1_odds) * 100.0 / COUNT(*)), 1) FROM matchups_v2
    UNION ALL
    SELECT 'courses_v2', COUNT(*), 100.0 FROM courses_v2
)
SELECT 
    table_name,
    record_count,
    completeness_score,
    CASE 
        WHEN completeness_score > 90 THEN '✅ EXCELLENT'
        WHEN completeness_score > 70 THEN '⚠️ GOOD'
        WHEN completeness_score > 50 THEN '⚠️ NEEDS_WORK'
        ELSE '❌ CRITICAL'
    END as status
FROM table_stats
ORDER BY completeness_score DESC;

-- =========================================
-- MIGRATION READINESS ASSESSMENT
-- =========================================

-- 14. Migration Readiness Check
WITH readiness_checks AS (
    SELECT 
        'Tournament Results' as component,
        CASE WHEN (SELECT COUNT(final_position) * 100.0 / COUNT(*) FROM tournament_results_v2) > 80 THEN 1 ELSE 0 END as ready
    UNION ALL
    SELECT 
        'Course Data',
        CASE WHEN (SELECT COUNT(*) FROM courses_v2) > 10 THEN 1 ELSE 0 END
    UNION ALL
    SELECT 
        'Player Nationality',
        CASE WHEN (SELECT COUNT(country) * 100.0 / COUNT(*) FROM players_v2) > 95 THEN 1 ELSE 0 END
    UNION ALL
    SELECT 
        'Odds Coverage',
        CASE WHEN (SELECT COUNT(fanduel_player1_odds) * 100.0 / COUNT(*) FROM matchups_v2) > 80 THEN 1 ELSE 0 END
    UNION ALL
    SELECT 
        'Data Freshness',
        CASE WHEN (SELECT COUNT(CASE WHEN data_golf_updated_at < NOW() - INTERVAL '3 days' THEN 1 END) FROM live_tournament_stats) = 0 THEN 1 ELSE 0 END
)
SELECT 
    component,
    CASE WHEN ready = 1 THEN '✅ READY' ELSE '❌ NOT_READY' END as status,
    ready
FROM readiness_checks;

-- Overall migration readiness
SELECT 
    'OVERALL MIGRATION READINESS' as assessment,
    COUNT(*) as total_checks,
    SUM(ready) as passed_checks,
    ROUND((SUM(ready) * 100.0 / COUNT(*)), 1) as readiness_percentage,
    CASE 
        WHEN (SUM(ready) * 100.0 / COUNT(*)) = 100 THEN '✅ READY_TO_MIGRATE'
        WHEN (SUM(ready) * 100.0 / COUNT(*)) >= 80 THEN '⚠️ MOSTLY_READY'
        WHEN (SUM(ready) * 100.0 / COUNT(*)) >= 60 THEN '⚠️ NEEDS_WORK'
        ELSE '❌ NOT_READY'
    END as overall_status
FROM (
    SELECT 
        CASE WHEN (SELECT COUNT(final_position) * 100.0 / COUNT(*) FROM tournament_results_v2) > 80 THEN 1 ELSE 0 END as ready
    UNION ALL
    SELECT CASE WHEN (SELECT COUNT(*) FROM courses_v2) > 10 THEN 1 ELSE 0 END
    UNION ALL
    SELECT CASE WHEN (SELECT COUNT(country) * 100.0 / COUNT(*) FROM players_v2) > 95 THEN 1 ELSE 0 END
    UNION ALL
    SELECT CASE WHEN (SELECT COUNT(fanduel_player1_odds) * 100.0 / COUNT(*) FROM matchups_v2) > 80 THEN 1 ELSE 0 END
    UNION ALL
    SELECT CASE WHEN (SELECT COUNT(CASE WHEN data_golf_updated_at < NOW() - INTERVAL '3 days' THEN 1 END) FROM live_tournament_stats) = 0 THEN 1 ELSE 0 END
) as checks;

-- =========================================
-- USAGE INSTRUCTIONS
-- =========================================

/*
HOW TO USE THESE QUERIES:

1. PRE-MIGRATION VALIDATION:
   Run all queries to establish baseline data quality metrics
   Focus on queries 1-3 (Critical Issues) - these must be resolved before migration
   
2. ONGOING MONITORING:
   Run queries 9-10 (Data Freshness) daily during active tournaments
   Run queries 4-8 (Data Consistency) weekly
   Run query 14 (Migration Readiness) before any migration attempt

3. POST-REMEDIATION VALIDATION:
   After fixing data quality issues, re-run all queries to confirm improvements
   Pay special attention to the Overall Migration Readiness assessment
   
4. ALERTING THRESHOLDS:
   Set up alerts when:
   - Tournament results completion < 90%
   - Live stats are stale (> 3 days old)
   - Referential integrity issues detected
   - Duplicate records appear

5. PERFORMANCE NOTES:
   - Queries 1-10 should run in < 5 seconds each
   - Query 13-14 may take 10-30 seconds due to complex aggregations
   - Consider creating indexes if performance degrades

Remember: These queries are designed to be run against your current database schema.
After migration to the new AI-optimized schema, you'll need updated versions.
*/