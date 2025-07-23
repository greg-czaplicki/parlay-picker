-- =============================================
-- MIGRATION VALIDATION AND VERIFICATION SCRIPT
-- =============================================
-- This script performs comprehensive validation of the data migration
-- to ensure data integrity, completeness, and correctness
-- Generated: July 23, 2025

-- =============================================
-- VALIDATION SETUP
-- =============================================

-- Create validation results table
CREATE TEMP TABLE validation_results (
    validation_name VARCHAR(100) PRIMARY KEY,
    status VARCHAR(20) NOT NULL,
    expected_value NUMERIC,
    actual_value NUMERIC,
    variance_percent DECIMAL(6,2),
    details TEXT,
    severity VARCHAR(20) DEFAULT 'medium',
    passed BOOLEAN GENERATED ALWAYS AS (status = 'PASS') STORED
);

-- Log validation start
INSERT INTO migration_log (migration_step, status, details) 
VALUES ('data_validation', 'started', '{"script": "03-validation-and-verification.sql"}');

-- =============================================
-- PHASE 1: RECORD COUNT VALIDATION
-- =============================================

-- Players migration validation
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, variance_percent, details, severity)
SELECT 
    'players_count_validation',
    CASE WHEN variance <= 5 THEN 'PASS' ELSE 'FAIL' END,
    source_count,
    target_count,
    variance,
    CASE 
        WHEN variance <= 5 THEN 'Player migration successful within acceptable variance'
        ELSE 'Significant discrepancy in player count - investigation required'
    END,
    CASE WHEN variance <= 5 THEN 'low' ELSE 'high' END
FROM (
    SELECT 
        (SELECT COUNT(*) FROM players_v2) as source_count,
        (SELECT COUNT(*) FROM players WHERE 'legacy_migration' = ANY(data_sources)) as target_count,
        ABS(
            ((SELECT COUNT(*) FROM players WHERE 'legacy_migration' = ANY(data_sources)) - 
             (SELECT COUNT(*) FROM players_v2)::NUMERIC) * 100.0 / 
            (SELECT COUNT(*) FROM players_v2)
        ) as variance
) counts;

-- Tournaments migration validation
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, variance_percent, details, severity)
SELECT 
    'tournaments_count_validation',
    CASE WHEN variance <= 5 THEN 'PASS' ELSE 'FAIL' END,
    source_count,
    target_count,
    variance,
    CASE 
        WHEN variance <= 5 THEN 'Tournament migration successful within acceptable variance'
        ELSE 'Significant discrepancy in tournament count - investigation required'
    END,
    CASE WHEN variance <= 5 THEN 'low' ELSE 'high' END
FROM (
    SELECT 
        (SELECT COUNT(*) FROM tournaments_v2) as source_count,
        (SELECT COUNT(*) FROM tournaments) as target_count,
        ABS(
            ((SELECT COUNT(*) FROM tournaments) - (SELECT COUNT(*) FROM tournaments_v2)::NUMERIC) * 100.0 / 
            (SELECT COUNT(*) FROM tournaments_v2)
        ) as variance
) counts;

-- Course reconstruction validation
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, variance_percent, details, severity)
SELECT 
    'courses_reconstruction_validation',
    CASE WHEN target_count >= expected_count THEN 'PASS' ELSE 'FAIL' END,
    expected_count,
    target_count,
    ((target_count - expected_count) * 100.0 / GREATEST(expected_count, 1)) as variance,
    CASE 
        WHEN target_count >= expected_count THEN 'Course reconstruction successful - created courses from tournament data'
        ELSE 'Course reconstruction incomplete - fewer courses than unique tournament venues'
    END,
    'high'
FROM (
    SELECT 
        (SELECT COUNT(DISTINCT course_name) FROM tournaments_v2 WHERE course_name IS NOT NULL) as expected_count,
        (SELECT COUNT(*) FROM courses) as target_count
) counts;

