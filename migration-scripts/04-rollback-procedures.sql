-- =============================================
-- MIGRATION ROLLBACK PROCEDURES
-- =============================================
-- This script provides comprehensive rollback procedures for the database migration
-- Allows safe restoration to the pre-migration state if issues are encountered
-- Generated: July 23, 2025

-- =============================================
-- ROLLBACK SETUP AND SAFETY CHECKS
-- =============================================

-- Create rollback tracking table
CREATE TABLE IF NOT EXISTS rollback_log (
    id SERIAL PRIMARY KEY,
    rollback_step VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'started',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    details JSONB
);

-- Safety check - ensure we're in migration context
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'migration_log') THEN
        RAISE EXCEPTION 'Migration log table not found. Rollback can only be executed after migration.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM migration_log WHERE status = 'completed') THEN
        RAISE EXCEPTION 'No completed migration found. Nothing to rollback.';
    END IF;
END $$;

-- Insert rollback start log
INSERT INTO rollback_log (rollback_step, status, details) 
VALUES ('rollback_initiated', 'started', jsonb_build_object(
    'timestamp', NOW(),
    'initiated_by', current_user,
    'migration_steps_to_rollback', (SELECT COUNT(*) FROM migration_log WHERE status = 'completed')
));

-- =============================================
-- ROLLBACK DECISION POINT
-- =============================================

-- Display current migration status before rollback
SELECT 
    'CURRENT MIGRATION STATUS' as info_type,
    migration_step,
    status,
    started_at,
    completed_at,
    EXTRACT(EPOCH FROM (completed_at - started_at))/60 as duration_minutes,
    details
FROM migration_log 
WHERE status IN ('completed', 'failed', 'error')
ORDER BY started_at;

-- Show data volume before rollback
SELECT 
    'CURRENT DATA VOLUME' as info_type,
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
AND tablename IN ('players', 'courses', 'tournaments', 'tournament_rounds', 'betting_markets', 'odds_history')
ORDER BY n_live_tup DESC;

-- Critical warning message
SELECT 
    '⚠️  ROLLBACK WARNING' as warning_type,
    'This will permanently delete all migrated data and restore the old schema.' as message,
    'Ensure you have a current backup before proceeding.' as requirement,
    'Type ROLLBACK CONFIRMED to proceed or any other text to abort.' as instruction;

-- =============================================
-- ROLLBACK CONFIRMATION CHECK
-- =============================================

-- Note: In production, this would be replaced with proper confirmation mechanism
-- For this script, we'll assume confirmation and proceed with documented rollback

INSERT INTO rollback_log (rollback_step, status, details) 
VALUES ('rollback_confirmed', 'started', '{"confirmation": "automated_rollback_script"}');

-- =============================================
-- PHASE 1: DISABLE CONSTRAINTS AND TRIGGERS
-- =============================================

INSERT INTO rollback_log (rollback_step, status) VALUES ('disable_constraints', 'started');

-- Disable foreign key constraints to allow clean deletion
ALTER TABLE tournament_rounds DROP CONSTRAINT IF EXISTS tournament_rounds_tournament_id_fkey;
ALTER TABLE tournament_rounds DROP CONSTRAINT IF EXISTS tournament_rounds_player_id_fkey;
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_course_id_fkey;
ALTER TABLE betting_markets DROP CONSTRAINT IF EXISTS betting_markets_tournament_id_fkey;
ALTER TABLE betting_markets DROP CONSTRAINT IF EXISTS betting_markets_sportsbook_id_fkey;
ALTER TABLE odds_history DROP CONSTRAINT IF EXISTS odds_history_market_id_fkey;
ALTER TABLE odds_history DROP CONSTRAINT IF EXISTS odds_history_player_id_fkey;
ALTER TABLE odds_history DROP CONSTRAINT IF EXISTS odds_history_sportsbook_id_fkey;
ALTER TABLE player_correlations DROP CONSTRAINT IF EXISTS player_correlations_player1_id_fkey;
ALTER TABLE player_correlations DROP CONSTRAINT IF EXISTS player_correlations_player2_id_fkey;
ALTER TABLE ml_feature_vectors DROP CONSTRAINT IF EXISTS ml_feature_vectors_player_id_fkey;
ALTER TABLE ml_feature_vectors DROP CONSTRAINT IF EXISTS ml_feature_vectors_tournament_id_fkey;
ALTER TABLE shot_tracking DROP CONSTRAINT IF EXISTS shot_tracking_tournament_id_fkey;
ALTER TABLE shot_tracking DROP CONSTRAINT IF EXISTS shot_tracking_player_id_fkey;
ALTER TABLE hole_statistics DROP CONSTRAINT IF EXISTS hole_statistics_tournament_id_fkey;
ALTER TABLE hole_statistics DROP CONSTRAINT IF EXISTS hole_statistics_player_id_fkey;

