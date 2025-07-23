-- AI-Optimized Golf Parlay Analytics Schema
-- Phase 2: Betting Markets and Odds Tracking
-- Designed for real-time edge detection and parlay correlation analysis

-- =========================================
-- BETTING MARKET TABLES
-- =========================================

-- Sportsbooks table - Track multiple betting providers
CREATE TABLE sportsbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    country TEXT,
    
    -- API integration
    api_endpoint TEXT,
    api_key_required BOOLEAN DEFAULT true,
    rate_limit_per_minute INTEGER DEFAULT 60,
    
    -- Market characteristics
    supported_markets JSONB, -- Array of market types they offer
    typical_margins JSONB, -- Historical margins by market type
    liquidity_rating DECIMAL(3,2) CHECK (liquidity_rating BETWEEN 0 AND 10),
    
    -- Status
    active BOOLEAN DEFAULT true,
    last_data_fetch TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Betting Markets table - Define available markets for tournaments
CREATE TABLE betting_markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    sportsbook_id UUID NOT NULL REFERENCES sportsbooks(id),
    
    -- Market definition
    market_type TEXT NOT NULL CHECK (market_type IN (
        'outright_winner', 'top_5', 'top_10', 'top_20', 'make_cut', 
        'miss_cut', 'first_round_leader', 'head_to_head', 'three_ball',
        'hole_in_one', 'lowest_round', 'margin_of_victory'
    )),
    market_name TEXT NOT NULL,
    market_description TEXT,
    
    -- Market specifics
    players_involved UUID[] DEFAULT ARRAY[]::UUID[], -- Array of player IDs involved
    market_rules JSONB, -- Specific rules for this market
    settlement_rules JSONB, -- How the market settles
    
    -- Market status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed', 'settled')),
    opens_at TIMESTAMPTZ,
    closes_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    settlement_result JSONB, -- Final settlement details
    
    -- Market metadata
    total_handle DECIMAL(12,2), -- Total amount wagered (if available)
    unique_players INTEGER, -- Number of players in market
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tournament_id, sportsbook_id, market_type, market_name)
);

-- Odds History table - Time-series odds tracking for edge detection
CREATE TABLE odds_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    market_id UUID NOT NULL REFERENCES betting_markets(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id), -- NULL for non-player markets
    
    -- Odds data
    decimal_odds DECIMAL(8,2) NOT NULL CHECK (decimal_odds >= 1.0),
    american_odds INTEGER NOT NULL,
    implied_probability DECIMAL(6,4) NOT NULL CHECK (implied_probability BETWEEN 0 AND 1),
    
    -- Market context
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    volume DECIMAL(12,2), -- Betting volume at this price (if available)
    market_share DECIMAL(5,4), -- This book's share of market
    
    -- Line movement analysis
    odds_movement DECIMAL(8,2), -- Change from previous odds
    movement_percentage DECIMAL(6,2), -- Percentage change
    movement_direction TEXT CHECK (movement_direction IN ('up', 'down', 'stable')),
    
    -- Sharp money indicators
    line_movement_velocity DECIMAL(8,4), -- Speed of line movement
    reverse_line_movement BOOLEAN DEFAULT false, -- Moving against public money
    steam_move BOOLEAN DEFAULT false, -- Coordinated sharp action
    
    -- Data quality
    data_source TEXT DEFAULT 'api',
    confidence_score DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence_score BETWEEN 0 AND 1),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert odds_history to hypertable for efficient time-series queries
