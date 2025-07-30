-- ============================================================================
-- FILTER PERFORMANCE TRACKING SYSTEM
-- Migration: 002_create_filter_performance_tables.sql
-- Creates tables to track how matchup filters perform across rounds
-- ============================================================================

-- 1. Matchup Results - Records actual outcomes after round completion
CREATE TABLE matchup_results (
  id BIGSERIAL PRIMARY KEY,
  
  -- Matchup Reference
  matchup_id BIGINT NOT NULL, -- References original matchup ID from betting_markets
  event_id INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  round_num INTEGER NOT NULL,
  matchup_type TEXT NOT NULL, -- '2ball' or '3ball'
  
  -- Player Info (denormalized for easier analysis)
  player1_dg_id INTEGER NOT NULL,
  player1_name TEXT NOT NULL,
  player2_dg_id INTEGER NOT NULL,
  player2_name TEXT NOT NULL,
  player3_dg_id INTEGER, -- NULL for 2ball matchups
  player3_name TEXT, -- NULL for 2ball matchups
  
  -- Betting odds at time of matchup
  player1_odds DECIMAL(8,2),
  player2_odds DECIMAL(8,2),  
  player3_odds DECIMAL(8,2),
  player1_dg_odds DECIMAL(8,2),
  player2_dg_odds DECIMAL(8,2),
  player3_dg_odds DECIMAL(8,2),
  
  -- Actual Results
  winner_dg_id INTEGER NOT NULL, -- DG ID of winning player
  winner_name TEXT NOT NULL,
  player1_score INTEGER, -- Round score (to par)
  player2_score INTEGER,
  player3_score INTEGER,
  player1_total_score INTEGER, -- Total tournament score
  player2_total_score INTEGER,
  player3_total_score INTEGER,
  
  -- Metadata
  result_determined_at TIMESTAMPTZ NOT NULL, -- When round completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(matchup_id, event_id, round_num)
);

-- 2. Filter Performance Snapshots - Filter performance per round
CREATE TABLE filter_performance_snapshots (
  id BIGSERIAL PRIMARY KEY,
  
  -- Context
  event_id INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  round_num INTEGER NOT NULL,
  analysis_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Filter being analyzed
  filter_preset TEXT NOT NULL, -- 'fade-chalk', 'stat-dom', 'form-play', 'value', 'data-intel'
  filter_config JSONB, -- Actual filter settings used
  
  -- Performance Metrics
  total_matchups_analyzed INTEGER NOT NULL DEFAULT 0,
  matchups_flagged_by_filter INTEGER NOT NULL DEFAULT 0, -- How many matchups this filter identified
  flagged_matchups_won INTEGER NOT NULL DEFAULT 0, -- How many of those won
  flagged_matchups_lost INTEGER NOT NULL DEFAULT 0,
  
  -- Statistical Performance
  win_rate DECIMAL(5,4), -- Percentage of flagged matchups that won
  expected_win_rate DECIMAL(5,4), -- Based on odds, what should the win rate be
  edge_detected DECIMAL(6,4), -- win_rate - expected_win_rate (positive = filter found real edge)
  
  -- Value Metrics
  total_potential_payout DECIMAL(12,2), -- If you bet $1 on each flagged matchup
  actual_payout DECIMAL(12,2), -- Actual winnings from those bets
  roi_percentage DECIMAL(6,2), -- Return on investment
  
  -- Confidence Metrics  
  sample_size_confidence TEXT, -- 'low', 'medium', 'high' based on matchups_flagged_by_filter
  statistical_significance DECIMAL(4,3), -- p-value for edge_detected being real
  
  -- Performance Breakdown by Matchup Type
  performance_2ball JSONB, -- {flagged: X, won: Y, win_rate: Z}
  performance_3ball JSONB,
  
  UNIQUE(event_id, round_num, filter_preset)
);