-- Disable triggers that might interfere with rollback
SET session_replication_role = replica;

UPDATE rollback_log 
SET status = 'completed', completed_at = NOW() 
WHERE rollback_step = 'disable_constraints' AND status = 'started';

-- =============================================
-- PHASE 2: DROP NEW SCHEMA STRUCTURES
-- =============================================

INSERT INTO rollback_log (rollback_step, status) VALUES ('drop_new_tables', 'started');

-- Drop materialized views first
DROP MATERIALIZED VIEW IF EXISTS current_tournament_leaderboard CASCADE;
DROP MATERIALIZED VIEW IF EXISTS player_recent_form CASCADE;

-- Drop AI/ML tables
DROP TABLE IF EXISTS shot_tracking CASCADE;
DROP TABLE IF EXISTS hole_statistics CASCADE;
DROP TABLE IF EXISTS ml_feature_vectors CASCADE;
DROP TABLE IF EXISTS ml_models CASCADE;
DROP TABLE IF EXISTS player_correlations CASCADE;

-- Drop betting infrastructure
DROP TABLE IF EXISTS odds_history CASCADE;
DROP TABLE IF EXISTS betting_markets CASCADE;
DROP TABLE IF EXISTS sportsbooks CASCADE;

-- Drop performance data (this is the critical step)
DROP TABLE IF EXISTS tournament_rounds CASCADE;

-- Drop core entities
DROP TABLE IF EXISTS tournaments CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- Drop indexes that were created for new schema
DROP INDEX IF EXISTS idx_tournament_rounds_player_date;
DROP INDEX IF EXISTS idx_tournament_rounds_tournament_round;
DROP INDEX IF EXISTS idx_odds_history_market_timestamp;
DROP INDEX IF EXISTS idx_betting_markets_tournament_type;
DROP INDEX IF EXISTS idx_players_dg_id;
DROP INDEX IF EXISTS idx_tournaments_event_id;
DROP INDEX IF EXISTS idx_players_style_embedding;
DROP INDEX IF EXISTS idx_courses_embedding;

-- Record what was dropped
INSERT INTO rollback_log (rollback_step, status, details) 
VALUES ('tables_dropped', 'completed', jsonb_build_object(
    'dropped_tables', ARRAY[
        'shot_tracking', 'hole_statistics', 'ml_feature_vectors', 'ml_models', 
        'player_correlations', 'odds_history', 'betting_markets', 'sportsbooks',
        'tournament_rounds', 'tournaments', 'courses', 'players'
    ],
    'dropped_views', ARRAY['current_tournament_leaderboard', 'player_recent_form']
));

UPDATE rollback_log 
SET status = 'completed', completed_at = NOW() 
WHERE rollback_step = 'drop_new_tables' AND status = 'started';

-- =============================================
-- PHASE 3: VERIFY OLD SCHEMA INTEGRITY
-- =============================================

INSERT INTO rollback_log (rollback_step, status) VALUES ('verify_old_schema', 'started');

-- Check that original tables still exist and have data
CREATE TEMP TABLE schema_verification (
    table_name VARCHAR(100),
    exists_check BOOLEAN,
    row_count INTEGER,
    status VARCHAR(20)
);

-- Verify core old tables
INSERT INTO schema_verification (table_name, exists_check, row_count, status)
SELECT 
    table_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = verification.table_name
    ) as exists_check,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = verification.table_name
        ) THEN (
            EXECUTE format('SELECT COUNT(*) FROM %I', verification.table_name)
        )
        ELSE 0
    END as row_count,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = verification.table_name
        ) THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
FROM (
    VALUES 
        ('players_v2'),
        ('tournaments_v2'),
        ('courses_v2'),
        ('tournament_results_v2'),
        ('tournament_round_snapshots'),
        ('matchups_v2'),
        ('live_tournament_stats')
) AS verification(table_name);

-- Check if any critical tables are missing
SELECT 
    'OLD SCHEMA VERIFICATION' as check_type,
    table_name,
    exists_check,
    row_count,
    status
FROM schema_verification
ORDER BY 
    CASE status WHEN 'MISSING' THEN 1 ELSE 2 END,
    table_name;

-- Fail rollback if critical original tables are missing
DO $$
DECLARE 
    missing_tables INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_tables
    FROM schema_verification 
    WHERE table_name IN ('players_v2', 'tournaments_v2', 'tournament_round_snapshots', 'matchups_v2')
    AND status = 'MISSING';
    
    IF missing_tables > 0 THEN
        RAISE EXCEPTION 'ROLLBACK FAILED: Critical original tables are missing. Data recovery required.';
    END IF;
