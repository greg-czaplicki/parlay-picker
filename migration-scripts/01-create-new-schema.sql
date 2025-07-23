-- =============================================
-- NEW AI-OPTIMIZED SCHEMA CREATION SCRIPT
-- =============================================
-- This script creates the complete new schema for AI-optimized golf parlay analytics
-- Based on the "Start Fresh, Build Forward" migration strategy
-- Generated: July 23, 2025

-- =============================================
-- PREREQUISITES AND EXTENSIONS
-- =============================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;
CREATE EXTENSION IF NOT EXISTS "vector" CASCADE;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS migration_log (
    id SERIAL PRIMARY KEY,
    migration_step VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'started',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    details JSONB
);

-- Log migration start
INSERT INTO migration_log (migration_step, status, details) 
VALUES ('schema_creation', 'started', '{"script": "01-create-new-schema.sql"}');

-- =============================================
-- CORE ENTITIES
-- =============================================

-- Players table with AI embeddings
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dg_id BIGINT UNIQUE NOT NULL,
    pga_id VARCHAR(50),
    owgr_id VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    country_code CHAR(3),
    birth_date DATE,
    height_cm INTEGER,
    weight_kg INTEGER,
    turned_professional DATE,
    pga_tour_wins INTEGER DEFAULT 0,
    major_wins INTEGER DEFAULT 0,
    career_earnings DECIMAL(12,2),
    world_ranking INTEGER,
    fedex_cup_ranking INTEGER,
    
    -- AI Analysis Fields
    playing_style JSONB,
    physical_attributes JSONB,
    mental_attributes JSONB,
    consistency_metrics JSONB,
    
    -- Vector Embeddings for AI
    style_embedding VECTOR(128),
    performance_embedding VECTOR(128),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    data_sources TEXT[] DEFAULT ARRAY['dataGolf'],
    
    -- Constraints
    CONSTRAINT valid_birth_date CHECK (birth_date IS NULL OR birth_date > '1900-01-01'),
    CONSTRAINT valid_height CHECK (height_cm IS NULL OR height_cm BETWEEN 150 AND 220),
    CONSTRAINT valid_weight CHECK (weight_kg IS NULL OR weight_kg BETWEEN 50 AND 150)
);

-- Courses table with detailed characteristics
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location TEXT,
    city VARCHAR(100),
    state_province VARCHAR(100),
    country VARCHAR(100) NOT NULL,
    country_code CHAR(3),
    
    -- Course Details
    par INTEGER NOT NULL DEFAULT 72,
    yardage INTEGER,
    course_type VARCHAR(50), -- links, parkland, desert, etc.
    designer VARCHAR(255),
    established_year INTEGER,
    
    -- Course Characteristics for AI
    difficulty_rating DECIMAL(3,1),
    course_conditions JSONB, -- rough height, green speed, etc.
    weather_patterns JSONB,
    historical_scoring JSONB,
    
    -- Vector Embedding for Course Similarity
    course_embedding VECTOR(64),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_par CHECK (par BETWEEN 68 AND 75),
    CONSTRAINT valid_yardage CHECK (yardage IS NULL OR yardage BETWEEN 6000 AND 8500),
    CONSTRAINT valid_difficulty CHECK (difficulty_rating IS NULL OR difficulty_rating BETWEEN 1.0 AND 10.0)
);

-- Tournaments table
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id BIGINT UNIQUE NOT NULL, -- DataGolf event ID
    name VARCHAR(255) NOT NULL,
    course_id UUID REFERENCES courses(id),
    
    -- Tournament Details
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    tour VARCHAR(50) NOT NULL, -- 'pga', 'european', 'korn_ferry', etc.
    tournament_type VARCHAR(50), -- 'major', 'wgc', 'regular', 'playoff'
    status VARCHAR(20) DEFAULT 'upcoming', -- 'upcoming', 'active', 'completed', 'cancelled'
    
    -- Prize and Points
    purse DECIMAL(12,2),
    fedex_cup_points INTEGER,
    world_ranking_points INTEGER,
    
    -- Field Analysis
    field_size INTEGER,
    field_strength DECIMAL(5,2), -- Average world ranking of field
    field_quality_metrics JSONB,
    
    -- Conditions
    weather_conditions JSONB,
    course_setup JSONB, -- pin positions, tee positions
    cut_rule VARCHAR(100),
    cut_line INTEGER, -- Score relative to par for cut
    
    -- AI Features
    tournament_embedding VECTOR(32),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_dates CHECK (start_date <= end_date),
    CONSTRAINT valid_field_size CHECK (field_size IS NULL OR field_size BETWEEN 30 AND 200),
    CONSTRAINT valid_status CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled'))
);