-- 3. Filter Historical Performance - Aggregated performance across events
CREATE TABLE filter_historical_performance (
  id BIGSERIAL PRIMARY KEY,
  
  -- Filter Identity
  filter_preset TEXT NOT NULL,
  
  -- Time Window
  analysis_period TEXT NOT NULL, -- 'last_30_days', 'season_2024', 'all_time', etc.
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Aggregate Performance
  total_events_analyzed INTEGER NOT NULL DEFAULT 0,
  total_rounds_analyzed INTEGER NOT NULL DEFAULT 0,
  total_matchups_analyzed INTEGER NOT NULL DEFAULT 0,
  total_matchups_flagged INTEGER NOT NULL DEFAULT 0,
  total_flagged_wins INTEGER NOT NULL DEFAULT 0,
  
  -- Statistical Metrics
  overall_win_rate DECIMAL(5,4),
  overall_expected_win_rate DECIMAL(5,4),
  overall_edge DECIMAL(6,4),
  overall_roi DECIMAL(6,2),
  
  -- Confidence & Reliability
  confidence_score DECIMAL(4,3), -- 0-1 score based on sample size and consistency
  consistency_score DECIMAL(4,3), -- How consistent performance is across events
  trend_direction TEXT, -- 'improving', 'declining', 'stable'
  trend_strength DECIMAL(4,3), -- How strong the trend is
  
  -- Performance by Context
  performance_by_event_type JSONB, -- Different tournament types
  performance_by_round JSONB, -- R1 vs R2 vs R3 vs R4
  performance_by_matchup_type JSONB, -- 2ball vs 3ball
  
  -- Risk Metrics
  max_drawdown DECIMAL(6,2), -- Worst losing streak impact
  volatility DECIMAL(6,4), -- Standard deviation of round-by-round performance
  sharpe_ratio DECIMAL(6,4), -- Risk-adjusted returns
  
  UNIQUE(filter_preset, analysis_period)
);

