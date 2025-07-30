-- ============================================================================
-- MATCHUP SCHEMA MIGRATION
-- Migration: 003_migrate_matchup_schema.sql
-- Transforms betting_markets from JSON-based to dedicated column schema
-- ============================================================================

-- Step 1: Add new columns for matchup data
ALTER TABLE betting_markets 
ADD COLUMN IF NOT EXISTS event_id INTEGER,
ADD COLUMN IF NOT EXISTS round_num INTEGER,
ADD COLUMN IF NOT EXISTS type VARCHAR(10), -- '2ball' or '3ball'
ADD COLUMN IF NOT EXISTS player1_dg_id INTEGER,
ADD COLUMN IF NOT EXISTS player1_name TEXT,
ADD COLUMN IF NOT EXISTS player2_dg_id INTEGER,
ADD COLUMN IF NOT EXISTS player2_name TEXT,
ADD COLUMN IF NOT EXISTS player3_dg_id INTEGER,
ADD COLUMN IF NOT EXISTS player3_name TEXT,
ADD COLUMN IF NOT EXISTS odds1 DECIMAL(8,2), -- FanDuel odds for player 1
ADD COLUMN IF NOT EXISTS odds2 DECIMAL(8,2), -- FanDuel odds for player 2
ADD COLUMN IF NOT EXISTS odds3 DECIMAL(8,2), -- FanDuel odds for player 3
ADD COLUMN IF NOT EXISTS dg_odds1 DECIMAL(8,2), -- DataGolf odds for player 1
ADD COLUMN IF NOT EXISTS dg_odds2 DECIMAL(8,2), -- DataGolf odds for player 2
ADD COLUMN IF NOT EXISTS dg_odds3 DECIMAL(8,2), -- DataGolf odds for player 3
ADD COLUMN IF NOT EXISTS start_hole INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS tee_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS player1_tee_time TIMESTAMPTZ, -- For 2ball matchups
ADD COLUMN IF NOT EXISTS player2_tee_time TIMESTAMPTZ; -- For 2ball matchups

-- Step 2: Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_betting_markets_event_round ON betting_markets(event_id, round_num);
CREATE INDEX IF NOT EXISTS idx_betting_markets_type ON betting_markets(type);
CREATE INDEX IF NOT EXISTS idx_betting_markets_players ON betting_markets(player1_dg_id, player2_dg_id, player3_dg_id);
CREATE INDEX IF NOT EXISTS idx_betting_markets_updated_at ON betting_markets(updated_at);

-- Step 3: Migrate existing data from JSON to new columns
UPDATE betting_markets 
SET 
    event_id = (
        SELECT t.event_id 
        FROM tournaments t 
        WHERE t.id = betting_markets.tournament_id
        LIMIT 1
    ),
    round_num = COALESCE(betting_markets.round_specific, 1),
    type = CASE 
        WHEN market_subtype = '3ball' THEN '3ball'
        WHEN market_subtype = '2ball' THEN '2ball'
        ELSE '3ball' -- Default fallback
    END,
    player1_dg_id = CASE 
        WHEN group_specific->'players'->0 IS NOT NULL 
        THEN (group_specific->'players'->0)::INTEGER
        ELSE NULL
    END,
    player1_name = CASE 
        WHEN group_specific->'player_names'->>'p1' IS NOT NULL 
        THEN group_specific->'player_names'->>'p1'
        ELSE NULL
    END,
    player2_dg_id = CASE 
        WHEN group_specific->'players'->1 IS NOT NULL 
        THEN (group_specific->'players'->1)::INTEGER
        ELSE NULL
    END,
    player2_name = CASE 
        WHEN group_specific->'player_names'->>'p2' IS NOT NULL 
        THEN group_specific->'player_names'->>'p2'
        ELSE NULL
    END,
    player3_dg_id = CASE 
        WHEN group_specific->'players'->2 IS NOT NULL 
        THEN (group_specific->'players'->2)::INTEGER
        ELSE NULL
    END,
    player3_name = CASE 
        WHEN group_specific->'player_names'->>'p3' IS NOT NULL 
        THEN group_specific->'player_names'->>'p3'
        ELSE NULL
    END,
    odds1 = CASE 
        WHEN group_specific->'player_odds'->>'p1' IS NOT NULL 
        THEN (group_specific->'player_odds'->>'p1')::DECIMAL(8,2)
        ELSE NULL
    END,
    odds2 = CASE 
        WHEN group_specific->'player_odds'->>'p2' IS NOT NULL 
        THEN (group_specific->'player_odds'->>'p2')::DECIMAL(8,2)
        ELSE NULL
    END,
    odds3 = CASE 
        WHEN group_specific->'player_odds'->>'p3' IS NOT NULL 
        THEN (group_specific->'player_odds'->>'p3')::DECIMAL(8,2)
        ELSE NULL
    END,
    dg_odds1 = CASE 
        WHEN group_specific->'dg_odds'->>'p1' IS NOT NULL 
        THEN (group_specific->'dg_odds'->>'p1')::DECIMAL(8,2)
        ELSE NULL
    END,
    dg_odds2 = CASE 
        WHEN group_specific->'dg_odds'->>'p2' IS NOT NULL 
        THEN (group_specific->'dg_odds'->>'p2')::DECIMAL(8,2)
        ELSE NULL
    END,
    dg_odds3 = CASE 
        WHEN group_specific->'dg_odds'->>'p3' IS NOT NULL 
        THEN (group_specific->'dg_odds'->>'p3')::DECIMAL(8,2)
        ELSE NULL
    END,
    start_hole = COALESCE(
        (group_specific->>'start_hole')::INTEGER, 
        1
    ),
    tee_time = CASE 
        WHEN group_specific->>'tee_time' IS NOT NULL 
        THEN (group_specific->>'tee_time')::TIMESTAMPTZ
        ELSE NULL
    END
