-- ============================================================================
-- TOURNAMENT SNAPSHOT ARCHITECTURE FOR ML & TREND ANALYSIS
-- Migration: 001_create_tournament_snapshot_tables.sql
-- Creates snapshot tables to preserve historical tournament states
-- ============================================================================

-- 1. Tournament Round Snapshots - Main snapshot table
CREATE TABLE tournament_round_snapshots (
  id BIGSERIAL PRIMARY KEY,
  
  -- Tournament Context
  event_id INTEGER NOT NULL, -- References tournaments table
  event_name TEXT NOT NULL,
  round_num TEXT NOT NULL, -- '1', '2', '3', '4', 'event_avg'
  
  -- Snapshot Metadata
  snapshot_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_source TEXT NOT NULL DEFAULT 'datagolf_api',
  snapshot_type TEXT NOT NULL DEFAULT 'round_update', -- 'round_end', 'live_update', 'final'
  
  -- Player Data (denormalized for ML efficiency)
  dg_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  
  -- Scores & Position
  position TEXT, -- 'T1', '2', 'CUT', etc.
  position_numeric INTEGER, -- For sorting/ML (extracted from position)
  total_score INTEGER, -- To par (cumulative)
  round_score INTEGER, -- Today's round to par
  thru INTEGER, -- Holes completed
  
  -- Strokes Gained (the ML gold!)
  sg_total DECIMAL(10,3),
  sg_ott DECIMAL(10,3), -- Off the tee
  sg_app DECIMAL(10,3), -- Approach
  sg_arg DECIMAL(10,3), -- Around the green
  sg_putt DECIMAL(10,3), -- Putting
  sg_t2g DECIMAL(10,3), -- Tee to green
  
  -- Traditional Stats
  accuracy DECIMAL(5,2),
  distance DECIMAL(5,1),
  gir DECIMAL(5,2), -- Greens in regulation
  prox_fw DECIMAL(5,2), -- Proximity to fairway
  scrambling DECIMAL(5,2),
  
  -- ML Features (calculated)
  position_change INTEGER, -- vs previous round
  momentum_score DECIMAL(5,2), -- calculated trend indicator
  
  -- Original timestamp from source
  data_golf_updated_at TIMESTAMPTZ,
  
  -- Ensure uniqueness per snapshot
  UNIQUE(event_id, round_num, dg_id, snapshot_timestamp)
);

