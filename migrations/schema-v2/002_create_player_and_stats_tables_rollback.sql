-- Rollback Migration: Create Player and Stats Tables
-- Description: Rollback script to drop player and advanced stats tables
-- Author: Database Migration Team
-- Date: 2025-06-28

-- =============================================
-- DROP TABLES (in reverse order of creation due to foreign key constraints)
-- =============================================

-- Drop player_advanced_stats table first (has foreign keys to players and tournaments)
DROP TABLE IF EXISTS player_advanced_stats_v2 CASCADE;

-- Drop players table 
DROP TABLE IF EXISTS players_v2 CASCADE;

-- =============================================
-- CLEANUP CONFIRMATION
-- =============================================
-- Verify all objects are dropped
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('players_v2', 'player_advanced_stats_v2')) THEN
        RAISE EXCEPTION 'Rollback failed: Some tables still exist';
    END IF;
    
    RAISE NOTICE 'Rollback completed successfully: All player and stats tables dropped';
END $$;