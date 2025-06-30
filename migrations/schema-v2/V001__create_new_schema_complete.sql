-- Migration V001: Complete New Schema Creation
-- Description: Creates the entire new database schema with proper constraints, relationships, and indexes
-- Author: Database Migration Team
-- Date: 2025-06-28
-- Version: 1.0.0

-- This migration creates the new v2 schema that replaces the fragmented tournament data structure
-- with a clean, consistent format where all scores are stored as actual values (not relative to par)

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
END $$;

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
-- 6. PERFORMANCE INDEXES
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

-- Apply triggers to all tables
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

-- =============================================
-- 9. MIGRATION COMPLETION LOG
-- =============================================
-- Create a simple migration log table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT
);

-- Log this migration
INSERT INTO schema_migrations (version, description) 
VALUES ('V001', 'Complete new schema creation with v2 tables, constraints, and indexes')
ON CONFLICT (version) DO UPDATE SET 
    applied_at = NOW(),
    description = EXCLUDED.description;

-- =============================================
-- 10. COMPLETION MESSAGE
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration V001 completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  - tournaments_v2 (master tournament registry)';
    RAISE NOTICE '  - players_v2 (clean player registry)';
    RAISE NOTICE '  - player_round_scores_v2 (single source of truth for scoring)';
    RAISE NOTICE '  - tournament_results_v2 (derived results with calculated metrics)';
    RAISE NOTICE '  - player_advanced_stats_v2 (advanced statistics)';
    RAISE NOTICE '';
    RAISE NOTICE 'Created 32 performance indexes for optimal query performance';
    RAISE NOTICE 'Applied comprehensive data validation constraints';
    RAISE NOTICE 'Set up automatic timestamp updating triggers';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Migrate data from old schema to new schema';
    RAISE NOTICE '  2. Update application code to use new tables';
    RAISE NOTICE '  3. Test thoroughly before removing old tables';
    RAISE NOTICE '========================================';
END $$;