-- Tournament Rounds - TimescaleDB hypertable for performance data
CREATE TABLE tournament_rounds (
    id UUID DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    player_id UUID NOT NULL REFERENCES players(id),
    round_number INTEGER NOT NULL,
    round_date DATE NOT NULL,
    
    -- Score Information
    strokes INTEGER,
    score_to_par INTEGER,
    position INTEGER,
    position_numeric INTEGER,
    holes_completed INTEGER DEFAULT 18,
    
    -- Advanced Statistics (Strokes Gained)
    sg_total DECIMAL(6,3),
    sg_off_tee DECIMAL(6,3),
    sg_approach DECIMAL(6,3),
    sg_around_green DECIMAL(6,3),
    sg_putting DECIMAL(6,3),
    
    -- Traditional Statistics
    driving_distance DECIMAL(6,2),
    driving_accuracy DECIMAL(5,2), -- Percentage as decimal (0.0-1.0)
    greens_in_regulation DECIMAL(5,2), -- Percentage as decimal
    putts INTEGER,
    fairways_hit INTEGER,
    scrambling_success INTEGER,
    
    -- Course Management
    proximity_to_hole DECIMAL(6,2), -- Average approach proximity in feet
    putts_per_gir DECIMAL(4,2),
    sand_saves INTEGER,
    up_and_downs INTEGER,
    
    -- Round Context
    tee_time TIME,
    weather_conditions JSONB,
    playing_partners TEXT[],
    made_cut BOOLEAN,
    withdrew BOOLEAN DEFAULT FALSE,
    disqualified BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    data_source VARCHAR(50) DEFAULT 'dataGolf',
    
    -- Constraints
    CONSTRAINT valid_round_number CHECK (round_number BETWEEN 1 AND 4),
    CONSTRAINT valid_strokes CHECK (strokes IS NULL OR strokes BETWEEN 50 AND 100),
    CONSTRAINT valid_holes CHECK (holes_completed BETWEEN 0 AND 18),
    CONSTRAINT valid_driving_accuracy CHECK (driving_accuracy IS NULL OR driving_accuracy BETWEEN 0 AND 1),
    CONSTRAINT valid_gir CHECK (greens_in_regulation IS NULL OR greens_in_regulation BETWEEN 0 AND 1)
);

-- Convert tournament_rounds to TimescaleDB hypertable
SELECT create_hypertable('tournament_rounds', 'round_date', 
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- =============================================
-- BETTING INFRASTRUCTURE
-- =============================================

-- Sportsbooks
CREATE TABLE sportsbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    country_code CHAR(3),
    api_endpoint VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Sportsbook Characteristics
    typical_margin DECIMAL(5,4), -- 0.05 = 5% margin
    update_frequency_minutes INTEGER DEFAULT 60,
    supported_bet_types TEXT[],
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default sportsbooks
INSERT INTO sportsbooks (name, display_name, country, country_code) VALUES
('fanduel', 'FanDuel', 'United States', 'USA'),
('bet365', 'Bet365', 'United Kingdom', 'GBR'),
('draftkings', 'DraftKings', 'United States', 'USA');

-- Betting Markets
CREATE TABLE betting_markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    sportsbook_id UUID NOT NULL REFERENCES sportsbooks(id),
    
    -- Market Definition
    market_type VARCHAR(50) NOT NULL, -- 'head_to_head', 'three_ball', 'outright_winner', 'top_10'
    market_name VARCHAR(255) NOT NULL,
    market_description TEXT,
    
    -- Participants
    players_involved UUID[] NOT NULL, -- Array of player UUIDs
    round_number INTEGER, -- NULL for tournament-wide markets
    
    -- Market Rules
    market_rules JSONB,
    settlement_rules TEXT,
    
    -- Market Status
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'suspended', 'closed', 'settled'
    opens_at TIMESTAMPTZ,
    closes_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_market_status CHECK (status IN ('open', 'suspended', 'closed', 'settled')),
    CONSTRAINT valid_players_count CHECK (array_length(players_involved, 1) BETWEEN 2 AND 10)
);