-- Tournament rounds validation (complex due to multiple sources)
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, variance_percent, details, severity)
SELECT 
    'tournament_rounds_coverage',
    CASE WHEN target_count >= min_expected THEN 'PASS' ELSE 'FAIL' END,
    min_expected,
    target_count,
    ((target_count - min_expected) * 100.0 / GREATEST(min_expected, 1)) as variance,
    'Tournament rounds from multiple sources: ' || 
    (SELECT COUNT(*) FROM tournament_rounds WHERE data_source = 'tournament_round_snapshots') || ' from snapshots, ' ||
    (SELECT COUNT(*) FROM tournament_rounds WHERE data_source = 'tournament_results_v2') || ' from results, ' ||
    (SELECT COUNT(*) FROM tournament_rounds WHERE data_source = 'live_tournament_stats') || ' from live stats',
    'medium'
FROM (
    SELECT 
        -- Minimum expected is from round snapshots (our best source)
        (SELECT COUNT(*) FROM tournament_round_snapshots WHERE round_num ~ '^[0-9]+$') as min_expected,
        (SELECT COUNT(*) FROM tournament_rounds) as target_count
) counts;

-- =============================================
-- PHASE 2: DATA INTEGRITY VALIDATION
-- =============================================

-- Foreign key integrity validation
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, details, severity)
SELECT 
    'foreign_key_integrity',
    CASE WHEN orphan_count = 0 THEN 'PASS' ELSE 'FAIL' END,
    0,
    orphan_count,
    'Foreign key validation: ' || orphan_count || ' orphaned records found',
    CASE WHEN orphan_count = 0 THEN 'low' ELSE 'critical' END
FROM (
    SELECT 
        (
            -- Check tournament_rounds -> tournaments
            (SELECT COUNT(*) FROM tournament_rounds tr 
             WHERE NOT EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tr.tournament_id)) +
            -- Check tournament_rounds -> players  
            (SELECT COUNT(*) FROM tournament_rounds tr 
             WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = tr.player_id)) +
            -- Check tournaments -> courses (allow NULL)
            (SELECT COUNT(*) FROM tournaments t 
             WHERE t.course_id IS NOT NULL 
             AND NOT EXISTS (SELECT 1 FROM courses c WHERE c.id = t.course_id)) +
            -- Check betting_markets -> tournaments
            (SELECT COUNT(*) FROM betting_markets bm 
             WHERE NOT EXISTS (SELECT 1 FROM tournaments t WHERE t.id = bm.tournament_id)) +
            -- Check odds_history -> betting_markets
            (SELECT COUNT(*) FROM odds_history oh 
             WHERE NOT EXISTS (SELECT 1 FROM betting_markets bm WHERE bm.id = oh.market_id))
        ) as orphan_count
) integrity;

-- Data type and constraint validation
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, details, severity)
SELECT 
    'data_constraints_validation',
    CASE WHEN violation_count = 0 THEN 'PASS' ELSE 'FAIL' END,
    0,
    violation_count,
    'Data constraint violations found: ' || violation_count,
    CASE WHEN violation_count = 0 THEN 'low' ELSE 'high' END
FROM (
    SELECT 
        (
            -- Invalid scores in tournament_rounds
            (SELECT COUNT(*) FROM tournament_rounds WHERE strokes < 50 OR strokes > 100) +
            -- Invalid round numbers
            (SELECT COUNT(*) FROM tournament_rounds WHERE round_number NOT BETWEEN 1 AND 4) +
            -- Invalid dates (rounds before tournament start)
            (SELECT COUNT(*) FROM tournament_rounds tr 
             JOIN tournaments t ON tr.tournament_id = t.id 
             WHERE tr.round_date < t.start_date) +
            -- Invalid odds (negative or too extreme)
            (SELECT COUNT(*) FROM odds_history WHERE decimal_odds <= 1.0 OR decimal_odds > 1000) +
            -- Invalid probabilities
            (SELECT COUNT(*) FROM odds_history WHERE implied_probability <= 0 OR implied_probability > 1)
        ) as violation_count
) constraints;

