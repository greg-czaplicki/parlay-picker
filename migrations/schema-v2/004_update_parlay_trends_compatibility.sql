-- Migration: Update Parlay and Trends Tables for v2 Schema Compatibility
-- Description: Updates parlay and trends tables to work with new v2 schema
-- Author: Database Migration Team
-- Date: 2025-06-28
-- Version: 1.0.0

-- This migration ensures parlay and trends tables are compatible with the new v2 schema
-- while maintaining backward compatibility during the transition period

-- =============================================
-- PREREQUISITES CHECK
-- =============================================
DO $$
BEGIN
    -- Verify v2 tables exist before updating references
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players_v2') THEN
        RAISE EXCEPTION 'players_v2 table must exist before updating parlay/trends compatibility';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournaments_v2') THEN
        RAISE EXCEPTION 'tournaments_v2 table must exist before updating parlay/trends compatibility';
    END IF;
    
    RAISE NOTICE 'Prerequisites met: v2 tables exist';
END $$;

-- =============================================
-- 1. UPDATE PARLAY_PICKS TABLE FOR V2 COMPATIBILITY
-- =============================================
RAISE NOTICE 'Updating parlay_picks table for v2 compatibility...';

-- Step 1: Drop existing foreign key constraint to players table
ALTER TABLE parlay_picks 
DROP CONSTRAINT IF EXISTS parlay_picks_picked_player_dg_id_fkey;

-- Step 2: Update data type from INTEGER to BIGINT to match players_v2.dg_id
ALTER TABLE parlay_picks 
ALTER COLUMN picked_player_dg_id TYPE BIGINT;

-- Step 3: Add foreign key constraint to players_v2 table
ALTER TABLE parlay_picks 
ADD CONSTRAINT fk_parlay_picks_picked_player_dg_id_v2 
FOREIGN KEY (picked_player_dg_id) REFERENCES players_v2(dg_id) ON DELETE SET NULL;

-- Step 4: Add event_id foreign key to tournaments_v2 (if not already constrained)
-- Note: event_id is already stored but may not be constrained
ALTER TABLE parlay_picks 
ADD CONSTRAINT fk_parlay_picks_event_id_v2 
FOREIGN KEY (event_id) REFERENCES tournaments_v2(event_id) ON DELETE SET NULL;

RAISE NOTICE 'parlay_picks table updated successfully';

-- =============================================
-- 2. UPDATE PLAYER_TRENDS TABLE FOR V2 COMPATIBILITY  
-- =============================================
RAISE NOTICE 'Updating player_trends table for v2 compatibility...';

-- Step 1: Update dg_id data type from INTEGER to BIGINT
ALTER TABLE player_trends 
ALTER COLUMN dg_id TYPE BIGINT;

-- Step 2: Add foreign key constraint to players_v2 (optional - may want to keep flexible)
-- Commenting out for now as trends may include historical players not in v2
-- ALTER TABLE player_trends 
-- ADD CONSTRAINT fk_player_trends_dg_id_v2 
-- FOREIGN KEY (dg_id) REFERENCES players_v2(dg_id) ON DELETE CASCADE;

RAISE NOTICE 'player_trends table updated successfully';

-- =============================================
-- 3. UPDATE PLAYER_TOURNAMENT_TRENDS TABLE FOR V2 COMPATIBILITY
-- =============================================
RAISE NOTICE 'Updating player_tournament_trends table for v2 compatibility...';

-- Step 1: Add primary key (this table currently has no PK)
ALTER TABLE player_tournament_trends 
ADD COLUMN id BIGSERIAL PRIMARY KEY;

-- Step 2: Update dg_id data type from INTEGER to BIGINT
ALTER TABLE player_tournament_trends 
ALTER COLUMN dg_id TYPE BIGINT;

-- Step 3: Add event_id column to reference tournaments_v2
-- Note: We'll need to populate this during data migration based on event_name
ALTER TABLE player_tournament_trends 
ADD COLUMN event_id INTEGER;

-- Step 4: Add foreign key constraint to tournaments_v2 (after data migration populates event_id)
-- ALTER TABLE player_tournament_trends 
-- ADD CONSTRAINT fk_player_tournament_trends_event_id_v2 
-- FOREIGN KEY (event_id) REFERENCES tournaments_v2(event_id) ON DELETE CASCADE;

