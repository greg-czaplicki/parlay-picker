-- Migration: Create Matchups v2 Table
-- Description: Creates the matchups table following v2 schema patterns using dg_id as primary identifier
-- Author: Database Migration Team
-- Date: 2025-07-03
-- Version: 1.0.0

-- =============================================
-- MATCHUPS V2 TABLE
-- =============================================
-- Betting matchups data with DataGolf IDs as primary player identifiers
CREATE TABLE matchups_v2 (
    id BIGSERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES tournaments_v2(event_id) ON DELETE CASCADE,
    round_num INTEGER NOT NULL CHECK (round_num BETWEEN 1 AND 4),
    type TEXT NOT NULL CHECK (type IN ('2ball', '3ball')),
    
    -- Player 1 (always required)
    player1_dg_id BIGINT NOT NULL REFERENCES players_v2(dg_id) ON DELETE CASCADE,
    player1_name TEXT NOT NULL,
    
    -- Player 2 (always required)
    player2_dg_id BIGINT NOT NULL REFERENCES players_v2(dg_id) ON DELETE CASCADE,
    player2_name TEXT NOT NULL,
    
    -- Player 3 (only for 3-ball matchups)
    player3_dg_id BIGINT REFERENCES players_v2(dg_id) ON DELETE CASCADE,
    player3_name TEXT,
    
    -- Odds from sportsbooks
    odds1 DECIMAL(6,3),  -- Player 1 odds
    odds2 DECIMAL(6,3),  -- Player 2 odds
    odds3 DECIMAL(6,3),  -- Player 3 odds (3-ball only)
    
    -- DataGolf model odds
    dg_odds1 DECIMAL(6,3),  -- Player 1 DG model odds
    dg_odds2 DECIMAL(6,3),  -- Player 2 DG model odds
    dg_odds3 DECIMAL(6,3),  -- Player 3 DG model odds (3-ball only)
    
    -- Tee time information
    start_hole INTEGER DEFAULT 1 CHECK (start_hole IN (1, 10)),
    tee_time TIMESTAMP WITH TIME ZONE,  -- Group tee time
    
    -- Individual player tee times (for 2-ball when players have different times)
    player1_tee_time TIMESTAMP WITH TIME ZONE,
    player2_tee_time TIMESTAMP WITH TIME ZONE,
    
    -- Result tracking (populated after round completion)
    player1_score INTEGER CHECK (player1_score IS NULL OR player1_score BETWEEN 55 AND 100),
    player2_score INTEGER CHECK (player2_score IS NULL OR player2_score BETWEEN 55 AND 100),
    player3_score INTEGER CHECK (player3_score IS NULL OR player3_score BETWEEN 55 AND 100),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique matchup per event/round/players
    UNIQUE(event_id, round_num, player1_dg_id, player2_dg_id, player3_dg_id),
    
    -- Ensure 3-ball matchups have all three players
    CONSTRAINT valid_3ball_matchup CHECK (
        (type = '2ball' AND player3_dg_id IS NULL AND player3_name IS NULL) OR
        (type = '3ball' AND player3_dg_id IS NOT NULL AND player3_name IS NOT NULL)
    ),
    
    -- Ensure odds consistency with matchup type
    CONSTRAINT valid_odds_for_type CHECK (
        (type = '2ball' AND odds3 IS NULL AND dg_odds3 IS NULL) OR
        (type = '3ball')
    )
);

-- Add comments to matchups table
COMMENT ON TABLE matchups_v2 IS 'Betting matchups (2-ball and 3-ball) with odds and results';
COMMENT ON COLUMN matchups_v2.event_id IS 'Tournament ID from tournaments_v2';
COMMENT ON COLUMN matchups_v2.round_num IS 'Round number (1-4)';
COMMENT ON COLUMN matchups_v2.type IS 'Matchup type: 2ball or 3ball';
COMMENT ON COLUMN matchups_v2.player1_dg_id IS 'DataGolf ID for player 1';
COMMENT ON COLUMN matchups_v2.player2_dg_id IS 'DataGolf ID for player 2';
COMMENT ON COLUMN matchups_v2.player3_dg_id IS 'DataGolf ID for player 3 (3-ball only)';
COMMENT ON COLUMN matchups_v2.odds1 IS 'Sportsbook odds for player 1';
COMMENT ON COLUMN matchups_v2.odds2 IS 'Sportsbook odds for player 2';
COMMENT ON COLUMN matchups_v2.odds3 IS 'Sportsbook odds for player 3 (3-ball only)';
COMMENT ON COLUMN matchups_v2.dg_odds1 IS 'DataGolf model odds for player 1';
COMMENT ON COLUMN matchups_v2.dg_odds2 IS 'DataGolf model odds for player 2';
COMMENT ON COLUMN matchups_v2.dg_odds3 IS 'DataGolf model odds for player 3 (3-ball only)';
COMMENT ON COLUMN matchups_v2.tee_time IS 'Group tee time for the matchup';
COMMENT ON COLUMN matchups_v2.player1_tee_time IS 'Individual tee time for player 1 (if different from group)';
COMMENT ON COLUMN matchups_v2.player2_tee_time IS 'Individual tee time for player 2 (if different from group)';
COMMENT ON COLUMN matchups_v2.player1_score IS 'Final round score for player 1';
COMMENT ON COLUMN matchups_v2.player2_score IS 'Final round score for player 2';
COMMENT ON COLUMN matchups_v2.player3_score IS 'Final round score for player 3 (3-ball only)';

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
-- Primary lookup indexes
CREATE INDEX idx_matchups_event_id_v2 ON matchups_v2(event_id);
CREATE INDEX idx_matchups_round_num_v2 ON matchups_v2(round_num);
CREATE INDEX idx_matchups_type_v2 ON matchups_v2(type);
CREATE INDEX idx_matchups_event_round_v2 ON matchups_v2(event_id, round_num);