-- =============================================
-- PHASE 3: BUSINESS LOGIC VALIDATION
-- =============================================

-- Tournament status consistency validation
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, details, severity)
SELECT 
    'tournament_status_consistency',
    CASE WHEN inconsistent_count = 0 THEN 'PASS' ELSE 'WARN' END,
    0,
    inconsistent_count,
    'Tournaments with inconsistent status: ' || inconsistent_count || ' (may be acceptable for ongoing tournaments)',
    'medium'
FROM (
    SELECT COUNT(*) as inconsistent_count
    FROM tournaments 
    WHERE 
        (status = 'completed' AND end_date > CURRENT_DATE) OR
        (status = 'upcoming' AND start_date < CURRENT_DATE)
) status_check;

-- Player name consistency across sources
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, details, severity)
SELECT 
    'player_name_consistency',
    CASE WHEN name_mismatches <= 10 THEN 'PASS' ELSE 'WARN' END,
    0,
    name_mismatches,
    'Player name variations found: ' || name_mismatches || ' (may require cleanup)',
    'low'
FROM (
    SELECT COUNT(*) as name_mismatches
    FROM (
        SELECT p.name, COUNT(DISTINCT TRIM(LOWER(p.name))) as variations
        FROM players p
        GROUP BY p.dg_id
        HAVING COUNT(DISTINCT TRIM(LOWER(p.name))) > 1
    ) name_check
) name_validation;

-- Strokes Gained data quality validation
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, details, severity)
SELECT 
    'strokes_gained_quality',
    CASE WHEN sg_coverage >= 70 THEN 'PASS' ELSE 'WARN' END,
    70.0,
    sg_coverage,
    'Strokes Gained coverage: ' || ROUND(sg_coverage, 1) || '% of rounds have SG data',
    CASE WHEN sg_coverage >= 70 THEN 'low' ELSE 'medium' END
FROM (
    SELECT 
        (COUNT(CASE WHEN sg_total IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)) as sg_coverage
    FROM tournament_rounds
) sg_check;

-- =============================================
-- PHASE 4: PERFORMANCE AND COMPLETENESS VALIDATION
-- =============================================

-- Course association improvement validation
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, details, severity)
SELECT 
    'course_association_improvement',
    CASE WHEN improvement >= 90 THEN 'PASS' ELSE 'FAIL' END,
    90.0,
    improvement,
    'Course association improvement: from ' || old_coverage || '% to ' || new_coverage || '%',
    'high'
FROM (
    SELECT 
        -- Old coverage (from original audit)
        1.2 as old_coverage, -- 1.2% had course association before
        -- New coverage
        (COUNT(CASE WHEN course_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)) as new_coverage,
        -- Improvement calculation
        ((COUNT(CASE WHEN course_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)) - 1.2) as improvement
    FROM tournaments
) course_improvement;

-- Betting data migration completeness
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, details, severity)
SELECT 
    'betting_data_completeness',
    CASE WHEN migration_rate >= 85 THEN 'PASS' ELSE 'WARN' END,
    85.0,
    migration_rate,
    'Betting markets migrated: ' || (SELECT COUNT(*) FROM betting_markets) || ' markets, ' ||
    'Odds records: ' || (SELECT COUNT(*) FROM odds_history WHERE data_source = 'matchups_v2_migration'),
    'medium'
FROM (
    SELECT 
        (SELECT COUNT(*) FROM betting_markets) * 100.0 / 
        GREATEST((SELECT COUNT(DISTINCT (event_id, round_num, player1_dg_id, player2_dg_id)) FROM matchups_v2), 1) as migration_rate
) betting_check;

-- Data source distribution validation
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, details, severity)
SELECT 
    'data_source_distribution',
    'INFO',
    NULL,
    NULL,
    'Tournament rounds by source: ' ||
    'Snapshots=' || COALESCE((SELECT COUNT(*) FROM tournament_rounds WHERE data_source = 'tournament_round_snapshots'), 0) || ', ' ||
    'Results=' || COALESCE((SELECT COUNT(*) FROM tournament_rounds WHERE data_source = 'tournament_results_v2'), 0) || ', ' ||
    'Live=' || COALESCE((SELECT COUNT(*) FROM tournament_rounds WHERE data_source = 'live_tournament_stats'), 0),
    'info'