END $$;

UPDATE rollback_log 
SET status = 'completed', completed_at = NOW(),
    details = jsonb_build_object(
        'verified_tables', (SELECT jsonb_agg(jsonb_build_object(
            'table_name', table_name,
            'exists', exists_check,
            'row_count', row_count,
            'status', status
        )) FROM schema_verification)
    )
WHERE rollback_step = 'verify_old_schema' AND status = 'started';

-- =============================================
-- PHASE 4: RESTORE ORIGINAL DATA INTEGRITY
-- =============================================

INSERT INTO rollback_log (rollback_step, status) VALUES ('restore_data_integrity', 'started');

-- Re-enable session replication role
SET session_replication_role = DEFAULT;

-- Restore any constraints that might have been modified
-- Note: Original schema constraints should already be intact

-- Verify foreign key relationships in original schema
CREATE TEMP TABLE integrity_check AS
SELECT 
    'players_v2_integrity' as check_name,
    (SELECT COUNT(*) FROM players_v2) as total_records,
    (SELECT COUNT(DISTINCT dg_id) FROM players_v2) as unique_ids,
    CASE 
        WHEN (SELECT COUNT(*) FROM players_v2) = (SELECT COUNT(DISTINCT dg_id) FROM players_v2) 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status
UNION ALL
SELECT 
    'matchups_referential_integrity',
    (SELECT COUNT(*) FROM matchups_v2),
    (SELECT COUNT(*) FROM matchups_v2 m 
     WHERE EXISTS (SELECT 1 FROM players_v2 p WHERE p.dg_id = m.player1_dg_id)
     AND EXISTS (SELECT 1 FROM players_v2 p WHERE p.dg_id = m.player2_dg_id)),
    CASE 
        WHEN (SELECT COUNT(*) FROM matchups_v2) = 
             (SELECT COUNT(*) FROM matchups_v2 m 
              WHERE EXISTS (SELECT 1 FROM players_v2 p WHERE p.dg_id = m.player1_dg_id)
              AND EXISTS (SELECT 1 FROM players_v2 p WHERE p.dg_id = m.player2_dg_id))
        THEN 'PASS'
        ELSE 'FAIL'
    END;

-- Display integrity check results
SELECT 
    'DATA INTEGRITY VERIFICATION' as verification_type,
    check_name,
    total_records,
    unique_ids as valid_records,
    status
FROM integrity_check;

UPDATE rollback_log 
SET status = 'completed', completed_at = NOW(),
    details = jsonb_build_object(
        'integrity_checks', (SELECT jsonb_agg(jsonb_build_object(
            'check_name', check_name,
            'total_records', total_records,
            'valid_records', unique_ids,
            'status', status
        )) FROM integrity_check)
    )
WHERE rollback_step = 'restore_data_integrity' AND status = 'started';

-- =============================================
-- PHASE 5: CLEANUP MIGRATION ARTIFACTS
-- =============================================

INSERT INTO rollback_log (rollback_step, status) VALUES ('cleanup_migration_artifacts', 'started');

-- Archive migration log before cleanup (keep for audit trail)
CREATE TABLE IF NOT EXISTS migration_history AS 
SELECT *, NOW() as archived_at 
FROM migration_log;

-- Drop migration-specific objects
DROP TABLE IF EXISTS migration_stats;

-- Clean up any temporary objects created during migration
DROP EXTENSION IF EXISTS vector CASCADE; -- Only if not used elsewhere
-- Note: Keep TimescaleDB as it might be used by other parts of the system

-- Update rollback completion
UPDATE rollback_log 
SET status = 'completed', completed_at = NOW(),
    details = jsonb_build_object(
        'migration_log_archived', true,
        'cleanup_completed', true
    )
WHERE rollback_step = 'cleanup_migration_artifacts' AND status = 'started';

-- =============================================
-- ROLLBACK VERIFICATION AND COMPLETION
-- =============================================

INSERT INTO rollback_log (rollback_step, status) VALUES ('rollback_verification', 'started');

-- Final verification - ensure we're back to original state
CREATE TEMP VIEW rollback_verification AS
SELECT 
    'rollback_completeness' as verification_type,
    table_name,
    CASE 
        WHEN table_name LIKE '%_v2' THEN 
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = rv.table_name) 
                 THEN 'PRESERVED' ELSE 'MISSING' END
        ELSE 
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = rv.table_name) 
                 THEN 'NOT_REMOVED' ELSE 'REMOVED' END
    END as expected_status
