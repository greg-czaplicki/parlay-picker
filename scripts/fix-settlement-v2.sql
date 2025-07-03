-- Fix settlement service to work with v2 schema
-- Run this script in Supabase SQL Editor

-- 1. Add missing columns to parlay_picks_v2
ALTER TABLE parlay_picks_v2
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE parlay_picks_v2
ADD COLUMN IF NOT EXISTS settlement_notes TEXT;

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_parlay_picks_v2_settled_at 
ON parlay_picks_v2(settled_at) 
WHERE settled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parlay_picks_v2_settlement_lookup 
ON parlay_picks_v2(event_id, settlement_status) 
WHERE settlement_status = 'pending';

-- 3. Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'parlay_picks_v2'
AND column_name IN ('settled_at', 'settlement_notes');

-- 4. Check for any unsettled BMW Championship parlays
SELECT 
    pp.id,
    pp.parlay_id,
    pp.picked_player_name,
    pp.settlement_status,
    pp.pick_outcome,
    m.event_id,
    t.event_name
FROM parlay_picks_v2 pp
JOIN matchups_v2 m ON pp.matchup_id = m.id
JOIN tournaments_v2 t ON m.event_id = t.event_id
WHERE t.event_name LIKE '%BMW%'
AND pp.settlement_status = 'pending'
ORDER BY pp.created_at DESC;

-- 5. If you see unsettled picks above, you can trigger settlement via the API