-- Step 5: Add indexes for performance
CREATE INDEX idx_player_tournament_trends_dg_id_v2 ON player_tournament_trends(dg_id);
CREATE INDEX idx_player_tournament_trends_event_name_v2 ON player_tournament_trends(event_name);
CREATE INDEX idx_player_tournament_trends_event_id_v2 ON player_tournament_trends(event_id);

RAISE NOTICE 'player_tournament_trends table updated successfully';

-- =============================================
-- 4. UPDATE SCORING_TRENDS TABLE FOR V2 COMPATIBILITY
-- =============================================  
RAISE NOTICE 'Updating scoring_trends table for v2 compatibility...';

-- Step 1: Add primary key (this table currently has no PK)
ALTER TABLE scoring_trends 
ADD COLUMN id BIGSERIAL PRIMARY KEY;

-- Step 2: Update dg_id data type from INTEGER to BIGINT
ALTER TABLE scoring_trends 
ALTER COLUMN dg_id TYPE BIGINT;

-- Step 3: Add foreign key constraint to players_v2 (optional - may want to keep flexible)
-- Commenting out for now as trends may include historical players not in v2
-- ALTER TABLE scoring_trends 
-- ADD CONSTRAINT fk_scoring_trends_dg_id_v2 
-- FOREIGN KEY (dg_id) REFERENCES players_v2(dg_id) ON DELETE CASCADE;

-- Step 4: Add indexes for performance
CREATE INDEX idx_scoring_trends_dg_id_v2 ON scoring_trends(dg_id);
CREATE INDEX idx_scoring_trends_player_name_v2 ON scoring_trends(player_name);

RAISE NOTICE 'scoring_trends table updated successfully';

-- =============================================
-- 5. CREATE COMPATIBILITY VIEWS FOR SEAMLESS TRANSITION
-- =============================================
RAISE NOTICE 'Creating compatibility views for seamless transition...';

-- Create view for backward compatibility with old players table name
CREATE VIEW players AS 
SELECT 
    dg_id,
    name,
    country,
    country_code,
    created_at,
    updated_at
FROM players_v2;

-- Create view for backward compatibility with old tournaments table name  
CREATE VIEW tournaments AS
SELECT 
    event_id,
    event_name,
    course_name,
    course_par,
    start_date,
    end_date,
    tour,
    status,
    created_at,
    updated_at
FROM tournaments_v2;

RAISE NOTICE 'Compatibility views created successfully';

-- =============================================
-- 6. UPDATE TIMESTAMP CONSISTENCY
-- =============================================
RAISE NOTICE 'Standardizing timestamp types for consistency...';

-- Ensure all timestamp columns use TIMESTAMP WITH TIME ZONE for consistency
-- Note: This may require careful handling if there's existing data with different timezone assumptions

-- Update player_trends timestamps to be timezone-aware
ALTER TABLE player_trends 
ALTER COLUMN calculated_at TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN valid_until TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE;

-- player_tournament_trends already uses TIMESTAMPTZ for snapshot_timestamp

RAISE NOTICE 'Timestamp consistency updated successfully';

-- =============================================
-- 7. ADD ADDITIONAL INDEXES FOR V2 PERFORMANCE
-- =============================================
RAISE NOTICE 'Adding performance indexes for v2 compatibility...';

-- Indexes for parlay_picks with new v2 relationships
CREATE INDEX idx_parlay_picks_picked_player_dg_id_v2 ON parlay_picks(picked_player_dg_id);
CREATE INDEX idx_parlay_picks_event_id_v2 ON parlay_picks(event_id);
CREATE INDEX idx_parlay_picks_settlement_status_v2 ON parlay_picks(settlement_status);

-- Indexes for player_trends with v2 compatibility
CREATE INDEX idx_player_trends_dg_id_v2 ON player_trends(dg_id);
CREATE INDEX idx_player_trends_trend_type_v2 ON player_trends(trend_type);
CREATE INDEX idx_player_trends_calculated_at_v2 ON player_trends(calculated_at);

RAISE NOTICE 'Performance indexes added successfully';

-- =============================================
-- 8. DATA VALIDATION AND CONSTRAINTS
-- =============================================
RAISE NOTICE 'Adding data validation constraints...';

-- Ensure dg_id values are positive
ALTER TABLE player_trends 
ADD CONSTRAINT check_player_trends_dg_id_positive 
CHECK (dg_id > 0);

