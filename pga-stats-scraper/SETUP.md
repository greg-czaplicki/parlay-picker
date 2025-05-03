# PGA Stats Scraper Setup Guide

This guide will help you set up the necessary database tables to store PGA Tour stats in your Supabase database.

## Creating Required Tables

1. Log in to your Supabase dashboard: https://app.supabase.io/

2. Open your project and navigate to the SQL Editor (side menu)

3. Create a new query and paste the following SQL:

```sql
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
```

The simplified SQL above should work for most Supabase setups. If you encounter any issues, check the `simplified-setup.sql` file for an alternative version.

4. Click "Run" to execute the SQL and create the tables

5. Verify the tables were created by checking the "Table Editor" in the side menu - you should see `player_season_stats` and `player_id_mappings` (if it didn't exist before).

## Set Up Access Policies (Optional)

For better security, you may want to set up Row-Level Security (RLS) policies for these tables. In most cases, you'll want to:

1. Enable RLS on both tables
2. Create policies that allow authenticated users to read the data
3. Create policies that only allow service roles to write/update the data

For example:

```sql
-- Enable RLS
ALTER TABLE public.player_season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_id_mappings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow authenticated read access" 
ON public.player_season_stats
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated read access" 
ON public.player_id_mappings
FOR SELECT 
TO authenticated 
USING (true);

-- Only service role can insert/update
CREATE POLICY "Service role can insert/update" 
ON public.player_season_stats
FOR ALL 
TO service_role 
USING (true);

CREATE POLICY "Service role can insert/update" 
ON public.player_id_mappings
FOR ALL 
TO service_role 
USING (true);
```

## Running the PGA Stats Scraper

Once the tables are set up, you can run the scraper:

1. From your application, go to the "Players" tab
2. Select "PGA Tour" as the data source
3. Click "Sync PGA Stats" to run the scraper

The first run may take a few minutes as it has to:
- Scrape all data from the PGA Tour website
- Generate player IDs
- Map player data between PGA Tour and DataGolf (where possible)

## Troubleshooting

If you encounter any issues:

1. Check the browser console for error messages
2. Ensure your Supabase service role key has correct permissions
3. Verify the environment variables are set correctly in your `.env.local` file
4. Run the scraper directly using `npm run debug:full` in the `pga-stats-scraper` directory to see detailed logs