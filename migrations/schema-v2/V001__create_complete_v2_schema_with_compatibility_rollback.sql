-- Rollback Migration V001: Complete v2 Schema Creation with Parlay/Trends Compatibility
-- Description: Comprehensive rollback script to undo all v2 schema and compatibility changes
-- Author: Database Migration Team
-- Date: 2025-06-28
-- Version: 2.0.0

-- This rollback will remove ALL v2 tables AND revert parlay/trends compatibility changes
-- WARNING: This may cause data loss and application downtime

-- =============================================
-- SAFETY CHECKS
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '========================================';\n    RAISE NOTICE 'COMPREHENSIVE ROLLBACK WARNING!';\n    RAISE NOTICE 'This will permanently delete all v2 schema data AND';\n    RAISE NOTICE 'revert all parlay/trends compatibility changes!';\n    RAISE NOTICE '========================================';\n    \n    -- Check if v2 migration was applied\n    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 'V001_COMPLETE') THEN\n        RAISE NOTICE 'V001_COMPLETE migration not found. Rollback may not be necessary.';\n    END IF;\n    \n    -- Check if v2 tables exist\n    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournaments_v2') THEN\n        RAISE NOTICE 'No v2 tables found. Schema rollback may have already been executed.';\n    END IF;\nEND $$;

-- =============================================
-- PART I: ROLLBACK PARLAY/TRENDS COMPATIBILITY
-- =============================================
RAISE NOTICE '========================================';\nRAISE NOTICE 'PART I: Rolling Back Parlay/Trends Compatibility';\nRAISE NOTICE '========================================';\n

-- =============================================
-- 1. DROP COMPATIBILITY VIEWS
-- =============================================
RAISE NOTICE 'Dropping compatibility views...';

-- Drop backward compatibility views
DROP VIEW IF EXISTS players CASCADE;
DROP VIEW IF EXISTS tournaments CASCADE;

RAISE NOTICE 'Compatibility views dropped';

-- =============================================
-- 2. ROLLBACK PARLAY_PICKS TABLE CHANGES
-- =============================================
RAISE NOTICE 'Rolling back parlay_picks table changes...';

-- Drop v2 foreign key constraints
ALTER TABLE parlay_picks 
DROP CONSTRAINT IF EXISTS fk_parlay_picks_picked_player_dg_id_v2;

ALTER TABLE parlay_picks 
DROP CONSTRAINT IF EXISTS fk_parlay_picks_event_id_v2;

-- Drop v2 indexes
DROP INDEX IF EXISTS idx_parlay_picks_picked_player_dg_id_v2;
DROP INDEX IF EXISTS idx_parlay_picks_event_id_v2;
DROP INDEX IF EXISTS idx_parlay_picks_settlement_status_v2;

-- Revert data type from BIGINT back to INTEGER
-- WARNING: This could cause data loss if any dg_id values exceed INTEGER range
DO $$
BEGIN
    -- Check for dg_id values that would be lost in conversion
    IF EXISTS (SELECT 1 FROM parlay_picks WHERE picked_player_dg_id > 2147483647) THEN
        RAISE WARNING 'Some dg_id values exceed INTEGER range and may be lost in rollback';
    END IF;
    
    -- Proceed with conversion
    ALTER TABLE parlay_picks 
    ALTER COLUMN picked_player_dg_id TYPE INTEGER;
END $$;

-- Note: Original FK constraint to old players table cannot be restored
-- since we're about to drop the v2 tables that replaced it

RAISE NOTICE 'parlay_picks table rollback completed';

-- =============================================
-- 3. ROLLBACK PLAYER_TRENDS TABLE CHANGES
-- =============================================
RAISE NOTICE 'Rolling back player_trends table changes...';

-- Drop v2 indexes
DROP INDEX IF EXISTS idx_player_trends_dg_id_v2;
DROP INDEX IF EXISTS idx_player_trends_trend_type_v2;
DROP INDEX IF EXISTS idx_player_trends_calculated_at_v2;

-- Drop v2 constraints
ALTER TABLE player_trends 
DROP CONSTRAINT IF EXISTS check_player_trends_dg_id_positive;

-- Revert data type from BIGINT back to INTEGER
ALTER TABLE player_trends 
ALTER COLUMN dg_id TYPE INTEGER;

