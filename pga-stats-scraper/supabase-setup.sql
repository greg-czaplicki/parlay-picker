-- Create the player_season_stats table for PGA Tour data
CREATE TABLE IF NOT EXISTS public.player_season_stats (
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_player_season_stats_pga_id ON public.player_season_stats(pga_player_id);
CREATE INDEX IF NOT EXISTS idx_player_season_stats_dg_id ON public.player_season_stats(dg_id);

-- Create player_id_mappings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.player_id_mappings (
  id SERIAL PRIMARY KEY,
  pga_player_id TEXT NOT NULL,
  dg_id INTEGER NOT NULL,
  player_name TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint on player_id_mappings
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_id_mappings_unique ON public.player_id_mappings(pga_player_id, dg_id);

-- Comment: Run this SQL in your Supabase SQL Editor to set up the required tables
-- This can be accessed at: https://app.supabase.io/project/{YOUR_PROJECT_ID}/sql