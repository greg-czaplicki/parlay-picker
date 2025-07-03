-- Add missing settlement columns to parlay_picks_v2 table
-- These columns are needed for the settlement service to work properly

-- Add settled_at column
ALTER TABLE parlay_picks_v2
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE;

-- Add settlement_notes column
ALTER TABLE parlay_picks_v2
ADD COLUMN IF NOT EXISTS settlement_notes TEXT;

-- Add index on settled_at for performance
CREATE INDEX IF NOT EXISTS idx_parlay_picks_v2_settled_at 
ON parlay_picks_v2(settled_at) 
WHERE settled_at IS NOT NULL;

-- Add composite index for settlement queries
CREATE INDEX IF NOT EXISTS idx_parlay_picks_v2_settlement_lookup 
ON parlay_picks_v2(event_id, settlement_status) 
WHERE settlement_status = 'pending';

COMMENT ON COLUMN parlay_picks_v2.settled_at IS 'Timestamp when the pick was settled';
COMMENT ON COLUMN parlay_picks_v2.settlement_notes IS 'Notes about the settlement (e.g., reason for win/loss)';