-- Revert timestamp types back to TIMESTAMP (without timezone)
ALTER TABLE player_trends 
ALTER COLUMN calculated_at TYPE TIMESTAMP,
ALTER COLUMN valid_until TYPE TIMESTAMP,
ALTER COLUMN created_at TYPE TIMESTAMP,
ALTER COLUMN updated_at TYPE TIMESTAMP;

RAISE NOTICE 'player_trends table rollback completed';

-- =============================================
-- 4. ROLLBACK PLAYER_TOURNAMENT_TRENDS TABLE CHANGES
-- =============================================
RAISE NOTICE 'Rolling back player_tournament_trends table changes...';

-- Drop v2 indexes
DROP INDEX IF EXISTS idx_player_tournament_trends_dg_id_v2;
DROP INDEX IF EXISTS idx_player_tournament_trends_event_name_v2;
DROP INDEX IF EXISTS idx_player_tournament_trends_event_id_v2;

-- Drop v2 constraints
ALTER TABLE player_tournament_trends 
DROP CONSTRAINT IF EXISTS check_player_tournament_trends_dg_id_positive;
ALTER TABLE player_tournament_trends 
DROP CONSTRAINT IF EXISTS check_player_tournament_trends_reasonable_position;

-- Remove added columns
ALTER TABLE player_tournament_trends 
DROP COLUMN IF EXISTS event_id;

ALTER TABLE player_tournament_trends 
DROP COLUMN IF EXISTS id;

-- Revert data type from BIGINT back to INTEGER
ALTER TABLE player_tournament_trends 
ALTER COLUMN dg_id TYPE INTEGER;

RAISE NOTICE 'player_tournament_trends table rollback completed';

-- =============================================
-- 5. ROLLBACK SCORING_TRENDS TABLE CHANGES
-- =============================================
RAISE NOTICE 'Rolling back scoring_trends table changes...';

-- Drop v2 indexes
DROP INDEX IF EXISTS idx_scoring_trends_dg_id_v2;
DROP INDEX IF EXISTS idx_scoring_trends_player_name_v2;

-- Drop v2 constraints
ALTER TABLE scoring_trends 
DROP CONSTRAINT IF EXISTS check_scoring_trends_dg_id_positive;
ALTER TABLE scoring_trends 
DROP CONSTRAINT IF EXISTS check_scoring_trends_non_negative_counts;

-- Remove added columns
ALTER TABLE scoring_trends 
DROP COLUMN IF EXISTS id;

-- Revert data type from BIGINT back to INTEGER
ALTER TABLE scoring_trends 
ALTER COLUMN dg_id TYPE INTEGER;

RAISE NOTICE 'scoring_trends table rollback completed';

-- =============================================
-- 6. REMOVE UPDATED COMMENTS
-- =============================================
RAISE NOTICE 'Removing updated table comments...';

-- Remove comments added during v2 compatibility migration
COMMENT ON TABLE parlay_picks IS NULL;
COMMENT ON COLUMN parlay_picks.picked_player_dg_id IS NULL;
COMMENT ON COLUMN parlay_picks.event_id IS NULL;

COMMENT ON TABLE player_trends IS NULL;
COMMENT ON COLUMN player_trends.dg_id IS NULL;

COMMENT ON TABLE player_tournament_trends IS NULL;
COMMENT ON COLUMN player_tournament_trends.dg_id IS NULL;

COMMENT ON TABLE scoring_trends IS NULL;
COMMENT ON COLUMN scoring_trends.dg_id IS NULL;

RAISE NOTICE 'Table comments removed';

-- =============================================
-- PART II: ROLLBACK V2 SCHEMA
-- =============================================
RAISE NOTICE '========================================';\nRAISE NOTICE 'PART II: Rolling Back v2 Schema';\nRAISE NOTICE '========================================';\n

-- =============================================
-- 7. DROP V2 TABLES (in reverse order of creation due to foreign key constraints)
-- =============================================

-- Drop player_advanced_stats table first (has foreign keys to players and tournaments)
DROP TABLE IF EXISTS player_advanced_stats_v2 CASCADE;
RAISE NOTICE 'Dropped table: player_advanced_stats_v2';

-- Drop tournament_results table (has foreign keys to players and tournaments)  
DROP TABLE IF EXISTS tournament_results_v2 CASCADE;
RAISE NOTICE 'Dropped table: tournament_results_v2';