FROM (SELECT 1) info_check;

-- =============================================
-- PHASE 5: AI/ML READINESS VALIDATION
-- =============================================

-- Vector embedding readiness
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, details, severity)
SELECT 
    'ai_infrastructure_readiness',
    CASE WHEN vector_support = 1 THEN 'PASS' ELSE 'FAIL' END,
    1,
    vector_support,
    'Vector extension available: ' || CASE WHEN vector_support = 1 THEN 'YES' ELSE 'NO' END ||
    ', TimescaleDB active: ' || CASE WHEN timescale_support = 1 THEN 'YES' ELSE 'NO' END,
    'medium'
FROM (
    SELECT 
        CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN 1 ELSE 0 END as vector_support,
        CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN 1 ELSE 0 END as timescale_support
) ai_check;

-- Hypertable creation validation
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, details, severity)
SELECT 
    'hypertable_creation',
    CASE WHEN hypertable_count >= 3 THEN 'PASS' ELSE 'FAIL' END,
    3,
    hypertable_count,
    'TimescaleDB hypertables created: ' || hypertable_count || ' (tournament_rounds, odds_history, etc.)',
    'medium'
FROM (
    SELECT COUNT(*) as hypertable_count
    FROM timescaledb_information.hypertables 
    WHERE hypertable_schema = 'public'
) hypertable_check;

-- Feature engineering readiness
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, details, severity)
SELECT 
    'feature_engineering_readiness',
    CASE WHEN complete_rounds >= 1000 THEN 'PASS' ELSE 'WARN' END,
    1000,
    complete_rounds,
    'Complete rounds available for ML: ' || complete_rounds || ' (with SG data for feature engineering)',
    CASE WHEN complete_rounds >= 1000 THEN 'low' ELSE 'medium' END
FROM (
    SELECT COUNT(*) as complete_rounds
    FROM tournament_rounds 
    WHERE sg_total IS NOT NULL 
    AND strokes IS NOT NULL 
    AND round_number IS NOT NULL
) feature_check;

-- =============================================
-- PHASE 6: MIGRATION LOG ANALYSIS
-- =============================================

-- Migration step completion validation
INSERT INTO validation_results (validation_name, status, expected_value, actual_value, details, severity)
SELECT 
    'migration_steps_completion',
    CASE WHEN failed_steps = 0 THEN 'PASS' ELSE 'FAIL' END,
    0,
    failed_steps,
    'Migration steps status: ' || completed_steps || ' completed, ' || failed_steps || ' failed',
    CASE WHEN failed_steps = 0 THEN 'low' ELSE 'critical' END
FROM (
    SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_steps,
        COUNT(CASE WHEN status IN ('failed', 'error') THEN 1 END) as failed_steps
    FROM migration_log
    WHERE migration_step != 'data_validation' -- Exclude current validation step
) migration_status;

-- =============================================
-- VALIDATION SUMMARY AND REPORTING
-- =============================================

-- Create validation summary
CREATE TEMP VIEW validation_summary AS
SELECT 
    severity,
    COUNT(*) as total_checks,
    COUNT(CASE WHEN passed THEN 1 END) as passed_checks,
    COUNT(CASE WHEN NOT passed THEN 1 END) as failed_checks,
    ROUND(COUNT(CASE WHEN passed THEN 1 END) * 100.0 / COUNT(*), 1) as pass_rate
FROM validation_results
GROUP BY severity
ORDER BY 
    CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        WHEN 'info' THEN 5 
    END;