-- Odds History - TimescaleDB hypertable for real-time tracking
CREATE TABLE odds_history (
    id UUID DEFAULT uuid_generate_v4(),
    market_id UUID NOT NULL REFERENCES betting_markets(id),
    player_id UUID NOT NULL REFERENCES players(id),
    sportsbook_id UUID NOT NULL REFERENCES sportsbooks(id),
    
    -- Odds Information
    decimal_odds DECIMAL(8,4) NOT NULL,
    american_odds INTEGER,
    implied_probability DECIMAL(6,4) NOT NULL,
    
    -- Market Context
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    volume_indicator VARCHAR(20), -- 'light', 'medium', 'heavy' betting volume
    line_movement VARCHAR(20), -- 'up', 'down', 'steady'
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data_source VARCHAR(50) DEFAULT 'api',
    
    CONSTRAINT valid_decimal_odds CHECK (decimal_odds >= 1.01),
    CONSTRAINT valid_probability CHECK (implied_probability > 0 AND implied_probability <= 1)
);

-- Convert odds_history to TimescaleDB hypertable
SELECT create_hypertable('odds_history', 'timestamp', 
    chunk_time_interval => INTERVAL '1 week',
    if_not_exists => TRUE
);

-- =============================================
-- AI/ML TABLES
-- =============================================

-- Player Correlations for Parlay Analysis
CREATE TABLE player_correlations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player1_id UUID NOT NULL REFERENCES players(id),
    player2_id UUID NOT NULL REFERENCES players(id),
    
    -- Correlation Metrics
    performance_correlation DECIMAL(5,4), -- -1.0 to 1.0
    course_fit_correlation DECIMAL(5,4),
    scoring_correlation DECIMAL(5,4),
    variance_correlation DECIMAL(5,4),
    
    -- Context
    tournaments_analyzed INTEGER NOT NULL,
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    course_types TEXT[], -- Course types where correlation calculated
    
    -- Statistical Significance
    p_value DECIMAL(8,6),
    confidence_level DECIMAL(4,3),
    sample_size INTEGER,
    
    -- Metadata
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_version VARCHAR(50),
    
    CONSTRAINT different_players CHECK (player1_id != player2_id),
    CONSTRAINT valid_correlation CHECK (
        performance_correlation BETWEEN -1.0 AND 1.0 AND
        course_fit_correlation BETWEEN -1.0 AND 1.0 AND
        scoring_correlation BETWEEN -1.0 AND 1.0 AND
        variance_correlation BETWEEN -1.0 AND 1.0
    )
);

-- ML Feature Vectors - TimescaleDB hypertable
CREATE TABLE ml_feature_vectors (
    id UUID DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id),
    tournament_id UUID REFERENCES tournaments(id),
    round_number INTEGER,
    
    -- Feature Categories
    recent_form_features DECIMAL(8,4)[],
    course_history_features DECIMAL(8,4)[],
    statistical_features DECIMAL(8,4)[],
    situational_features DECIMAL(8,4)[],
    
    -- Combined Feature Vector
    feature_vector VECTOR(256),
    
    -- Context
    feature_date DATE NOT NULL,
    lookback_days INTEGER DEFAULT 365,
    min_rounds_threshold INTEGER DEFAULT 10,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    model_version VARCHAR(50),
    feature_names TEXT[], -- Ordered list of feature names
    
    CONSTRAINT valid_round_num CHECK (round_number IS NULL OR round_number BETWEEN 1 AND 4)
);

