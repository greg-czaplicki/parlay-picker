-- Migration: Migrate Parlays to V2 Schema
-- Description: Updates parlays and parlay_picks tables to use integer IDs instead of UUIDs
-- Author: Database Migration Team  
-- Date: 2025-07-03
-- Version: 1.0.0

-- =============================================
-- PARLAYS V2 MIGRATION
-- =============================================

-- 1. Create new parlays_v2 table with integer ID
CREATE TABLE parlays_v2 (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_odds INTEGER,
    potential_payout DECIMAL(10,2) DEFAULT 0.00,
    actual_payout DECIMAL(10,2) DEFAULT 0.00,
    round_num INTEGER,
    outcome TEXT CHECK (outcome IN ('win', 'loss', 'push', 'pending', 'void')),
    payout_amount DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CHECK (amount >= 0),
    CHECK (potential_payout >= 0),
    CHECK (actual_payout >= 0),
    CHECK (payout_amount >= 0)
);

-- 2. Create new parlay_picks_v2 table with integer references
CREATE TABLE parlay_picks_v2 (
    id BIGSERIAL PRIMARY KEY,
    parlay_id BIGINT NOT NULL REFERENCES parlays_v2(id) ON DELETE CASCADE,
    matchup_id BIGINT NOT NULL REFERENCES matchups_v2(id) ON DELETE CASCADE,
    pick INTEGER NOT NULL CHECK (pick BETWEEN 1 AND 3),
    picked_player_name TEXT NOT NULL,
    picked_player_dg_id BIGINT NOT NULL REFERENCES players_v2(dg_id) ON DELETE CASCADE,
    picked_player_odds INTEGER,
    pick_outcome TEXT DEFAULT 'pending' CHECK (pick_outcome IN ('win', 'loss', 'push', 'void', 'pending')),
    outcome TEXT DEFAULT 'void' CHECK (outcome IN ('win', 'loss', 'push', 'void', 'pending')), -- Legacy field
    event_id INTEGER REFERENCES tournaments_v2(event_id) ON DELETE SET NULL,
    settlement_status TEXT DEFAULT 'pending' CHECK (settlement_status IN ('settled', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add indexes for performance
CREATE INDEX idx_parlays_v2_user_id ON parlays_v2(user_id);
CREATE INDEX idx_parlays_v2_created_at ON parlays_v2(created_at);
CREATE INDEX idx_parlays_v2_outcome ON parlays_v2(outcome);

CREATE INDEX idx_parlay_picks_v2_parlay_id ON parlay_picks_v2(parlay_id);
CREATE INDEX idx_parlay_picks_v2_matchup_id ON parlay_picks_v2(matchup_id);
CREATE INDEX idx_parlay_picks_v2_picked_player_dg_id ON parlay_picks_v2(picked_player_dg_id);
CREATE INDEX idx_parlay_picks_v2_event_id ON parlay_picks_v2(event_id);
CREATE INDEX idx_parlay_picks_v2_pick_outcome ON parlay_picks_v2(pick_outcome);

-- 4. Add triggers for automatic timestamp updates
CREATE TRIGGER update_parlays_v2_updated_at 
    BEFORE UPDATE ON parlays_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parlay_picks_v2_updated_at 
    BEFORE UPDATE ON parlay_picks_v2 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Migrate data from old tables to new tables
INSERT INTO parlays_v2 (
    user_id, amount, total_odds, potential_payout, actual_payout, 
    round_num, outcome, payout_amount, created_at
)
SELECT 
    user_id, amount, total_odds, potential_payout, actual_payout,
    round_num, outcome, payout_amount, created_at
FROM parlays;

-- 6. Create a mapping table for UUID to ID conversion
CREATE TEMP TABLE uuid_to_id_mapping AS
SELECT 
    p_old.uuid as old_uuid,
    p_new.id as new_id
FROM parlays p_old
JOIN parlays_v2 p_new ON (
    p_old.user_id = p_new.user_id AND
    p_old.amount = p_new.amount AND
    p_old.created_at = p_new.created_at
);

-- 7. Migrate parlay_picks data using the mapping
INSERT INTO parlay_picks_v2 (
    parlay_id, matchup_id, pick, picked_player_name, picked_player_dg_id,
    picked_player_odds, pick_outcome, outcome, event_id, settlement_status, created_at
)
SELECT 
    mapping.new_id,
    -- Convert matchup UUID to ID by joining with matchups_v2
    COALESCE(mv2.id, 0), -- Use 0 as fallback for missing matchups
    pp.pick,
    pp.picked_player_name,
    pp.picked_player_dg_id,
    pp.picked_player_odds,
    pp.pick_outcome,
    pp.outcome,
    pp.event_id,
    COALESCE(pp.settlement_status, 'pending'),
    pp.created_at
FROM parlay_picks pp
JOIN uuid_to_id_mapping mapping ON pp.parlay_id = mapping.old_uuid
LEFT JOIN matchups_v2 mv2 ON (
    -- Try to match by event, round, and players since we don't have a direct UUID->ID mapping
    mv2.event_id = pp.event_id AND
    mv2.round_num = (SELECT round_num FROM parlays WHERE uuid = pp.parlay_id) AND
    (mv2.player1_dg_id = pp.picked_player_dg_id OR 
     mv2.player2_dg_id = pp.picked_player_dg_id OR 
     mv2.player3_dg_id = pp.picked_player_dg_id)
);

-- 8. Create compatibility views
CREATE OR REPLACE VIEW parlays AS
SELECT 
    gen_random_uuid() as uuid, -- Generate random UUID for compatibility
    id,
    user_id,
    amount,
    total_odds,
    potential_payout,
    actual_payout,
    round_num,
    outcome,
    payout_amount,
    created_at,
    updated_at
FROM parlays_v2;

CREATE OR REPLACE VIEW parlay_picks AS
SELECT 
    gen_random_uuid() as uuid, -- Generate random UUID for compatibility
    id,
    parlay_id,
    matchup_id,
    pick,
    picked_player_name,
    picked_player_dg_id,
    picked_player_odds,
    pick_outcome,
    outcome,
    event_id,
    settlement_status,
    created_at,
    updated_at
FROM parlay_picks_v2;

-- 9. Rename old tables for backup
ALTER TABLE parlays RENAME TO parlays_old;
ALTER TABLE parlay_picks RENAME TO parlay_picks_old;

-- 10. Add comments
COMMENT ON TABLE parlays_v2 IS 'User parlays with integer IDs - v2 schema';
COMMENT ON TABLE parlay_picks_v2 IS 'Individual picks within parlays with integer references - v2 schema';

-- 11. Add completion message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Parlays V2 Migration Completed!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '  - parlays_v2 table with integer IDs';
    RAISE NOTICE '  - parlay_picks_v2 table with integer references';
    RAISE NOTICE '  - Performance indexes';
    RAISE NOTICE '  - Compatibility views';
    RAISE NOTICE '  - Data migration from old tables';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  - Update API code to use parlays_v2 and parlay_picks_v2';
    RAISE NOTICE '  - Test parlay creation and retrieval';
    RAISE NOTICE '  - Remove compatibility views after code updates';
    RAISE NOTICE '========================================';
END $$;