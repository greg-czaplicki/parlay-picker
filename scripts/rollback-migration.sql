-- Rollback Script for Data Migration
-- Use this script to revert the data migration if needed

-- ============================================
-- ROLLBACK INSTRUCTIONS
-- ============================================
-- This script provides rollback procedures for the data migration.
-- Execute sections as needed based on what needs to be reverted.

-- ============================================
-- 1. BACKUP CURRENT STATE (RUN BEFORE ROLLBACK)
-- ============================================

-- Create backup tables with current data
CREATE TABLE IF NOT EXISTS parlays_backup AS 
SELECT * FROM parlays WHERE outcome IS NOT NULL;

CREATE TABLE IF NOT EXISTS parlay_picks_backup AS 
SELECT * FROM parlay_picks WHERE outcome IS NOT NULL;

-- ============================================
-- 2. REVERT OUTCOME FIELDS (IF NEEDED)
-- ============================================

-- Reset parlay outcomes to NULL (only if needed)
-- UPDATE parlays SET outcome = NULL 
-- WHERE uuid IN (
--   SELECT uuid FROM parlays_backup 
--   WHERE outcome IS NOT NULL
-- );

-- Reset parlay_pick outcomes to NULL (only if needed)  
-- UPDATE parlay_picks SET outcome = NULL
-- WHERE uuid IN (
--   SELECT uuid FROM parlay_picks_backup
--   WHERE outcome IS NOT NULL
-- );

-- ============================================
-- 3. REMOVE FUNCTIONS (IF NEEDED)
-- ============================================

-- Drop migration functions if no longer needed
-- DROP FUNCTION IF EXISTS determine_matchup_outcome(UUID, INTEGER, INTEGER, INTEGER);
-- DROP FUNCTION IF EXISTS determine_parlay_outcome(UUID);
-- DROP FUNCTION IF EXISTS parse_today_score(INTEGER);

-- ============================================
-- 4. REMOVE INDEXES (IF NEEDED)
-- ============================================

-- Drop performance indexes if they cause issues
-- DROP INDEX IF EXISTS idx_parlays_outcome_created_at;
-- DROP INDEX IF EXISTS idx_parlay_picks_outcome_created_at;
-- DROP INDEX IF EXISTS idx_parlay_picks_picked_player_outcome;

-- ============================================
-- 5. VALIDATION AFTER ROLLBACK
-- ============================================

-- Check rollback success
SELECT 
  'parlays' as table_name,
  COUNT(*) as total_records,
  COUNT(outcome) as outcome_populated,
  COUNT(*) - COUNT(outcome) as missing_outcomes
FROM parlays

UNION ALL

SELECT 
  'parlay_picks' as table_name,
  COUNT(*) as total_records,
  COUNT(outcome) as outcome_populated,
  COUNT(*) - COUNT(outcome) as missing_outcomes
FROM parlay_picks;

-- ============================================
-- 6. CLEANUP BACKUP TABLES (AFTER VERIFICATION)
-- ============================================

-- Remove backup tables once rollback is verified
-- DROP TABLE IF EXISTS parlays_backup;
-- DROP TABLE IF EXISTS parlay_picks_backup;

-- ============================================
-- ROLLBACK COMPLETE
-- ============================================

SELECT 
  'Rollback Script Ready' as status,
  'Uncomment sections as needed' as instructions,
  NOW() as prepared_at; 