-- Convert ml_feature_vectors to TimescaleDB hypertable
SELECT create_hypertable('ml_feature_vectors', 'feature_date', 
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- ML Models Registry
CREATE TABLE ml_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) NOT NULL,
    model_type VARCHAR(50) NOT NULL, -- 'classification', 'regression', 'ranking'
    version VARCHAR(50) NOT NULL,
    
    -- Model Configuration
    algorithm VARCHAR(100),
    hyperparameters JSONB,
    feature_importance JSONB,
    training_config JSONB,
    
    -- Performance Metrics
    accuracy_metrics JSONB,
    validation_scores JSONB,
    cross_validation_scores DECIMAL(6,4)[],
    
    -- Training Data
    training_start_date DATE,
    training_end_date DATE,
    training_samples INTEGER,
    feature_count INTEGER,
    
    -- Status
    status VARCHAR(20) DEFAULT 'training', -- 'training', 'active', 'deprecated', 'archived'
    deployed_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(100),
    model_artifact_path TEXT,
    
    CONSTRAINT valid_status CHECK (status IN ('training', 'active', 'deprecated', 'archived')),
    UNIQUE(model_name, version)
);

-- =============================================
-- SHOT-LEVEL DATA STRUCTURES
-- =============================================

-- Shot Tracking - TimescaleDB hypertable for granular data
CREATE TABLE shot_tracking (
    id UUID DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    player_id UUID NOT NULL REFERENCES players(id),
    round_number INTEGER NOT NULL,
    hole_number INTEGER NOT NULL,
    shot_number INTEGER NOT NULL,
    
    -- Shot Details
    club_used VARCHAR(50),
    shot_type VARCHAR(50), -- 'drive', 'approach', 'chip', 'putt', 'bunker'
    distance_yards DECIMAL(6,2),
    carry_distance DECIMAL(6,2),
    
    -- Location Data
    start_coordinates POINT, -- PostGIS point (x, y)
    end_coordinates POINT,
    start_lie VARCHAR(50), -- 'fairway', 'rough', 'bunker', 'green', 'tee'
    end_lie VARCHAR(50),
    
    -- Shot Outcome
    accuracy_rating DECIMAL(4,2), -- 1-10 scale
    distance_to_pin_before DECIMAL(6,2), -- In feet
    distance_to_pin_after DECIMAL(6,2),
    
    -- Context
    shot_timestamp TIMESTAMPTZ NOT NULL,
    weather_conditions JSONB,
    pin_position VARCHAR(20), -- 'front', 'middle', 'back', 'left', 'right'
    
    -- Strokes Gained Context
    sg_value DECIMAL(6,3),
    expected_strokes_before DECIMAL(6,3),
    expected_strokes_after DECIMAL(6,3),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data_source VARCHAR(50) DEFAULT 'shotLink',
    
    CONSTRAINT valid_hole CHECK (hole_number BETWEEN 1 AND 18),
    CONSTRAINT valid_round CHECK (round_number BETWEEN 1 AND 4),
    CONSTRAINT valid_shot CHECK (shot_number >= 1),
    CONSTRAINT valid_distance CHECK (distance_yards IS NULL OR distance_yards >= 0)
);

-- Convert shot_tracking to TimescaleDB hypertable
SELECT create_hypertable('shot_tracking', 'shot_timestamp', 
    chunk_time_interval => INTERVAL '1 week',
    if_not_exists => TRUE
);

-- Hole Statistics
CREATE TABLE hole_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    player_id UUID NOT NULL REFERENCES players(id),
    round_number INTEGER NOT NULL,
    hole_number INTEGER NOT NULL,
    
    -- Hole Performance
    strokes INTEGER NOT NULL,
    par INTEGER NOT NULL,
    score_to_par INTEGER NOT NULL,
    
    -- Detailed Breakdown
    tee_shot_accuracy BOOLEAN,
    fairway_hit BOOLEAN,
    green_in_regulation BOOLEAN,
    putts INTEGER,
    
    -- Advanced Metrics
    proximity_to_hole DECIMAL(6,2), -- Final approach shot
    first_putt_distance DECIMAL(6,2),
    longest_putt_made DECIMAL(6,2),
    
    -- Hole Context
    hole_difficulty_rank INTEGER, -- 1-18 ranking for this tournament
    pin_position VARCHAR(20),
    wind_conditions JSONB,
    
    -- Strokes Gained by Category
    sg_off_tee DECIMAL(6,3),
    sg_approach DECIMAL(6,3),
    sg_around_green DECIMAL(6,3),
    sg_putting DECIMAL(6,3),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_hole_stats CHECK (hole_number BETWEEN 1 AND 18),
    CONSTRAINT valid_round_stats CHECK (round_number BETWEEN 1 AND 4),
    CONSTRAINT valid_strokes_hole CHECK (strokes BETWEEN 1 AND 15),
    CONSTRAINT valid_putts CHECK (putts >= 0 AND putts <= 10),
    UNIQUE(tournament_id, player_id, round_number, hole_number)
);