WHERE market_type = 'matchup' 
AND group_specific IS NOT NULL;

-- Step 4: Add constraints for data integrity
ALTER TABLE betting_markets 
ADD CONSTRAINT chk_matchup_type CHECK (type IN ('2ball', '3ball') OR type IS NULL);

ALTER TABLE betting_markets 
ADD CONSTRAINT chk_matchup_players CHECK (
    (type = '2ball' AND player1_dg_id IS NOT NULL AND player2_dg_id IS NOT NULL AND player3_dg_id IS NULL) OR
    (type = '3ball' AND player1_dg_id IS NOT NULL AND player2_dg_id IS NOT NULL AND player3_dg_id IS NOT NULL) OR
    (type IS NULL) -- Allow NULL for non-matchup records
);

-- Step 5: Create composite unique constraint for the new schema
-- This matches what the ingest endpoint expects
CREATE UNIQUE INDEX IF NOT EXISTS idx_betting_markets_matchup_unique 
ON betting_markets(event_id, round_num, player1_dg_id, player2_dg_id, player3_dg_id)
WHERE type IS NOT NULL;

-- Step 6: Update the updated_at trigger to automatically update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_betting_markets_updated_at ON betting_markets;
CREATE TRIGGER update_betting_markets_updated_at
    BEFORE UPDATE ON betting_markets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Create a view for easy access to matchup data
CREATE OR REPLACE VIEW matchup_view AS
SELECT 
    id,
    event_id,
    round_num,
    type,
    player1_dg_id,
    player1_name,
    player2_dg_id,
    player2_name,
    player3_dg_id,
    player3_name,
    odds1,
    odds2,
    odds3,
    dg_odds1,
    dg_odds2,
    dg_odds3,
    start_hole,
    tee_time,
    player1_tee_time,
    player2_tee_time,
    status,
    created_at,
    updated_at
FROM betting_markets
WHERE type IS NOT NULL
ORDER BY event_id DESC, round_num ASC, created_at DESC;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check migration results
SELECT 
    'Migration Summary' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN type IS NOT NULL THEN 1 END) as migrated_matchups,
    COUNT(CASE WHEN type = '2ball' THEN 1 END) as two_ball_matchups,
    COUNT(CASE WHEN type = '3ball' THEN 1 END) as three_ball_matchups,
    COUNT(CASE WHEN odds1 IS NOT NULL THEN 1 END) as records_with_odds,
    MAX(updated_at) as latest_update
FROM betting_markets;

-- Show sample migrated data
SELECT 
    'Sample Migrated Data' as check_type,
    id,
    event_id,
    round_num,
    type,
    player1_name,
    player2_name,
    player3_name,
    odds1,
    odds2,
    odds3,
    created_at,
    updated_at
FROM betting_markets 
WHERE type IS NOT NULL 
ORDER BY updated_at DESC 
LIMIT 5;

-- Check for any records that failed to migrate
SELECT 
    'Failed Migration Check' as check_type,
    COUNT(*) as records_with_group_specific_but_no_type
FROM betting_markets 
WHERE market_type = 'matchup' 
AND group_specific IS NOT NULL 
AND type IS NULL;

-- Verify indexes were created
SELECT 
    'Index Verification' as check_type,
    indexname,
    tablename
FROM pg_indexes 
WHERE tablename = 'betting_markets' 
AND indexname LIKE '%event%' OR indexname LIKE '%player%' OR indexname LIKE '%type%'
ORDER BY indexname;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN betting_markets.event_id IS 'Tournament event ID - migrated from tournament reference';
COMMENT ON COLUMN betting_markets.round_num IS 'Tournament round number (1-4)';
COMMENT ON COLUMN betting_markets.type IS 'Matchup type: 2ball or 3ball';
COMMENT ON COLUMN betting_markets.player1_dg_id IS 'DataGolf ID for player 1';
COMMENT ON COLUMN betting_markets.player1_name IS 'Display name for player 1';
COMMENT ON COLUMN betting_markets.odds1 IS 'FanDuel odds for player 1 (decimal format)';
COMMENT ON COLUMN betting_markets.dg_odds1 IS 'DataGolf model odds for player 1 (decimal format)';
COMMENT ON COLUMN betting_markets.tee_time IS 'Group tee time (UTC)';
COMMENT ON COLUMN betting_markets.player1_tee_time IS 'Individual player 1 tee time (for 2ball matchups)';

COMMENT ON VIEW matchup_view IS 'Clean view of matchup data with new schema columns';
COMMENT ON INDEX idx_betting_markets_matchup_unique IS 'Unique constraint for matchup upserts matching ingest endpoint expectations';