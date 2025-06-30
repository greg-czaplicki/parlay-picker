-- Rollback Migration: Update Parlay and Trends Tables for v2 Schema Compatibility
-- Description: Rollback script to undo parlay and trends v2 compatibility changes
-- Author: Database Migration Team
-- Date: 2025-06-28
-- Version: 1.0.0

-- This rollback will restore parlay and trends tables to their original state
-- WARNING: This may cause data loss for any new records that rely on v2 schema

-- =============================================
-- SAFETY CHECKS
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '========================================';\n    RAISE NOTICE 'ROLLBACK WARNING: This will undo all v2 compatibility changes!';\n    RAISE NOTICE '========================================';\n    \n    -- Check if v2 compatibility changes were applied\n    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 'V002') THEN\n        RAISE NOTICE 'V002 migration not found. Rollback may not be necessary.';\n    END IF;\nEND $$;

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

-- Restore original foreign key constraint to players table (if it exists)
-- Note: This will only work if the original players table still exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players') THEN
        ALTER TABLE parlay_picks 
        ADD CONSTRAINT parlay_picks_picked_player_dg_id_fkey 
        FOREIGN KEY (picked_player_dg_id) REFERENCES players(dg_id);
    ELSE
        RAISE WARNING 'Original players table not found - cannot restore FK constraint';
    END IF;
END $$;

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

-- Drop v2 foreign key constraint (if it was added)
ALTER TABLE player_tournament_trends 
DROP CONSTRAINT IF EXISTS fk_player_tournament_trends_event_id_v2;

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
-- 7. REMOVE MIGRATION LOG ENTRY
-- =============================================
DELETE FROM schema_migrations WHERE version = 'V002';
RAISE NOTICE 'Removed migration log entry for V002';

-- =============================================
-- 8. CLEANUP VERIFICATION
-- =============================================
-- Verify rollback completed successfully
DO $$
DECLARE
    parlay_picks_dg_id_type TEXT;
    player_trends_dg_id_type TEXT;
BEGIN
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
    
    RAISE NOTICE '========================================';\n    RAISE NOTICE 'Rollback V002 completed successfully!';\n    RAISE NOTICE '========================================';\n    RAISE NOTICE 'Reverted changes:';\n    RAISE NOTICE '  - parlay_picks: dg_id reverted to INTEGER, v2 FKs removed';\n    RAISE NOTICE '  - player_trends: dg_id reverted to INTEGER, timestamps without TZ';\n    RAISE NOTICE '  - player_tournament_trends: dg_id reverted to INTEGER, PK removed';\n    RAISE NOTICE '  - scoring_trends: dg_id reverted to INTEGER, PK removed';\n    RAISE NOTICE '  - All v2 compatibility views removed';\n    RAISE NOTICE '  - All v2 indexes and constraints removed';\n    RAISE NOTICE '';\n    RAISE NOTICE 'WARNING: Tables are now incompatible with v2 schema!';\n    RAISE NOTICE 'You may need to restore original FK constraints manually.';\n    RAISE NOTICE '========================================';\nEND $$;