-- 2. Position Change Tracking Table
CREATE TABLE player_round_changes (
  id BIGSERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL,
  dg_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  
  from_round TEXT NOT NULL, -- 'R1', 'R2', etc.
  to_round TEXT NOT NULL,
  from_snapshot_id BIGINT REFERENCES tournament_round_snapshots(id),
  to_snapshot_id BIGINT REFERENCES tournament_round_snapshots(id),
  
  -- Position Movement
  position_change INTEGER, -- Positive = improved (moved up), Negative = dropped
  from_position_numeric INTEGER,
  to_position_numeric INTEGER,
  
  -- Score Movement
  score_change INTEGER, -- Change in total score
  round_score INTEGER, -- Score for the to_round
  
  -- Momentum Indicators
  improving BOOLEAN, -- Getting better overall?
  streak_rounds INTEGER, -- How many consecutive rounds of improvement
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tournament Momentum Summary (for quick ML access)
CREATE TABLE tournament_momentum_summary (
  id BIGSERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL,
  dg_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  
  -- Current Tournament State
  current_round TEXT NOT NULL,
  current_position INTEGER,
  current_total_score INTEGER,
  
  -- Trend Analysis
  rounds_played INTEGER DEFAULT 0,
  position_trend TEXT, -- 'improving', 'declining', 'steady'
  avg_round_score DECIMAL(5,2),
  best_round_score INTEGER,
  worst_round_score INTEGER,
  
  -- ML-Ready Features
  momentum_score DECIMAL(5,2), -- Weighted momentum indicator
  consistency_score DECIMAL(5,2), -- How consistent round-to-round
  pressure_performance DECIMAL(5,2), -- Performance in later rounds
  
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(event_id, dg_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Core lookup indexes
CREATE INDEX idx_tournament_snapshots_event_round ON tournament_round_snapshots(event_id, round_num);
CREATE INDEX idx_tournament_snapshots_player ON tournament_round_snapshots(dg_id);
CREATE INDEX idx_tournament_snapshots_timestamp ON tournament_round_snapshots(snapshot_timestamp);
CREATE INDEX idx_tournament_snapshots_event_player_round ON tournament_round_snapshots(event_id, dg_id, round_num);

-- Position change tracking indexes
CREATE INDEX idx_player_changes_event ON player_round_changes(event_id);
CREATE INDEX idx_player_changes_player ON player_round_changes(dg_id);
CREATE INDEX idx_player_changes_round_transition ON player_round_changes(from_round, to_round);

-- Momentum summary indexes
CREATE INDEX idx_momentum_summary_event ON tournament_momentum_summary(event_id);
CREATE INDEX idx_momentum_summary_player ON tournament_momentum_summary(dg_id);
CREATE INDEX idx_momentum_summary_momentum ON tournament_momentum_summary(momentum_score DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to extract numeric position from text position
CREATE OR REPLACE FUNCTION extract_position_numeric(position_text TEXT)
RETURNS INTEGER AS $$
BEGIN
  IF position_text IS NULL OR position_text = '' THEN
    RETURN NULL;
  END IF;
  
  -- Handle 'CUT', 'WD', 'DQ' etc.
  IF position_text ~ '^(CUT|WD|DQ|DNS)' THEN
    RETURN 999; -- Large number for non-finishing positions
  END IF;
  
  -- Extract number from 'T1', '1', 'T15', etc.
  RETURN CAST(regexp_replace(position_text, '[^0-9]', '', 'g') AS INTEGER);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate momentum score
CREATE OR REPLACE FUNCTION calculate_momentum_score(
  current_pos INTEGER,
  prev_pos INTEGER,
  rounds_played INTEGER
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  position_change INTEGER;
  momentum DECIMAL(5,2);
BEGIN
  IF current_pos IS NULL OR prev_pos IS NULL THEN
    RETURN 0.0;
  END IF;
  
  -- Position change (negative = improvement)
  position_change := current_pos - prev_pos;
  
  -- Base momentum score (inverted so positive = good)
  momentum := -position_change::DECIMAL;
  
  -- Weight by rounds played (more confidence with more data)
  momentum := momentum * (rounds_played::DECIMAL / 4.0);
  
  -- Cap at reasonable bounds
  RETURN GREATEST(-50.0, LEAST(50.0, momentum));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- VIEWS FOR EASY ML ACCESS
-- ============================================================================

-- Latest snapshot per player per event
CREATE VIEW latest_tournament_snapshots AS
SELECT DISTINCT ON (event_id, dg_id, round_num) *
FROM tournament_round_snapshots
ORDER BY event_id, dg_id, round_num, snapshot_timestamp DESC;

-- Player performance trends
CREATE VIEW player_tournament_trends AS
SELECT 
  t.event_name,
  s.dg_id,
  s.player_name,
  s.round_num,
  
  -- Current state
  s.position,
  s.position_numeric,
  s.total_score,
  s.round_score,
  s.momentum_score,
  
  -- Trend analysis using window functions
  LAG(s.position_numeric) OVER (
    PARTITION BY s.event_id, s.dg_id 
    ORDER BY s.round_num
  ) as prev_position,
  
  s.position_numeric - LAG(s.position_numeric) OVER (
    PARTITION BY s.event_id, s.dg_id 
    ORDER BY s.round_num
  ) as position_change,
  
  -- Rolling averages for ML
  AVG(s.sg_total) OVER (
    PARTITION BY s.event_id, s.dg_id 
    ORDER BY s.round_num 
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  ) as sg_total_3round_avg,
  
  AVG(s.round_score) OVER (
    PARTITION BY s.event_id, s.dg_id 
    ORDER BY s.round_num 
    ROWS BETWEEN 1 PRECEDING AND CURRENT ROW
  ) as avg_last_2rounds,
  
  s.snapshot_timestamp
FROM latest_tournament_snapshots s
JOIN tournaments t ON s.event_id = t.event_id
ORDER BY s.event_id, s.dg_id, s.round_num;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE tournament_round_snapshots IS 'Historical snapshots of tournament leaderboards for ML analysis';
COMMENT ON TABLE player_round_changes IS 'Position changes between rounds for trend analysis';
COMMENT ON TABLE tournament_momentum_summary IS 'Aggregated momentum indicators per player per tournament';
COMMENT ON VIEW latest_tournament_snapshots IS 'Latest snapshot per player/round for current state queries';
COMMENT ON VIEW player_tournament_trends IS 'ML-ready view with position trends and rolling statistics';

-- ============================================================================
-- MIGRATION VERIFICATION
-- ============================================================================

-- Verify tables were created
SELECT 
  schemaname, 
  tablename, 
  tableowner 
FROM pg_tables 
WHERE tablename IN (
  'tournament_round_snapshots', 
  'player_round_changes', 
  'tournament_momentum_summary'
);

-- Verify indexes were created
SELECT 
  indexname, 
  tablename 
FROM pg_indexes 
WHERE tablename IN (
  'tournament_round_snapshots', 
  'player_round_changes', 
  'tournament_momentum_summary'
);

-- Verify functions were created
SELECT 
  routine_name, 
  routine_type 
FROM information_schema.routines 
WHERE routine_name IN (
  'extract_position_numeric', 
  'calculate_momentum_score'
) AND routine_schema = 'public'; 