-- Drop player_round_scores table (has foreign keys to players and tournaments)
DROP TABLE IF EXISTS player_round_scores_v2 CASCADE;
RAISE NOTICE 'Dropped table: player_round_scores_v2';

-- Drop players table (referenced by other tables)
DROP TABLE IF EXISTS players_v2 CASCADE;
RAISE NOTICE 'Dropped table: players_v2';

-- Drop tournaments table last
DROP TABLE IF EXISTS tournaments_v2 CASCADE;
RAISE NOTICE 'Dropped table: tournaments_v2';

-- =============================================
-- 8. DROP FUNCTIONS
-- =============================================
-- Note: We only drop the function if no other triggers are using it
DO $$
BEGIN
    -- Check if any triggers are still using the function
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE event_object_table NOT LIKE '%_v2' 
        AND action_statement LIKE '%update_updated_at_column%'
    ) THEN
        DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
        RAISE NOTICE 'Dropped function: update_updated_at_column';
    ELSE
        RAISE NOTICE 'Function update_updated_at_column preserved (still used by other tables)';
    END IF;
END $$;

-- =============================================
-- 9. REMOVE MIGRATION LOG ENTRIES
-- =============================================
DELETE FROM schema_migrations WHERE version = 'V001_COMPLETE';
DELETE FROM schema_migrations WHERE version = 'V001';
DELETE FROM schema_migrations WHERE version = 'V002';
RAISE NOTICE 'Removed migration log entries for V001_COMPLETE, V001, and V002';

-- =============================================
-- 10. CLEANUP VERIFICATION
-- =============================================
-- Verify rollback completed successfully
DO $$
DECLARE
    v2_table_count INTEGER;
    parlay_picks_dg_id_type TEXT;
    player_trends_dg_id_type TEXT;
BEGIN
    -- Check if v2 tables are removed
    SELECT COUNT(*) INTO v2_table_count 
    FROM information_schema.tables 
    WHERE table_name LIKE '%_v2';
    
    IF v2_table_count > 0 THEN
        RAISE EXCEPTION 'Rollback failed: % v2 tables still exist', v2_table_count;
    END IF;
    
    -- Check data types were reverted correctly
    SELECT data_type INTO parlay_picks_dg_id_type 
    FROM information_schema.columns 
    WHERE table_name = 'parlay_picks' AND column_name = 'picked_player_dg_id';
    
    SELECT data_type INTO player_trends_dg_id_type 
    FROM information_schema.columns 
    WHERE table_name = 'player_trends' AND column_name = 'dg_id';
    
    IF parlay_picks_dg_id_type = 'integer' AND player_trends_dg_id_type = 'integer' THEN
        RAISE NOTICE 'Data types successfully reverted to INTEGER';
    ELSE
        RAISE WARNING 'Some data types may not have been reverted correctly';
    END IF;
    
    RAISE NOTICE '========================================';\n    RAISE NOTICE 'COMPREHENSIVE ROLLBACK COMPLETED!';\n    RAISE NOTICE '========================================';\n    RAISE NOTICE 'Removed v2 schema:';\n    RAISE NOTICE '  - tournaments_v2';\n    RAISE NOTICE '  - players_v2';\n    RAISE NOTICE '  - player_round_scores_v2';\n    RAISE NOTICE '  - tournament_results_v2';\n    RAISE NOTICE '  - player_advanced_stats_v2';\n    RAISE NOTICE '  - All associated indexes and constraints';\n    RAISE NOTICE '';\n    RAISE NOTICE 'Reverted parlay/trends compatibility:';\n    RAISE NOTICE '  - parlay_picks: dg_id reverted to INTEGER, v2 FKs removed';\n    RAISE NOTICE '  - player_trends: dg_id reverted to INTEGER, timestamps without TZ';\n    RAISE NOTICE '  - player_tournament_trends: dg_id reverted to INTEGER, PK removed';\n    RAISE NOTICE '  - scoring_trends: dg_id reverted to INTEGER, PK removed';\n    RAISE NOTICE '  - All v2 compatibility views removed';\n    RAISE NOTICE '  - All v2 indexes and constraints removed';\n    RAISE NOTICE '';\n    RAISE NOTICE 'WARNING: Database is now in original state!';\n    RAISE NOTICE 'You may need to restore original FK constraints manually.';\n    RAISE NOTICE 'Parlay and trends tables are back to original schema.';\n    RAISE NOTICE '========================================';\nEND $$;