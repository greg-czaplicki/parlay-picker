# PGA Tour Stats Scraper

This tool scrapes season-long stats from the PGA Tour website and stores them in your Supabase database.

## Features

- Scrapes Strokes Gained statistics (Total, OTT, APP, ARG, Putting)
- Scrapes additional stats (Driving Distance, Driving Accuracy)
- Stores data in a structured format in Supabase
- Can run as a scheduled job or on-demand

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:
   - Already copied from main project's `.env.local`

3. Build the project:

```bash
npm run build
```

## Usage

### Run scraper on demand

Standard run (headless):
```bash
npm start
```

With browser UI visible for debugging:
```bash
npm run debug:full
```

### Run test scraper (checks a single category)

```bash
npm run test:single
```

### Run test scraper with visual debugging

This shows the browser UI and slows down operations for easier troubleshooting:

```bash
npm run debug:single
```

### Set up as scheduled job

The scraper is configured to run weekly on Mondays at 3:00 AM by default. You can change this by adjusting the `SCRAPER_CRON` variable in your `.env` file.

## Database Schema

The scraper expects a `player_season_stats` table in your Supabase database with the following structure:

```sql
CREATE TABLE player_season_stats (
  id serial PRIMARY KEY,
  pga_player_id text NOT NULL,
  player_name text NOT NULL,
  sg_total numeric,
  sg_ott numeric,
  sg_app numeric,
  sg_arg numeric,
  sg_putt numeric,
  driving_accuracy numeric,
  driving_distance numeric,
  updated_at timestamp with time zone DEFAULT now(),
  source_updated_at timestamp with time zone
);

-- Index for faster lookups
CREATE INDEX idx_player_season_stats_pga_id ON player_season_stats(pga_player_id);
```

## Player ID Mapping

To map PGA Tour player IDs to your existing DataGolf IDs, you'll need a `player_id_mappings` table:

```sql
CREATE TABLE player_id_mappings (
  id serial PRIMARY KEY,
  pga_player_id text NOT NULL,
  dg_id integer NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Unique constraints
CREATE UNIQUE INDEX idx_player_id_mappings_unique ON player_id_mappings(pga_player_id, dg_id);
```

## Troubleshooting

- **No data scraped**: The PGA Tour website structure might have changed. Check the selectors in `scraper.ts`.
- **Connection issues**: Verify your network connection and that PGA Tour website is accessible.
- **Database errors**: Confirm your Supabase credentials and that the required tables exist.