-- Migration: Create Player and Stats Tables
-- Description: Creates the player registry and advanced statistics tables with proper constraints
-- Author: Database Migration Team
-- Date: 2025-06-28

-- =============================================
-- PLAYERS TABLE
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
-- PLAYER ADVANCED STATS TABLE
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
COMMENT ON COLUMN player_advanced_stats_v2.accuracy IS 'Driving accuracy percentage (0-100)';
COMMENT ON COLUMN player_advanced_stats_v2.distance IS 'Average driving distance in yards';
COMMENT ON COLUMN player_advanced_stats_v2.gir IS 'Greens in regulation percentage (0-100)';
COMMENT ON COLUMN player_advanced_stats_v2.prox_fw IS 'Average proximity to hole from fairway in feet';
COMMENT ON COLUMN player_advanced_stats_v2.scrambling IS 'Scrambling percentage (0-100)';

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
-- Indexes on players table for common queries
CREATE INDEX idx_players_name_v2 ON players_v2(name);
CREATE INDEX idx_players_country_v2 ON players_v2(country);
CREATE INDEX idx_players_country_code_v2 ON players_v2(country_code);

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
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =============================================
-- Apply the trigger to players table
CREATE TRIGGER update_players_updated_at 
    BEFORE UPDATE ON players_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply the trigger to player_advanced_stats table
CREATE TRIGGER update_player_advanced_stats_updated_at 
    BEFORE UPDATE ON player_advanced_stats_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ADDITIONAL VALIDATION CONSTRAINTS
-- =============================================
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