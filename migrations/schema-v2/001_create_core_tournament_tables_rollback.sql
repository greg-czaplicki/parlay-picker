-- Rollback Migration: Create Core Tournament Tables  
-- Description: Rollback script to drop the core tournament tables and related objects
-- Author: Database Migration Team
-- Date: 2025-06-28

-- =============================================
-- DROP TABLES (in reverse order of creation due to foreign key constraints)
-- =============================================

-- Drop tournament_results table first (has foreign key to tournaments)
DROP TABLE IF EXISTS tournament_results_v2 CASCADE;

-- Drop player_round_scores table (has foreign key to tournaments)  
DROP TABLE IF EXISTS player_round_scores_v2 CASCADE;

-- Drop tournaments table last
DROP TABLE IF EXISTS tournaments_v2 CASCADE;

-- =============================================
-- DROP FUNCTIONS
-- =============================================
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- =============================================
-- CLEANUP CONFIRMATION
-- =============================================
-- Verify all objects are dropped
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('tournaments_v2', 'player_round_scores_v2', 'tournament_results_v2')) THEN
        RAISE EXCEPTION 'Rollback failed: Some tables still exist';
    END IF;
    
    RAISE NOTICE 'Rollback completed successfully: All core tournament tables dropped';
END $$;