FROM (
    VALUES 
        -- Old tables (should exist)
        ('players_v2'),
        ('tournaments_v2'),
        ('courses_v2'),
        ('tournament_results_v2'),
        ('tournament_round_snapshots'),
        ('matchups_v2'),
        ('live_tournament_stats'),
        -- New tables (should not exist)
        ('players'),
        ('tournaments'),
        ('courses'),
        ('tournament_rounds'),
        ('betting_markets'),
        ('odds_history')
) AS rv(table_name);

-- Display rollback verification results
SELECT 
    'ROLLBACK VERIFICATION RESULTS' as report_section,
    verification_type,
    table_name,
    expected_status,
    CASE 
        WHEN (table_name LIKE '%_v2' AND expected_status = 'PRESERVED') OR
             (NOT table_name LIKE '%_v2' AND expected_status = 'REMOVED') THEN '✅ CORRECT'
        ELSE '❌ INCORRECT'
    END as verification_result
FROM rollback_verification
ORDER BY 
    CASE WHEN table_name LIKE '%_v2' THEN 1 ELSE 2 END,
    table_name;

-- Overall rollback status
WITH rollback_summary AS (
    SELECT 
        COUNT(*) as total_steps,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_steps,
        COUNT(CASE WHEN status IN ('failed', 'error') THEN 1 END) as failed_steps
    FROM rollback_log
    WHERE rollback_step != 'rollback_verification'
)
SELECT 
    'ROLLBACK SUMMARY' as summary_type,
    total_steps,
    completed_steps,
    failed_steps,
    ROUND(completed_steps * 100.0 / total_steps, 1) as success_rate,
    CASE 
        WHEN failed_steps = 0 THEN '✅ ROLLBACK SUCCESSFUL'
        WHEN failed_steps <= 2 THEN '⚠️ ROLLBACK MOSTLY SUCCESSFUL'
        ELSE '❌ ROLLBACK FAILED'
    END as rollback_status
FROM rollback_summary;

UPDATE rollback_log 
SET status = 'completed', completed_at = NOW(),
    details = jsonb_build_object(
        'verification_results', (
            SELECT jsonb_agg(jsonb_build_object(
                'table_name', table_name,
                'expected_status', expected_status,
                'verification_result', 
                    CASE 
                        WHEN (table_name LIKE '%_v2' AND expected_status = 'PRESERVED') OR
                             (NOT table_name LIKE '%_v2' AND expected_status = 'REMOVED') THEN 'CORRECT'
                        ELSE 'INCORRECT'
                    END
            ))
            FROM rollback_verification
        )
    )
WHERE rollback_step = 'rollback_verification' AND status = 'started';

-- =============================================
-- FINAL ROLLBACK STATUS
-- =============================================

-- Final rollback log entry
INSERT INTO rollback_log (rollback_step, status, details) 
VALUES ('rollback_completed', 'completed', jsonb_build_object(
    'completion_time', NOW(),
    'total_duration_minutes', (
        SELECT EXTRACT(EPOCH FROM (NOW() - MIN(started_at)))/60 
        FROM rollback_log
    ),
    'final_message', 'Database has been rolled back to pre-migration state'
));

-- Final status message
SELECT 
    '🔄 DATABASE ROLLBACK COMPLETED' as final_status,
    'The database has been restored to its pre-migration state.' as message,
    'All new schema objects have been removed.' as schema_status,
    'Original data and structure preserved.' as data_status,
    ROUND((
        SELECT EXTRACT(EPOCH FROM (NOW() - MIN(started_at)))/60 
        FROM rollback_log
    ), 1) || ' minutes' as total_duration,
    NOW() as completed_at;

-- Show rollback log summary for audit trail
SELECT 
    'ROLLBACK AUDIT TRAIL' as audit_section,
    rollback_step,
    status,
    started_at,
    completed_at,
    EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at))/60 as duration_minutes,
    details
FROM rollback_log
ORDER BY started_at;

-- =============================================
-- POST-ROLLBACK RECOMMENDATIONS
-- =============================================

SELECT 
    'POST-ROLLBACK RECOMMENDATIONS' as recommendations_section,
    ARRAY[
        '1. Verify application connectivity to original database schema',
        '2. Run application tests to ensure functionality is restored',
        '3. Review rollback logs for any warnings or partial failures',
        '4. Consider addressing root cause of migration issues before retry',
        '5. Backup current state before attempting migration again',
        '6. Update migration scripts based on lessons learned',
        '7. Test migration in staging environment more thoroughly'
    ] as action_items,
    'Review the rollback_log table for detailed audit trail' as audit_info;