SELECT create_hypertable('odds_history', 'timestamp', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Parlay Combinations table - Track parlay bets and their components
CREATE TABLE parlay_combinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parlay metadata
    parlay_name TEXT,
    leg_count INTEGER NOT NULL CHECK (leg_count BETWEEN 2 AND 12),
    total_stake DECIMAL(10,2) CHECK (total_stake > 0),
    
    -- Parlay odds and value
    combined_decimal_odds DECIMAL(12,2) NOT NULL,
    implied_probability DECIMAL(8,6) NOT NULL,
    theoretical_probability DECIMAL(8,6), -- Model-calculated probability
    expected_value DECIMAL(8,4), -- EV calculation
    kelly_criterion DECIMAL(6,4), -- Optimal bet size
    
    -- Risk analysis
    correlation_penalty DECIMAL(6,4) DEFAULT 0, -- Penalty for correlated legs
    variance DECIMAL(8,4), -- Calculated variance of outcome
    sharpe_ratio DECIMAL(6,4), -- Risk-adjusted return
    max_loss DECIMAL(10,2), -- Maximum possible loss
    
    -- Parlay status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'won', 'lost', 'void', 'partial')),
    placed_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    actual_payout DECIMAL(12,2),
    
    -- AI analysis
    parlay_embedding VECTOR(64), -- Parlay characteristics embedding
    confidence_score DECIMAL(4,3) CHECK (confidence_score BETWEEN 0 AND 1),
    ai_recommendation TEXT, -- AI-generated recommendation
    risk_factors JSONB, -- Identified risk factors
    
    -- User/System info
    user_id UUID, -- Reference to user who placed bet
    strategy_type TEXT, -- 'manual', 'ai_suggested', 'systematic'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parlay Legs table - Individual components of parlay bets
CREATE TABLE parlay_legs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    parlay_id UUID NOT NULL REFERENCES parlay_combinations(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES betting_markets(id),
    player_id UUID REFERENCES players(id),
    
    -- Leg details
    leg_sequence INTEGER NOT NULL CHECK (leg_sequence > 0),
    selection TEXT NOT NULL, -- What was selected (player name, over/under value, etc)
    decimal_odds DECIMAL(8,2) NOT NULL,
    implied_probability DECIMAL(6,4) NOT NULL,
    
    -- Model analysis for this leg
    model_probability DECIMAL(6,4), -- Our model's probability
    edge DECIMAL(6,4), -- Model probability - implied probability
    confidence DECIMAL(4,3), -- Model confidence for this selection
    
    -- Leg outcome
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'void', 'push')),
    settled_at TIMESTAMPTZ,
    settlement_notes TEXT,
    
    -- Correlation tracking
    correlation_with_other_legs JSONB, -- Correlation coefficients with other legs
    independence_score DECIMAL(4,3), -- How independent this leg is
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(parlay_id, leg_sequence)
);

-- =========================================
-- MARKET ANALYSIS TABLES
-- =========================================

-- Market Efficiency table - Real-time market analysis
CREATE TABLE market_efficiency_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    analysis_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Market-wide metrics
    overall_efficiency_score DECIMAL(5,4) CHECK (overall_efficiency_score BETWEEN 0 AND 1),
    arbitrage_opportunities INTEGER DEFAULT 0,
    overlay_count INTEGER DEFAULT 0, -- Number of positive EV bets found
    underlay_count INTEGER DEFAULT 0, -- Number of negative EV bets
    
    -- Sharp money indicators
    significant_line_moves INTEGER DEFAULT 0,
    reverse_line_moves INTEGER DEFAULT 0,
    steam_moves INTEGER DEFAULT 0,
    
    -- Market bias indicators
    public_betting_bias JSONB, -- Where public money is concentrated
    recency_bias_score DECIMAL(4,3), -- Bias toward recent performance
    name_recognition_bias JSONB, -- Popular player bias metrics
    
    -- Model performance
    closing_line_value DECIMAL(6,4), -- How our picks performed vs closing lines
    model_accuracy DECIMAL(5,4), -- Recent model accuracy
    roi_this_tournament DECIMAL(8,4), -- ROI for current tournament
    
    -- Analysis metadata
    markets_analyzed INTEGER NOT NULL,
    data_freshness_minutes INTEGER,
    analysis_duration_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edge Detection table - Real-time value bet identification  
