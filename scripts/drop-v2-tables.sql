-- Drop v2 tables after successful schema migration
-- All data has been verified as migrated or empty

-- Drop empty v2 tables
DROP TABLE IF EXISTS matchups_v2;
DROP TABLE IF EXISTS parlays_v2;
DROP TABLE IF EXISTS parlay_picks_v2;
DROP TABLE IF EXISTS players_v2;

-- Drop migrated v2 tables (data preserved in current schema)
DROP TABLE IF EXISTS tournaments_v2;
DROP TABLE IF EXISTS courses_v2;

-- Verify tables are dropped
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%_v2';