-- Player lookup indexes
CREATE INDEX idx_matchups_player1_dg_id_v2 ON matchups_v2(player1_dg_id);
CREATE INDEX idx_matchups_player2_dg_id_v2 ON matchups_v2(player2_dg_id);
CREATE INDEX idx_matchups_player3_dg_id_v2 ON matchups_v2(player3_dg_id);

-- Time-based queries
CREATE INDEX idx_matchups_tee_time_v2 ON matchups_v2(tee_time);
CREATE INDEX idx_matchups_created_at_v2 ON matchups_v2(created_at);

-- Odds analysis
CREATE INDEX idx_matchups_has_odds_v2 ON matchups_v2(event_id, round_num) WHERE odds1 IS NOT NULL;

-- =============================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =============================================
CREATE TRIGGER update_matchups_updated_at 
    BEFORE UPDATE ON matchups_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMPATIBILITY VIEW
-- =============================================
-- Create a view that mimics the old matchups table structure for backward compatibility
CREATE OR REPLACE VIEW matchups AS
SELECT 
    -- Generate a UUID from the id for backward compatibility
    gen_random_uuid() as uuid,
    event_id,
    round_num,
    type,
    -- Old schema had UUID player IDs - we'll return NULL since v2 doesn't use them
    NULL::uuid as player1_id,
    player1_dg_id::integer as player1_dg_id,  -- Cast back to integer for compatibility
    player1_name,
    NULL::uuid as player2_id,
    player2_dg_id::integer as player2_dg_id,
    player2_name,
    NULL::uuid as player3_id,
    player3_dg_id::integer as player3_dg_id,
    player3_name,
    odds1::numeric as odds1,
    odds2::numeric as odds2,
    odds3::numeric as odds3,
    dg_odds1::numeric as dg_odds1,
    dg_odds2::numeric as dg_odds2,
    dg_odds3::numeric as dg_odds3,
    start_hole,
    -- Convert timestamp back to text for teetime field
    tee_time::text as teetime,
    tee_time,
    created_at,
    player1_score,
    player2_score,
    player3_score,
    player1_tee_time,
    player2_tee_time,
    -- Convert timestamps back to text for individual teetimes
    player1_tee_time::text as player1_teetime,
    player2_tee_time::text as player2_teetime
FROM matchups_v2;

-- Add comment to the view
COMMENT ON VIEW matchups IS 'Compatibility view for matchups - points to matchups_v2 table';

-- =============================================
-- DATA MIGRATION FUNCTION
-- =============================================
-- Function to migrate data from old matchups table to matchups_v2
CREATE OR REPLACE FUNCTION migrate_matchups_to_v2() RETURNS void AS $$
DECLARE
    migrated_count INTEGER;
BEGIN
    -- Check if old matchups table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matchups' AND table_schema = 'public') THEN
        -- Rename old table to preserve it
        ALTER TABLE matchups RENAME TO matchups_old;
        
        -- Insert data into new v2 table
        INSERT INTO matchups_v2 (
            event_id, round_num, type,
            player1_dg_id, player1_name,
            player2_dg_id, player2_name,
            player3_dg_id, player3_name,
            odds1, odds2, odds3,
            dg_odds1, dg_odds2, dg_odds3,
            start_hole, tee_time,
            player1_tee_time, player2_tee_time,
            player1_score, player2_score, player3_score,
            created_at
        )
        SELECT 
            event_id, round_num, type,
            player1_dg_id::bigint, player1_name,
            player2_dg_id::bigint, player2_name,
            player3_dg_id::bigint, player3_name,
            odds1, odds2, odds3,
            dg_odds1, dg_odds2, dg_odds3,
            start_hole, 
            tee_time,  -- Already timestamp
            player1_tee_time, player2_tee_time,
            player1_score, player2_score, player3_score,
            created_at
        FROM matchups_old;
        
        GET DIAGNOSTICS migrated_count = ROW_COUNT;
        RAISE NOTICE 'Migrated % matchups to v2 table', migrated_count;
        
        -- The view will now provide backward compatibility
        RAISE NOTICE 'Old matchups table renamed to matchups_old, view created for compatibility';
    ELSE
        RAISE NOTICE 'No existing matchups table found, skipping migration';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Run the migration
SELECT migrate_matchups_to_v2();

-- Drop the migration function
DROP FUNCTION migrate_matchups_to_v2();

-- =============================================
-- COMPLETION MESSAGE
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Matchups v2 Table Migration Completed!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '  - matchups_v2 table with dg_id as primary identifier';
    RAISE NOTICE '  - Performance indexes for common queries';
    RAISE NOTICE '  - Compatibility view "matchups" for backward compatibility';
    RAISE NOTICE '  - Data migrated from old table (if existed)';
    RAISE NOTICE '';
    RAISE NOTICE 'The new matchups_v2 table:';
    RAISE NOTICE '  - Uses BIGINT dg_id to match players_v2';
    RAISE NOTICE '  - Has proper foreign key constraints';
    RAISE NOTICE '  - Includes validation for matchup types';
    RAISE NOTICE '  - Supports both 2-ball and 3-ball matchups';
    RAISE NOTICE '';
    RAISE NOTICE 'Update your application code to:';
    RAISE NOTICE '  - Insert into matchups_v2 directly';
    RAISE NOTICE '  - Remove UUID generation/lookup code';
    RAISE NOTICE '  - Use dg_id as the player identifier';
    RAISE NOTICE '========================================';
END $$;