ALTER TABLE player_tournament_trends 
ADD CONSTRAINT check_player_tournament_trends_dg_id_positive 
CHECK (dg_id > 0);

ALTER TABLE scoring_trends 
ADD CONSTRAINT check_scoring_trends_dg_id_positive 
CHECK (dg_id > 0);

-- Ensure tournament counts are non-negative in scoring_trends
ALTER TABLE scoring_trends 
ADD CONSTRAINT check_scoring_trends_non_negative_counts 
CHECK (
    sub_70_avg_tournaments >= 0 AND 
    sub_69_avg_tournaments >= 0 AND 
    tournaments_with_sub_70_round >= 0 AND 
    total_tournaments >= 0
);

-- Ensure reasonable position values in player_tournament_trends
ALTER TABLE player_tournament_trends 
ADD CONSTRAINT check_player_tournament_trends_reasonable_position 
CHECK (position_numeric IS NULL OR position_numeric > 0);

RAISE NOTICE 'Data validation constraints added successfully';

-- =============================================
-- 9. UPDATE COMMENTS FOR DOCUMENTATION
-- =============================================
-- Add comments to updated tables for better documentation
COMMENT ON TABLE parlay_picks IS 'Individual picks within a parlay - updated for v2 schema compatibility';
COMMENT ON COLUMN parlay_picks.picked_player_dg_id IS 'Player DataGolf ID (BIGINT) - references players_v2.dg_id';
COMMENT ON COLUMN parlay_picks.event_id IS 'Tournament event ID - references tournaments_v2.event_id';

COMMENT ON TABLE player_trends IS 'Player performance trends data - updated for v2 schema compatibility';
COMMENT ON COLUMN player_trends.dg_id IS 'Player DataGolf ID (BIGINT) - compatible with players_v2.dg_id';

COMMENT ON TABLE player_tournament_trends IS 'Tournament-specific player trends - updated for v2 schema compatibility';
COMMENT ON COLUMN player_tournament_trends.dg_id IS 'Player DataGolf ID (BIGINT) - compatible with players_v2.dg_id';
COMMENT ON COLUMN player_tournament_trends.event_id IS 'Tournament event ID - will reference tournaments_v2.event_id after data migration';

COMMENT ON TABLE scoring_trends IS 'Player scoring trend analysis - updated for v2 schema compatibility';
COMMENT ON COLUMN scoring_trends.dg_id IS 'Player DataGolf ID (BIGINT) - compatible with players_v2.dg_id';

-- =============================================
-- 10. MIGRATION COMPLETION LOG
-- =============================================
-- Log this migration in the schema_migrations table
INSERT INTO schema_migrations (version, description) 
VALUES ('V002', 'Update parlay and trends tables for v2 schema compatibility')
ON CONFLICT (version) DO UPDATE SET 
    applied_at = NOW(),
    description = EXCLUDED.description;

-- =============================================
-- 11. COMPLETION MESSAGE
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '========================================';\n    RAISE NOTICE 'Parlay/Trends v2 Compatibility Migration Completed!';\n    RAISE NOTICE '========================================';\n    RAISE NOTICE 'Updated tables:';\n    RAISE NOTICE '  - parlay_picks: dg_id → BIGINT, FK to players_v2, FK to tournaments_v2';\n    RAISE NOTICE '  - player_trends: dg_id → BIGINT, timestamp consistency';\n    RAISE NOTICE '  - player_tournament_trends: dg_id → BIGINT, added PK, event_id column';\n    RAISE NOTICE '  - scoring_trends: dg_id → BIGINT, added PK';\n    RAISE NOTICE '';\n    RAISE NOTICE 'Created compatibility views:';\n    RAISE NOTICE '  - players (points to players_v2)';\n    RAISE NOTICE '  - tournaments (points to tournaments_v2)';\n    RAISE NOTICE '';\n    RAISE NOTICE 'Added performance indexes and data validation constraints';\n    RAISE NOTICE '';\n    RAISE NOTICE 'Next steps:';\n    RAISE NOTICE '  1. Update application code to use v2 table names';\n    RAISE NOTICE '  2. Populate event_id in player_tournament_trends from event_name';\n    RAISE NOTICE '  3. Test parlay creation and settlement with new schema';\n    RAISE NOTICE '  4. Verify trend calculations work with updated tables';\n    RAISE NOTICE '========================================';\nEND $$;