-- Overall validation status
CREATE TEMP VIEW overall_validation_status AS
SELECT 
    COUNT(*) as total_validations,
    COUNT(CASE WHEN passed THEN 1 END) as passed_validations,
    COUNT(CASE WHEN NOT passed AND severity IN ('critical', 'high') THEN 1 END) as critical_failures,
    ROUND(COUNT(CASE WHEN passed THEN 1 END) * 100.0 / COUNT(*), 1) as overall_pass_rate,
    CASE 
        WHEN COUNT(CASE WHEN NOT passed AND severity = 'critical' THEN 1 END) > 0 THEN 'CRITICAL_ISSUES'
        WHEN COUNT(CASE WHEN NOT passed AND severity = 'high' THEN 1 END) > 0 THEN 'HIGH_PRIORITY_ISSUES'
        WHEN COUNT(CASE WHEN NOT passed THEN 1 END) > 0 THEN 'MINOR_ISSUES'
        WHEN COUNT(CASE WHEN passed THEN 1 END) = COUNT(*) THEN 'ALL_VALIDATIONS_PASSED'
        ELSE 'UNKNOWN_STATUS'
    END as validation_status
FROM validation_results;

-- =============================================
-- VALIDATION RESULTS OUTPUT
-- =============================================

-- Display validation summary by severity
SELECT 
    'VALIDATION SUMMARY BY SEVERITY' as report_section,
    severity,
    total_checks,
    passed_checks,
    failed_checks,
    pass_rate || '%' as pass_rate
FROM validation_summary;

-- Display failed validations with details
SELECT 
    'FAILED VALIDATIONS DETAILS' as report_section,
    validation_name,
    status,
    severity,
    details
FROM validation_results 
WHERE NOT passed
ORDER BY 
    CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
    END,
    validation_name;

-- Overall migration validation status
SELECT 
    'OVERALL MIGRATION VALIDATION STATUS' as report_section,
    validation_status,
    total_validations,
    passed_validations,
    critical_failures,
    overall_pass_rate || '%' as overall_pass_rate,
    CASE validation_status
        WHEN 'ALL_VALIDATIONS_PASSED' THEN '✅ Migration validation successful - ready for production!'
        WHEN 'MINOR_ISSUES' THEN '⚠️ Migration completed with minor issues - review recommended'
        WHEN 'HIGH_PRIORITY_ISSUES' THEN '⚠️ Migration completed with high-priority issues - fixes required'
        WHEN 'CRITICAL_ISSUES' THEN '❌ Critical validation failures - migration rollback recommended'
        ELSE '❓ Unknown validation status - review required'
    END as recommendation
FROM overall_validation_status;

-- Detailed validation results for audit trail
SELECT 
    'COMPLETE VALIDATION RESULTS' as report_section,
    validation_name,
    status,
    severity,
    expected_value,
    actual_value,
    variance_percent,
    details,
    passed
FROM validation_results
ORDER BY 
    CASE severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        WHEN 'info' THEN 5 
    END,
    validation_name;

-- Update migration log with validation results
UPDATE migration_log 
SET status = 'completed', completed_at = NOW(),
    details = details || jsonb_build_object(
        'total_validations', (SELECT total_validations FROM overall_validation_status),
        'passed_validations', (SELECT passed_validations FROM overall_validation_status),
        'critical_failures', (SELECT critical_failures FROM overall_validation_status),
        'overall_pass_rate', (SELECT overall_pass_rate FROM overall_validation_status),
        'validation_status', (SELECT validation_status FROM overall_validation_status),
        'validation_summary', (
            SELECT jsonb_object_agg(severity, jsonb_build_object(
                'total_checks', total_checks,
                'passed_checks', passed_checks,
                'failed_checks', failed_checks,
                'pass_rate', pass_rate
            ))
            FROM validation_summary
        )
    )
WHERE migration_step = 'data_validation' AND status = 'started';

-- Final validation message
SELECT 
    'MIGRATION VALIDATION COMPLETED' as final_status,
    (SELECT validation_status FROM overall_validation_status) as result,
    (SELECT overall_pass_rate || '%' FROM overall_validation_status) as success_rate,
    NOW() as completed_at;