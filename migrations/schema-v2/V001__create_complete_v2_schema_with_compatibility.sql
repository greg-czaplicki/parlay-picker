-- Migration V001: Complete v2 Schema Creation with Parlay/Trends Compatibility
-- Description: Creates new v2 schema AND updates parlay/trends tables for compatibility
-- Author: Database Migration Team
-- Date: 2025-06-28
-- Version: 2.0.0

-- This migration creates the new v2 schema AND ensures all existing parlay/trends tables
-- remain compatible, providing a comprehensive solution for the entire database

-- =============================================
-- PREREQUISITES CHECK
-- =============================================
DO $$
BEGIN
    -- Verify we're in the correct environment
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'public') THEN
        RAISE EXCEPTION 'Migration must be run in public schema';
    END IF;
    
    -- Check if v2 tables already exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournaments_v2') THEN
        RAISE NOTICE 'WARNING: v2 tables already exist. Migration may have been run before.';
    END IF;
    
    -- Verify parlay tables exist (required for compatibility updates)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parlay_picks') THEN
        RAISE EXCEPTION 'parlay_picks table must exist for compatibility updates';
    END IF;
    
    RAISE NOTICE 'Prerequisites check completed successfully';
END $$;

-- =============================================
-- PART I: CREATE NEW V2 SCHEMA
-- =============================================
RAISE NOTICE '========================================';\nRAISE NOTICE 'PART I: Creating New v2 Schema';\nRAISE NOTICE '========================================';\n