CREATE TABLE edge_detection (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    market_id UUID NOT NULL REFERENCES betting_markets(id),
    player_id UUID REFERENCES players(id),
    sportsbook_id UUID NOT NULL REFERENCES sportsbooks(id),
    
    -- Edge calculation
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_probability DECIMAL(6,4) NOT NULL,
    market_probability DECIMAL(6,4) NOT NULL,
    edge_percentage DECIMAL(6,2) NOT NULL, -- (model - market) / market * 100
    
    -- Bet sizing recommendations
    kelly_fraction DECIMAL(6,4), -- Kelly criterion recommendation
    recommended_stake DECIMAL(8,2), -- Dollar amount recommendation
    confidence_level DECIMAL(4,3), -- Model confidence
    
    -- Risk assessment
    liquidity_score DECIMAL(3,2), -- Market liquidity assessment
    line_stability DECIMAL(3,2), -- How stable the line is
    time_sensitivity DECIMAL(3,2), -- How quickly to act
    
    -- Parlay correlation potential
    correlation_opportunities JSONB, -- Other bets that could combine well
    anti_correlation_warnings JSONB, -- Bets to avoid combining with
    
    -- Alert status
    alert_triggered BOOLEAN DEFAULT false,
    alert_threshold_met DECIMAL(6,2), -- Threshold that triggered alert
    action_taken TEXT, -- 'bet_placed', 'ignored', 'monitoring'
    
    -- Outcome tracking
    final_odds DECIMAL(8,2), -- Final closing odds
    bet_placed BOOLEAN DEFAULT false,
    actual_outcome TEXT, -- 'won', 'lost', 'void' after settlement
    realized_profit_loss DECIMAL(10,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert edge_detection to hypertable for real-time analysis
SELECT create_hypertable('edge_detection', 'detected_at', 
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE  
);

-- =========================================
-- INDEXES FOR BETTING ANALYTICS
-- =========================================

-- Sportsbooks
CREATE INDEX idx_sportsbooks_active ON sportsbooks(active) WHERE active = true;
CREATE INDEX idx_sportsbooks_country ON sportsbooks(country);

-- Betting markets
CREATE INDEX idx_markets_tournament_type ON betting_markets(tournament_id, market_type);
CREATE INDEX idx_markets_sportsbook_status ON betting_markets(sportsbook_id, status);
CREATE INDEX idx_markets_players ON betting_markets USING gin(players_involved);
CREATE INDEX idx_markets_opens_closes ON betting_markets(opens_at, closes_at);

-- Odds history (time-series optimized)
CREATE INDEX idx_odds_market_time ON odds_history(market_id, timestamp DESC);
CREATE INDEX idx_odds_player_time ON odds_history(player_id, timestamp DESC) WHERE player_id IS NOT NULL;
CREATE INDEX idx_odds_movement ON odds_history(movement_direction, movement_percentage) 
    WHERE movement_direction != 'stable';
CREATE INDEX idx_odds_sharp_indicators ON odds_history(steam_move, reverse_line_movement) 
    WHERE steam_move = true OR reverse_line_movement = true;

-- Parlay combinations
CREATE INDEX idx_parlays_status_placed ON parlay_combinations(status, placed_at);
CREATE INDEX idx_parlays_ev_kelly ON parlay_combinations(expected_value, kelly_criterion) 
    WHERE expected_value > 0;
CREATE INDEX idx_parlays_embedding ON parlay_combinations USING ivfflat (parlay_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_parlays_strategy ON parlay_combinations(strategy_type, confidence_score);

-- Parlay legs
CREATE INDEX idx_legs_parlay_sequence ON parlay_legs(parlay_id, leg_sequence);
CREATE INDEX idx_legs_market_player ON parlay_legs(market_id, player_id);
CREATE INDEX idx_legs_edge ON parlay_legs(edge) WHERE edge > 0;

-- Market efficiency
CREATE INDEX idx_efficiency_tournament_time ON market_efficiency_analysis(tournament_id, analysis_timestamp DESC);
CREATE INDEX idx_efficiency_scores ON market_efficiency_analysis(overall_efficiency_score, overlay_count);

-- Edge detection (real-time optimized)
CREATE INDEX idx_edge_detected_at ON edge_detection(detected_at DESC);
CREATE INDEX idx_edge_market_player ON edge_detection(market_id, player_id);
CREATE INDEX idx_edge_percentage ON edge_detection(edge_percentage DESC) WHERE edge_percentage > 5;
CREATE INDEX idx_edge_alerts ON edge_detection(alert_triggered, action_taken) WHERE alert_triggered = true;
CREATE INDEX idx_edge_correlation ON edge_detection USING gin(correlation_opportunities);

-- =========================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =========================================

-- Current market overview
CREATE MATERIALIZED VIEW current_market_overview AS
SELECT 
    t.name as tournament_name,
    t.start_date,
    bm.market_type,
    COUNT(*) as total_markets,
    COUNT(DISTINCT bm.sportsbook_id) as sportsbook_count,
    AVG(oh.implied_probability) as avg_implied_prob,
    COUNT(ed.id) as edges_detected,
    AVG(ed.edge_percentage) as avg_edge_percentage
FROM tournaments t
JOIN betting_markets bm ON t.id = bm.tournament_id  
LEFT JOIN odds_history oh ON bm.id = oh.market_id
LEFT JOIN edge_detection ed ON bm.id = ed.market_id
WHERE t.status = 'active'
AND bm.status = 'active'
AND oh.timestamp > NOW() - INTERVAL '1 hour'
GROUP BY t.id, t.name, t.start_date, bm.market_type;

-- Hot parlays (high EV combinations)
CREATE MATERIALIZED VIEW hot_parlay_opportunities AS
SELECT 
    pc.id,
    pc.leg_count,
    pc.expected_value,
    pc.kelly_criterion,
    pc.correlation_penalty,
    pc.confidence_score,
    ARRAY_AGG(p.name ORDER BY pl.leg_sequence) as player_names,
    ARRAY_AGG(bm.market_type ORDER BY pl.leg_sequence) as market_types,
    pc.created_at
FROM parlay_combinations pc
JOIN parlay_legs pl ON pc.id = pl.parlay_id
JOIN betting_markets bm ON pl.market_id = bm.id
LEFT JOIN players p ON pl.player_id = p.id
WHERE pc.status = 'pending'
AND pc.expected_value > 0.1 -- At least 10% positive EV
AND pc.confidence_score > 0.7
GROUP BY pc.id, pc.leg_count, pc.expected_value, pc.kelly_criterion, 
         pc.correlation_penalty, pc.confidence_score, pc.created_at
ORDER BY pc.expected_value DESC;

-- =========================================
-- FUNCTIONS FOR BETTING CALCULATIONS
-- =========================================

-- Calculate implied probability from decimal odds
CREATE OR REPLACE FUNCTION decimal_to_implied_probability(decimal_odds DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    RETURN 1.0 / decimal_odds;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate Kelly criterion bet size
CREATE OR REPLACE FUNCTION kelly_criterion(
    model_prob DECIMAL,
    decimal_odds DECIMAL,
    bankroll DECIMAL DEFAULT 1000
) RETURNS DECIMAL AS $$
DECLARE
    implied_prob DECIMAL;
    edge DECIMAL;
    kelly_fraction DECIMAL;
BEGIN
    implied_prob := 1.0 / decimal_odds;
    edge := model_prob - implied_prob;
    
    IF edge <= 0 THEN
        RETURN 0; -- No positive edge
    END IF;
    
    kelly_fraction := edge / (decimal_odds - 1);
    
    -- Cap at 10% of bankroll for safety
    kelly_fraction := LEAST(kelly_fraction, 0.10);
    
    RETURN bankroll * kelly_fraction;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comments
COMMENT ON TABLE betting_markets IS 'Available betting markets for tournaments with multiple sportsbook support';
COMMENT ON TABLE odds_history IS 'Time-series odds tracking for line movement analysis and edge detection';  
COMMENT ON TABLE parlay_combinations IS 'Parlay bets with AI analysis, correlation penalties, and EV calculations';
COMMENT ON TABLE edge_detection IS 'Real-time value bet identification with Kelly criterion recommendations';

SELECT 'Betting markets and odds tracking schema created successfully!' as result;