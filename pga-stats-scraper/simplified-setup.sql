-- Create the player_season_stats table for PGA Tour data
CREATE TABLE IF NOT EXISTS player_season_stats (
  id SERIAL PRIMARY KEY,
  pga_player_id TEXT NOT NULL,
  dg_id INTEGER,
  player_name TEXT NOT NULL,
  sg_total NUMERIC,
  sg_ott NUMERIC,
  sg_app NUMERIC,
  sg_arg NUMERIC,
  sg_putt NUMERIC,
  driving_accuracy NUMERIC,
  driving_distance NUMERIC,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source_updated_at TIMESTAMP WITH TIME ZONE
);

-- Create player_id_mappings table
CREATE TABLE IF NOT EXISTS player_id_mappings (
  id SERIAL PRIMARY KEY,
  pga_player_id TEXT NOT NULL,
  dg_id INTEGER NOT NULL,
  player_name TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint to prevent duplicates
ALTER TABLE player_id_mappings 
  ADD CONSTRAINT player_id_mappings_unique UNIQUE (pga_player_id, dg_id);