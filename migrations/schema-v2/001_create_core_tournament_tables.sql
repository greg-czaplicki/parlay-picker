-- Migration: Create Core Tournament Tables
-- Description: Creates the core tournament data structure with proper constraints and relationships
-- Author: Database Migration Team
-- Date: 2025-06-28

-- =============================================
-- TOURNAMENTS TABLE
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

-- Add comment to tournaments table
COMMENT ON TABLE tournaments_v2 IS 'Master tournament registry containing tournament metadata and course information';
COMMENT ON COLUMN tournaments_v2.event_id IS 'Unique tournament identifier from DataGolf API';
COMMENT ON COLUMN tournaments_v2.course_par IS 'Course par value, typically 70-72 for most courses';
COMMENT ON COLUMN tournaments_v2.tour IS 'Tour identifier: pga, euro, dp_world, korn_ferry, liv';
COMMENT ON COLUMN tournaments_v2.status IS 'Tournament status: upcoming, active, completed, cancelled';

-- =============================================
-- PLAYER ROUND SCORES TABLE  
-- =============================================
-- Single source of truth for round-by-round scoring data
CREATE TABLE player_round_scores_v2 (
    id BIGSERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES tournaments_v2(event_id) ON DELETE CASCADE,
    dg_id BIGINT NOT NULL,
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
-- TOURNAMENT RESULTS TABLE
-- =============================================
-- Derived/calculated tournament results (computed from round scores)
CREATE TABLE tournament_results_v2 (
    id BIGSERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES tournaments_v2(event_id) ON DELETE CASCADE,
    dg_id BIGINT NOT NULL,
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
-- INDEXES FOR PERFORMANCE
-- =============================================
-- Indexes on player_round_scores for common queries
CREATE INDEX idx_player_round_scores_event_id ON player_round_scores_v2(event_id);
CREATE INDEX idx_player_round_scores_dg_id ON player_round_scores_v2(dg_id);
CREATE INDEX idx_player_round_scores_player_name ON player_round_scores_v2(player_name);
CREATE INDEX idx_player_round_scores_round_number ON player_round_scores_v2(round_number);
CREATE INDEX idx_player_round_scores_event_player ON player_round_scores_v2(event_id, dg_id);

-- Indexes on tournament_results for common queries
CREATE INDEX idx_tournament_results_event_id ON tournament_results_v2(event_id);
CREATE INDEX idx_tournament_results_dg_id ON tournament_results_v2(dg_id);
CREATE INDEX idx_tournament_results_player_name ON tournament_results_v2(player_name);
CREATE INDEX idx_tournament_results_final_position ON tournament_results_v2(final_position);
CREATE INDEX idx_tournament_results_scoring_average ON tournament_results_v2(scoring_average);

-- Indexes on tournaments for common queries
CREATE INDEX idx_tournaments_tour ON tournaments_v2(tour);
CREATE INDEX idx_tournaments_status ON tournaments_v2(status);
CREATE INDEX idx_tournaments_start_date ON tournaments_v2(start_date);

-- =============================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =============================================
-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to tournaments table
CREATE TRIGGER update_tournaments_updated_at 
    BEFORE UPDATE ON tournaments_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply the trigger to player_round_scores table
CREATE TRIGGER update_player_round_scores_updated_at 
    BEFORE UPDATE ON player_round_scores_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply the trigger to tournament_results table  
CREATE TRIGGER update_tournament_results_updated_at 
    BEFORE UPDATE ON tournament_results_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VALIDATION CONSTRAINTS
-- =============================================
-- Additional constraint: scoring_average should be reasonable for golf
ALTER TABLE tournament_results_v2 
ADD CONSTRAINT reasonable_scoring_average 
CHECK (scoring_average IS NULL OR (scoring_average BETWEEN 55 AND 100));

-- Additional constraint: round scores should be reasonable  
ALTER TABLE player_round_scores_v2
ADD CONSTRAINT reasonable_round_score 
CHECK (round_score IS NULL OR (round_score BETWEEN 55 AND 100));

-- Additional constraint: total_score should match rounds_completed logic
ALTER TABLE tournament_results_v2
ADD CONSTRAINT logical_total_score
CHECK (
    (rounds_completed = 0 AND total_score IS NULL) OR 
    (rounds_completed > 0 AND total_score IS NOT NULL)
);