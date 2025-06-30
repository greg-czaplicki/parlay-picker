-- Fix Critical Issues Blocking Migration
-- These SQL commands will resolve the 10 critical issues identified

-- 1. Remove season_stats records with null dg_id
-- These are incomplete records that cannot be migrated to v2 schema
DELETE FROM player_season_stats 
WHERE dg_id IS NULL;

-- Verify the fix
SELECT 
    'AFTER_CLEANUP' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN dg_id IS NULL THEN 1 END) as null_dg_id_count
FROM player_season_stats;