-- 4. Filter Performance Events - Key events and insights
CREATE TABLE filter_performance_events (
  id BIGSERIAL PRIMARY KEY,
  
  -- Context
  event_id INTEGER,
  round_num INTEGER,
  filter_preset TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'significant_outperformance', 'significant_underperformance', 'edge_detected', 'edge_lost'
  
  -- Event Details
  event_description TEXT NOT NULL,
  impact_magnitude DECIMAL(6,4), -- How significant this event was
  statistical_confidence DECIMAL(4,3),
  
  -- Supporting Data
  supporting_metrics JSONB, -- Additional context about the event
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX(filter_preset, event_type),
  INDEX(created_at)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Matchup Results indexes
CREATE INDEX idx_matchup_results_event_round ON matchup_results(event_id, round_num);
CREATE INDEX idx_matchup_results_matchup ON matchup_results(matchup_id);
CREATE INDEX idx_matchup_results_winner ON matchup_results(winner_dg_id);
CREATE INDEX idx_matchup_results_timestamp ON matchup_results(result_determined_at);

-- Filter Performance Snapshots indexes
CREATE INDEX idx_filter_snapshots_event_round ON filter_performance_snapshots(event_id, round_num);
CREATE INDEX idx_filter_snapshots_filter ON filter_performance_snapshots(filter_preset);
CREATE INDEX idx_filter_snapshots_performance ON filter_performance_snapshots(filter_preset, win_rate DESC);
CREATE INDEX idx_filter_snapshots_timestamp ON filter_performance_snapshots(analysis_timestamp);

-- Historical Performance indexes
CREATE INDEX idx_filter_historical_preset ON filter_historical_performance(filter_preset);
CREATE INDEX idx_filter_historical_period ON filter_historical_performance(analysis_period);
CREATE INDEX idx_filter_historical_performance ON filter_historical_performance(overall_edge DESC);
CREATE INDEX idx_filter_historical_updated ON filter_historical_performance(last_updated);

-- Performance Events indexes  
CREATE INDEX idx_filter_events_preset ON filter_performance_events(filter_preset);
CREATE INDEX idx_filter_events_type ON filter_performance_events(event_type);
CREATE INDEX idx_filter_events_timestamp ON filter_performance_events(created_at);
CREATE INDEX idx_filter_events_event_round ON filter_performance_events(event_id, round_num);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate statistical significance of edge detection
CREATE OR REPLACE FUNCTION calculate_edge_significance(
  flagged_wins INTEGER,
  flagged_total INTEGER,
  expected_win_rate DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  observed_rate DECIMAL;
  z_score DECIMAL;
  p_value DECIMAL;
BEGIN
  IF flagged_total < 10 THEN
    RETURN 1.0; -- Not enough sample size
  END IF;
  
  observed_rate := flagged_wins::DECIMAL / flagged_total::DECIMAL;
  
  -- Simple z-test approximation
  z_score := (observed_rate - expected_win_rate) / SQRT(expected_win_rate * (1 - expected_win_rate) / flagged_total);
  
  -- Convert z-score to p-value (approximation)
  IF ABS(z_score) < 1.96 THEN
    p_value := 0.5; -- Not significant
  ELSIF ABS(z_score) < 2.58 THEN  
    p_value := 0.05; -- 5% significance
  ELSIF ABS(z_score) < 3.29 THEN
    p_value := 0.01; -- 1% significance  
  ELSE
    p_value := 0.001; -- Highly significant
  END IF;
  
  RETURN p_value;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate confidence score based on sample size and consistency
CREATE OR REPLACE FUNCTION calculate_filter_confidence(
  sample_size INTEGER,
  consistency_variance DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  size_score DECIMAL;
  consistency_score DECIMAL;
  final_confidence DECIMAL;
BEGIN
  -- Size score (0-1, with 100+ samples = full confidence)
  size_score := LEAST(1.0, sample_size::DECIMAL / 100.0);
  
  -- Consistency score (lower variance = higher confidence)
  -- Assuming variance is between 0-1, invert it
  consistency_score := GREATEST(0.0, 1.0 - LEAST(1.0, consistency_variance));
  
  -- Weighted combination (size more important than consistency)
  final_confidence := (size_score * 0.7) + (consistency_score * 0.3);
  
  RETURN LEAST(1.0, GREATEST(0.0, final_confidence));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- VIEWS FOR EASY ACCESS
-- ============================================================================

-- Latest filter performance across all filters
CREATE VIEW latest_filter_performance AS
SELECT 
  fp.*,
  fh.confidence_score,
  fh.trend_direction,
  fh.overall_edge as historical_edge
FROM filter_performance_snapshots fp
LEFT JOIN filter_historical_performance fh ON (
  fp.filter_preset = fh.filter_preset 
  AND fh.analysis_period = 'last_30_days'
)
WHERE fp.analysis_timestamp >= NOW() - INTERVAL '7 days'
ORDER BY fp.event_id DESC, fp.round_num DESC, fp.analysis_timestamp DESC;

-- Filter performance summary for dashboard
CREATE VIEW filter_performance_dashboard AS
SELECT 
  filter_preset,
  COUNT(DISTINCT event_id) as events_analyzed,
  SUM(matchups_flagged_by_filter) as total_flagged,
  SUM(flagged_matchups_won) as total_wins,
  AVG(win_rate) as avg_win_rate,
  AVG(edge_detected) as avg_edge,
  AVG(roi_percentage) as avg_roi,
  MAX(analysis_timestamp) as last_analysis
FROM filter_performance_snapshots
WHERE analysis_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY filter_preset
ORDER BY avg_edge DESC;

-- Recent significant filter events for alerts
CREATE VIEW recent_filter_events AS
SELECT *
FROM filter_performance_events
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND impact_magnitude > 0.05 -- Only significant events
ORDER BY created_at DESC, impact_magnitude DESC;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE matchup_results IS 'Actual outcomes of matchups after round completion';
COMMENT ON TABLE filter_performance_snapshots IS 'Filter performance metrics per round per event';
COMMENT ON TABLE filter_historical_performance IS 'Aggregated filter performance across time periods';
COMMENT ON TABLE filter_performance_events IS 'Significant events and insights about filter performance';

COMMENT ON VIEW latest_filter_performance IS 'Most recent filter performance data with historical context';
COMMENT ON VIEW filter_performance_dashboard IS 'Summary statistics for filter performance dashboard';
COMMENT ON VIEW recent_filter_events IS 'Recent significant filter performance events for alerts';

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
  'matchup_results',
  'filter_performance_snapshots', 
  'filter_historical_performance',
  'filter_performance_events'
);

-- Verify indexes were created
SELECT 
  indexname, 
  tablename 
FROM pg_indexes 
WHERE tablename IN (
  'matchup_results',
  'filter_performance_snapshots', 
  'filter_historical_performance',
  'filter_performance_events'
);

-- Verify functions were created
SELECT 
  routine_name, 
  routine_type 
FROM information_schema.routines 
WHERE routine_name IN (
  'calculate_edge_significance',
  'calculate_filter_confidence'
) AND routine_schema = 'public';

-- Verify views were created
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name IN (
  'latest_filter_performance',
  'filter_performance_dashboard', 
  'recent_filter_events'
) AND table_schema = 'public';