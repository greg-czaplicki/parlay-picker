-- Fix the unique constraint for player_id_mappings
ALTER TABLE player_id_mappings DROP CONSTRAINT IF EXISTS player_id_mappings_unique;
ALTER TABLE player_id_mappings ADD CONSTRAINT player_id_mappings_pga_player_id_dg_id_key UNIQUE (pga_player_id, dg_id);

-- Create indexes for player_season_stats if they don't exist yet
CREATE INDEX IF NOT EXISTS idx_player_season_stats_pga_id ON player_season_stats(pga_player_id);
CREATE INDEX IF NOT EXISTS idx_player_season_stats_dg_id ON player_season_stats(dg_id);