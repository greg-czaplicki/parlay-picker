-- Rollback Migration V001: Complete New Schema Creation
-- Description: Rollback script to completely remove the new v2 schema
-- Author: Database Migration Team
-- Date: 2025-06-28
-- Version: 1.0.0

-- This rollback will remove ALL v2 tables and related objects

-- =============================================
-- SAFETY CHECKS
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ROLLBACK WARNING: This will permanently delete all v2 schema data!';
    RAISE NOTICE '========================================';
    
    -- Check if v2 tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournaments_v2') THEN
        RAISE NOTICE 'No v2 tables found. Rollback may have already been executed.';
    END IF;
END $$;

-- =============================================
-- DROP TABLES (in reverse order of creation due to foreign key constraints)
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
-- DROP FUNCTIONS
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
-- REMOVE MIGRATION LOG ENTRY
-- =============================================
DELETE FROM schema_migrations WHERE version = 'V001';
RAISE NOTICE 'Removed migration log entry for V001';

-- =============================================
-- CLEANUP VERIFICATION
-- =============================================
-- Verify all objects are dropped
DO $$
DECLARE
    v2_table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v2_table_count 
    FROM information_schema.tables 
    WHERE table_name LIKE '%_v2';
    
    IF v2_table_count > 0 THEN
        RAISE EXCEPTION 'Rollback failed: % v2 tables still exist', v2_table_count;
    END IF;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Rollback V001 completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'All v2 schema objects have been removed:';
    RAISE NOTICE '  - tournaments_v2';
    RAISE NOTICE '  - players_v2';
    RAISE NOTICE '  - player_round_scores_v2';
    RAISE NOTICE '  - tournament_results_v2';
    RAISE NOTICE '  - player_advanced_stats_v2';
    RAISE NOTICE '  - All associated indexes and constraints';
    RAISE NOTICE '  - Migration log entry';
    RAISE NOTICE '';
    RAISE NOTICE 'The database has been restored to its pre-migration state.';
    RAISE NOTICE '========================================';
END $$;