-- =============================================
-- OPTIMIZATION STRUCTURES
-- =============================================

-- Materialized view for current tournament leaderboard
CREATE MATERIALIZED VIEW current_tournament_leaderboard AS
SELECT 
    t.id as tournament_id,
    t.name as tournament_name,
    p.id as player_id,
    p.name as player_name,
    SUM(tr.score_to_par) as total_score,
    COUNT(tr.round_number) as rounds_completed,
    AVG(tr.sg_total) as avg_sg_total,
    MAX(tr.round_number) as latest_round,
    RANK() OVER (PARTITION BY t.id ORDER BY SUM(tr.score_to_par)) as current_position
FROM tournaments t
JOIN tournament_rounds tr ON t.id = tr.tournament_id
JOIN players p ON tr.player_id = p.id
WHERE t.status = 'active'
GROUP BY t.id, t.name, p.id, p.name;

-- Materialized view for player recent form
CREATE MATERIALIZED VIEW player_recent_form AS
SELECT 
    p.id as player_id,
    p.name as player_name,
    COUNT(tr.id) as rounds_last_90_days,
    AVG(tr.sg_total) as avg_sg_total,
    AVG(tr.score_to_par) as avg_score_to_par,
    AVG(tr.driving_accuracy) as avg_driving_accuracy,
    AVG(tr.greens_in_regulation) as avg_gir,
    STDDEV(tr.score_to_par) as score_consistency,
    MAX(tr.round_date) as last_round_date
FROM players p
JOIN tournament_rounds tr ON p.id = tr.player_id
WHERE tr.round_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY p.id, p.name;

-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_tournament_rounds_player_date ON tournament_rounds(player_id, round_date);
CREATE INDEX CONCURRENTLY idx_tournament_rounds_tournament_round ON tournament_rounds(tournament_id, round_number);
CREATE INDEX CONCURRENTLY idx_odds_history_market_timestamp ON odds_history(market_id, timestamp);
CREATE INDEX CONCURRENTLY idx_betting_markets_tournament_type ON betting_markets(tournament_id, market_type);
CREATE INDEX CONCURRENTLY idx_players_dg_id ON players(dg_id);
CREATE INDEX CONCURRENTLY idx_tournaments_event_id ON tournaments(event_id);

-- Vector similarity indexes for AI features
CREATE INDEX CONCURRENTLY idx_players_style_embedding ON players USING ivfflat (style_embedding vector_cosine_ops);
CREATE INDEX CONCURRENTLY idx_courses_embedding ON courses USING ivfflat (course_embedding vector_cosine_ops);

-- =============================================
-- COMPLETION AND LOGGING
-- =============================================

-- Update migration log
UPDATE migration_log 
SET status = 'completed', completed_at = NOW(), 
    details = jsonb_set(details, '{tables_created}', to_jsonb(array[
        'players', 'courses', 'tournaments', 'tournament_rounds', 'sportsbooks', 
        'betting_markets', 'odds_history', 'player_correlations', 'ml_feature_vectors', 
        'ml_models', 'shot_tracking', 'hole_statistics'
    ]))
WHERE migration_step = 'schema_creation' AND status = 'started';

-- Final schema statistics
SELECT 
    'Schema Creation Complete' as status,
    COUNT(*) as tables_created,
    NOW() as completed_at
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'players', 'courses', 'tournaments', 'tournament_rounds', 'sportsbooks',
    'betting_markets', 'odds_history', 'player_correlations', 'ml_feature_vectors',
    'ml_models', 'shot_tracking', 'hole_statistics', 'migration_log'
);