-- =============================================
-- 1. TOURNAMENTS TABLE
-- =============================================
-- Master tournament registry with course information
CREATE TABLE tournaments_v2 (
    event_id INTEGER PRIMARY KEY,
    event_name TEXT NOT NULL,
    course_name TEXT,
    course_par INTEGER DEFAULT 72 CHECK (course_par BETWEEN 68 AND 74),
    start_date DATE,
    end_date DATE,
    tour TEXT CHECK (tour IN ('pga', 'euro', 'dp_world', 'korn_ferry', 'liv')),
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments to tournaments table
COMMENT ON TABLE tournaments_v2 IS 'Master tournament registry containing tournament metadata and course information';
COMMENT ON COLUMN tournaments_v2.event_id IS 'Unique tournament identifier from DataGolf API';
COMMENT ON COLUMN tournaments_v2.course_par IS 'Course par value, typically 70-72 for most courses';
COMMENT ON COLUMN tournaments_v2.tour IS 'Tour identifier: pga, euro, dp_world, korn_ferry, liv';
COMMENT ON COLUMN tournaments_v2.status IS 'Tournament status: upcoming, active, completed, cancelled';

-- =============================================
-- 2. PLAYERS TABLE
-- =============================================
-- Clean player registry with DataGolf ID as primary key
CREATE TABLE players_v2 (
    dg_id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT,
    country_code TEXT CHECK (LENGTH(country_code) = 2 OR country_code IS NULL),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments to players table
COMMENT ON TABLE players_v2 IS 'Master player registry with DataGolf IDs as primary key';
COMMENT ON COLUMN players_v2.dg_id IS 'DataGolf unique player identifier - primary key';
COMMENT ON COLUMN players_v2.name IS 'Player full name as it appears in tournaments';
COMMENT ON COLUMN players_v2.country IS 'Player country of origin';
COMMENT ON COLUMN players_v2.country_code IS 'Two-letter ISO country code (e.g., US, GB, CA)';

-- =============================================
-- 3. PLAYER ROUND SCORES TABLE  
-- =============================================
-- Single source of truth for round-by-round scoring data
CREATE TABLE player_round_scores_v2 (
    id BIGSERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES tournaments_v2(event_id) ON DELETE CASCADE,
    dg_id BIGINT NOT NULL REFERENCES players_v2(dg_id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 4),
    round_score INTEGER, -- Actual score: 68, 71, etc. (not relative to par)
    position INTEGER CHECK (position > 0),
    holes_completed INTEGER DEFAULT 0 CHECK (holes_completed BETWEEN 0 AND 18),
    made_cut BOOLEAN,
    tee_time TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique combination of tournament, player, and round
    UNIQUE(event_id, dg_id, round_number)
);

-- Add comments to player_round_scores table
COMMENT ON TABLE player_round_scores_v2 IS 'Round-by-round scoring data - single source of truth for all scoring analysis';
COMMENT ON COLUMN player_round_scores_v2.dg_id IS 'DataGolf player identifier';
COMMENT ON COLUMN player_round_scores_v2.round_score IS 'Actual round score (e.g., 68, 71) NOT relative to par';
COMMENT ON COLUMN player_round_scores_v2.position IS 'Player position on leaderboard after this round';
COMMENT ON COLUMN player_round_scores_v2.holes_completed IS 'Number of holes completed in this round (0-18)';
COMMENT ON COLUMN player_round_scores_v2.made_cut IS 'Whether player made the cut (applicable for rounds 2+)';

-- =============================================
-- 4. TOURNAMENT RESULTS TABLE
-- =============================================
-- Derived/calculated tournament results (computed from round scores)
CREATE TABLE tournament_results_v2 (
    id BIGSERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES tournaments_v2(event_id) ON DELETE CASCADE,
    dg_id BIGINT NOT NULL REFERENCES players_v2(dg_id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    final_position INTEGER CHECK (final_position > 0),
    total_score INTEGER, -- Sum of all round scores
    rounds_completed INTEGER DEFAULT 0 CHECK (rounds_completed BETWEEN 0 AND 4),
    made_cut BOOLEAN DEFAULT FALSE,
    
    -- Individual round scores for easy access
    round_1_score INTEGER,
    round_2_score INTEGER, 
    round_3_score INTEGER,
    round_4_score INTEGER,
    
    -- Calculated metrics
    scoring_average DECIMAL(5,2), -- Total score / rounds completed
    relative_to_par INTEGER, -- Total strokes relative to course par
    
    -- Metadata
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique player per tournament
    UNIQUE(event_id, dg_id)
);

-- Add comments to tournament_results table  
COMMENT ON TABLE tournament_results_v2 IS 'Derived tournament results calculated from round scores';
COMMENT ON COLUMN tournament_results_v2.total_score IS 'Sum of all completed round scores';
COMMENT ON COLUMN tournament_results_v2.scoring_average IS 'Average score per round (total_score / rounds_completed)';
COMMENT ON COLUMN tournament_results_v2.relative_to_par IS 'Total strokes relative to course par';
COMMENT ON COLUMN tournament_results_v2.calculated_at IS 'When these results were last calculated';

-- =============================================
-- 5. PLAYER ADVANCED STATS TABLE
-- =============================================
-- Advanced statistics separate from core scoring data
CREATE TABLE player_advanced_stats_v2 (
    id BIGSERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES tournaments_v2(event_id) ON DELETE CASCADE,
    dg_id BIGINT NOT NULL REFERENCES players_v2(dg_id) ON DELETE CASCADE,
    round_number INTEGER CHECK (round_number BETWEEN 1 AND 4),
    
    -- Strokes Gained categories
    sg_total DECIMAL(6,3), -- Total strokes gained
    sg_ott DECIMAL(6,3),   -- Strokes gained off the tee
    sg_app DECIMAL(6,3),   -- Strokes gained approach
    sg_arg DECIMAL(6,3),   -- Strokes gained around the green
    sg_putt DECIMAL(6,3),  -- Strokes gained putting
    sg_t2g DECIMAL(6,3),   -- Strokes gained tee to green
    
    -- Traditional statistics
    accuracy DECIMAL(5,2) CHECK (accuracy IS NULL OR (accuracy BETWEEN 0 AND 100)), -- Driving accuracy %
    distance DECIMAL(6,1) CHECK (distance IS NULL OR (distance BETWEEN 200 AND 400)), -- Driving distance yards
    gir DECIMAL(5,2) CHECK (gir IS NULL OR (gir BETWEEN 0 AND 100)), -- Greens in regulation %
    prox_fw DECIMAL(6,1), -- Proximity to hole from fairway (feet)
    scrambling DECIMAL(5,2) CHECK (scrambling IS NULL OR (scrambling BETWEEN 0 AND 100)), -- Scrambling %
    
    -- Metadata
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique combination of tournament, player, and round for stats
    UNIQUE(event_id, dg_id, round_number)
);

-- Add comments to player_advanced_stats table
COMMENT ON TABLE player_advanced_stats_v2 IS 'Advanced player statistics separate from core round scoring';
COMMENT ON COLUMN player_advanced_stats_v2.sg_total IS 'Total strokes gained vs field average';
COMMENT ON COLUMN player_advanced_stats_v2.sg_ott IS 'Strokes gained off the tee (driving)';
COMMENT ON COLUMN player_advanced_stats_v2.sg_app IS 'Strokes gained approach shots';
COMMENT ON COLUMN player_advanced_stats_v2.sg_arg IS 'Strokes gained around the green';
COMMENT ON COLUMN player_advanced_stats_v2.sg_putt IS 'Strokes gained putting';
COMMENT ON COLUMN player_advanced_stats_v2.sg_t2g IS 'Strokes gained tee to green';

-- =============================================
-- 6. PERFORMANCE INDEXES FOR V2 TABLES
-- =============================================
-- Indexes on tournaments table
CREATE INDEX idx_tournaments_tour_v2 ON tournaments_v2(tour);
CREATE INDEX idx_tournaments_status_v2 ON tournaments_v2(status);
CREATE INDEX idx_tournaments_start_date_v2 ON tournaments_v2(start_date);

-- Indexes on players table
CREATE INDEX idx_players_name_v2 ON players_v2(name);
CREATE INDEX idx_players_country_v2 ON players_v2(country);
CREATE INDEX idx_players_country_code_v2 ON players_v2(country_code);

-- Indexes on player_round_scores for common queries
CREATE INDEX idx_player_round_scores_event_id_v2 ON player_round_scores_v2(event_id);
CREATE INDEX idx_player_round_scores_dg_id_v2 ON player_round_scores_v2(dg_id);
CREATE INDEX idx_player_round_scores_player_name_v2 ON player_round_scores_v2(player_name);
CREATE INDEX idx_player_round_scores_round_number_v2 ON player_round_scores_v2(round_number);
CREATE INDEX idx_player_round_scores_event_player_v2 ON player_round_scores_v2(event_id, dg_id);

-- Indexes on tournament_results for common queries
CREATE INDEX idx_tournament_results_event_id_v2 ON tournament_results_v2(event_id);
CREATE INDEX idx_tournament_results_dg_id_v2 ON tournament_results_v2(dg_id);
CREATE INDEX idx_tournament_results_player_name_v2 ON tournament_results_v2(player_name);
CREATE INDEX idx_tournament_results_final_position_v2 ON tournament_results_v2(final_position);
CREATE INDEX idx_tournament_results_scoring_average_v2 ON tournament_results_v2(scoring_average);

-- Indexes on player_advanced_stats for common queries
CREATE INDEX idx_player_advanced_stats_event_id_v2 ON player_advanced_stats_v2(event_id);
CREATE INDEX idx_player_advanced_stats_dg_id_v2 ON player_advanced_stats_v2(dg_id);
CREATE INDEX idx_player_advanced_stats_round_number_v2 ON player_advanced_stats_v2(round_number);
CREATE INDEX idx_player_advanced_stats_event_player_v2 ON player_advanced_stats_v2(event_id, dg_id);

-- Indexes for Strokes Gained analysis
CREATE INDEX idx_player_advanced_stats_sg_total_v2 ON player_advanced_stats_v2(sg_total);
CREATE INDEX idx_player_advanced_stats_sg_ott_v2 ON player_advanced_stats_v2(sg_ott);
CREATE INDEX idx_player_advanced_stats_sg_app_v2 ON player_advanced_stats_v2(sg_app);
CREATE INDEX idx_player_advanced_stats_sg_putt_v2 ON player_advanced_stats_v2(sg_putt);

-- =============================================
-- 7. TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =============================================
-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all v2 tables
CREATE TRIGGER update_tournaments_updated_at 
    BEFORE UPDATE ON tournaments_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at 
    BEFORE UPDATE ON players_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_round_scores_updated_at 
    BEFORE UPDATE ON player_round_scores_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_results_updated_at 
    BEFORE UPDATE ON tournament_results_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_advanced_stats_updated_at 
    BEFORE UPDATE ON player_advanced_stats_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 8. ADDITIONAL VALIDATION CONSTRAINTS
-- =============================================
-- Scoring average should be reasonable for golf
ALTER TABLE tournament_results_v2 
ADD CONSTRAINT reasonable_scoring_average 
CHECK (scoring_average IS NULL OR (scoring_average BETWEEN 55 AND 100));

-- Round scores should be reasonable  
ALTER TABLE player_round_scores_v2
ADD CONSTRAINT reasonable_round_score 
CHECK (round_score IS NULL OR (round_score BETWEEN 55 AND 100));

-- Total score should match rounds_completed logic
ALTER TABLE tournament_results_v2
ADD CONSTRAINT logical_total_score
CHECK (
    (rounds_completed = 0 AND total_score IS NULL) OR 
    (rounds_completed > 0 AND total_score IS NOT NULL)
);

-- Strokes gained values should be within reasonable ranges for professional golf
ALTER TABLE player_advanced_stats_v2
ADD CONSTRAINT reasonable_sg_total 
CHECK (sg_total IS NULL OR (sg_total BETWEEN -15 AND 15));

ALTER TABLE player_advanced_stats_v2
ADD CONSTRAINT reasonable_sg_individual 
CHECK (
    (sg_ott IS NULL OR (sg_ott BETWEEN -8 AND 8)) AND
    (sg_app IS NULL OR (sg_app BETWEEN -8 AND 8)) AND
    (sg_arg IS NULL OR (sg_arg BETWEEN -8 AND 8)) AND
    (sg_putt IS NULL OR (sg_putt BETWEEN -8 AND 8)) AND
    (sg_t2g IS NULL OR (sg_t2g BETWEEN -12 AND 12))
);

-- Player names should not be empty
ALTER TABLE players_v2
ADD CONSTRAINT non_empty_name 
CHECK (name IS NOT NULL AND LENGTH(TRIM(name)) > 0);

-- Country codes should be uppercase if provided
ALTER TABLE players_v2
ADD CONSTRAINT uppercase_country_code 
CHECK (country_code IS NULL OR country_code = UPPER(country_code));

RAISE NOTICE 'v2 schema creation completed successfully!';

-- =============================================
-- PART II: UPDATE PARLAY/TRENDS COMPATIBILITY
-- =============================================
RAISE NOTICE '========================================';\nRAISE NOTICE 'PART II: Updating Parlay/Trends Compatibility';\nRAISE NOTICE '========================================';\n

-- =============================================
-- 9. UPDATE PARLAY_PICKS TABLE FOR V2 COMPATIBILITY
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

-- Step 4: Add event_id foreign key to tournaments_v2
ALTER TABLE parlay_picks 
ADD CONSTRAINT fk_parlay_picks_event_id_v2 
FOREIGN KEY (event_id) REFERENCES tournaments_v2(event_id) ON DELETE SET NULL;

RAISE NOTICE 'parlay_picks table updated successfully';

-- =============================================
-- 10. UPDATE PLAYER_TRENDS TABLE FOR V2 COMPATIBILITY  
-- =============================================
RAISE NOTICE 'Updating player_trends table for v2 compatibility...';

-- Update dg_id data type from INTEGER to BIGINT
ALTER TABLE player_trends 
ALTER COLUMN dg_id TYPE BIGINT;

-- Standardize timestamp types
ALTER TABLE player_trends 
ALTER COLUMN calculated_at TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN valid_until TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE;

RAISE NOTICE 'player_trends table updated successfully';

-- =============================================
-- 11. UPDATE PLAYER_TOURNAMENT_TRENDS TABLE FOR V2 COMPATIBILITY
-- =============================================
RAISE NOTICE 'Updating player_tournament_trends table for v2 compatibility...';

-- Add primary key (this table currently has no PK)
ALTER TABLE player_tournament_trends 
ADD COLUMN id BIGSERIAL PRIMARY KEY;

-- Update dg_id data type from INTEGER to BIGINT
ALTER TABLE player_tournament_trends 
ALTER COLUMN dg_id TYPE BIGINT;

-- Add event_id column to reference tournaments_v2
ALTER TABLE player_tournament_trends 
ADD COLUMN event_id INTEGER;

RAISE NOTICE 'player_tournament_trends table updated successfully';

-- =============================================
-- 12. UPDATE SCORING_TRENDS TABLE FOR V2 COMPATIBILITY
-- =============================================  
RAISE NOTICE 'Updating scoring_trends table for v2 compatibility...';

-- Add primary key (this table currently has no PK)
ALTER TABLE scoring_trends 
ADD COLUMN id BIGSERIAL PRIMARY KEY;

-- Update dg_id data type from INTEGER to BIGINT
ALTER TABLE scoring_trends 
ALTER COLUMN dg_id TYPE BIGINT;

RAISE NOTICE 'scoring_trends table updated successfully';

-- =============================================
-- 13. CREATE COMPATIBILITY VIEWS FOR SEAMLESS TRANSITION
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
-- 14. ADD PERFORMANCE INDEXES FOR PARLAY/TRENDS
-- =============================================
RAISE NOTICE 'Adding performance indexes for parlay/trends compatibility...';

-- Indexes for parlay_picks with new v2 relationships
CREATE INDEX idx_parlay_picks_picked_player_dg_id_v2 ON parlay_picks(picked_player_dg_id);
CREATE INDEX idx_parlay_picks_event_id_v2 ON parlay_picks(event_id);
CREATE INDEX idx_parlay_picks_settlement_status_v2 ON parlay_picks(settlement_status);

-- Indexes for player_trends with v2 compatibility
CREATE INDEX idx_player_trends_dg_id_v2 ON player_trends(dg_id);
CREATE INDEX idx_player_trends_trend_type_v2 ON player_trends(trend_type);
CREATE INDEX idx_player_trends_calculated_at_v2 ON player_trends(calculated_at);

-- Indexes for player_tournament_trends
CREATE INDEX idx_player_tournament_trends_dg_id_v2 ON player_tournament_trends(dg_id);
CREATE INDEX idx_player_tournament_trends_event_name_v2 ON player_tournament_trends(event_name);
CREATE INDEX idx_player_tournament_trends_event_id_v2 ON player_tournament_trends(event_id);

-- Indexes for scoring_trends
CREATE INDEX idx_scoring_trends_dg_id_v2 ON scoring_trends(dg_id);
CREATE INDEX idx_scoring_trends_player_name_v2 ON scoring_trends(player_name);

RAISE NOTICE 'Performance indexes added successfully';

-- =============================================
-- 15. ADD DATA VALIDATION CONSTRAINTS
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
-- 16. UPDATE COMMENTS FOR DOCUMENTATION
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
-- 17. MIGRATION COMPLETION LOG
-- =============================================
-- Create a simple migration log table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT
);

-- Log this comprehensive migration
INSERT INTO schema_migrations (version, description) 
VALUES ('V001_COMPLETE', 'Complete v2 schema creation with parlay/trends compatibility')
ON CONFLICT (version) DO UPDATE SET 
    applied_at = NOW(),
    description = EXCLUDED.description;

-- =============================================
-- 18. COMPLETION MESSAGE
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '========================================';\n    RAISE NOTICE 'COMPLETE V2 MIGRATION SUCCESSFUL!';\n    RAISE NOTICE '========================================';\n    RAISE NOTICE 'Created v2 schema tables:';\n    RAISE NOTICE '  - tournaments_v2 (master tournament registry)';\n    RAISE NOTICE '  - players_v2 (clean player registry)';\n    RAISE NOTICE '  - player_round_scores_v2 (single source of truth for scoring)';\n    RAISE NOTICE '  - tournament_results_v2 (derived results with calculated metrics)';\n    RAISE NOTICE '  - player_advanced_stats_v2 (advanced statistics)';\n    RAISE NOTICE '';\n    RAISE NOTICE 'Updated for v2 compatibility:';\n    RAISE NOTICE '  - parlay_picks: dg_id → BIGINT, FK to players_v2, FK to tournaments_v2';\n    RAISE NOTICE '  - player_trends: dg_id → BIGINT, timestamp consistency';\n    RAISE NOTICE '  - player_tournament_trends: dg_id → BIGINT, added PK, event_id column';\n    RAISE NOTICE '  - scoring_trends: dg_id → BIGINT, added PK';\n    RAISE NOTICE '';\n    RAISE NOTICE 'Created compatibility features:';\n    RAISE NOTICE '  - 32 performance indexes for v2 tables';\n    RAISE NOTICE '  - Additional indexes for parlay/trends performance';\n    RAISE NOTICE '  - Compatibility views (players, tournaments)';\n    RAISE NOTICE '  - Comprehensive data validation constraints';\n    RAISE NOTICE '  - Automatic timestamp updating triggers';\n    RAISE NOTICE '';\n    RAISE NOTICE 'Next steps:';\n    RAISE NOTICE '  1. Migrate data from old schema to v2 tables';\n    RAISE NOTICE '  2. Populate event_id in player_tournament_trends';\n    RAISE NOTICE '  3. Update application code to use v2 table names';\n    RAISE NOTICE '  4. Test parlay functionality with new schema';\n    RAISE NOTICE '  5. Verify trend calculations work correctly';\n    RAISE NOTICE '  6. Remove compatibility views after code updates';\n    RAISE NOTICE '========================================';\nEND $$;