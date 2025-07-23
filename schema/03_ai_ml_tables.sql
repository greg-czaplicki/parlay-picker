-- AI-Optimized Golf Parlay Analytics Schema
-- Phase 3: AI/ML Tables for Correlation Analysis and Machine Learning
-- Designed for sophisticated parlay optimization and predictive analytics

-- =========================================
-- CORRELATION ANALYSIS TABLES
-- =========================================

-- Player Correlation Matrix - Track correlations between player performances
CREATE TABLE player_correlations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Player pair
    player1_id UUID NOT NULL REFERENCES players(id),
    player2_id UUID NOT NULL REFERENCES players(id),
    
    -- Correlation metrics
    correlation_type TEXT NOT NULL CHECK (correlation_type IN (
        'performance', 'position_change', 'cut_making', 'scoring',
        'sg_total', 'sg_putting', 'sg_approach', 'weather_performance'
    )),
    
    -- Statistical measures
    correlation_coefficient DECIMAL(6,4) NOT NULL CHECK (correlation_coefficient BETWEEN -1 AND 1),
    sample_size INTEGER NOT NULL CHECK (sample_size >= 10),
    confidence_interval_lower DECIMAL(6,4),
    confidence_interval_upper DECIMAL(6,4),
    p_value DECIMAL(8,6),
    
    -- Time-based analysis
    calculation_period TEXT NOT NULL, -- '1_year', '2_years', 'career'
    tournaments_analyzed INTEGER NOT NULL,
    last_tournament_date DATE,
    
    -- Context-specific correlations
    course_type_correlation JSONB, -- Correlation by course type
    tournament_type_correlation JSONB, -- Correlation by tournament type
    weather_correlation JSONB, -- Correlation under different conditions
    
    -- Betting implications
    parlay_suitability_score DECIMAL(4,3) CHECK (parlay_suitability_score BETWEEN 0 AND 1),
    anti_correlation_flag BOOLEAN DEFAULT false, -- Good for parlays
    hedge_opportunity_flag BOOLEAN DEFAULT false, -- Good for hedging
    
    -- Metadata
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_version TEXT DEFAULT '1.0',
    calculation_method TEXT DEFAULT 'pearson',
    
    -- Constraints
    UNIQUE(player1_id, player2_id, correlation_type, calculation_period),
    CHECK(player1_id != player2_id),
    CHECK(player1_id < player2_id) -- Ensure consistent ordering
);

-- Market Correlation Analysis - Correlations between different betting markets
CREATE TABLE market_correlations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Market types being correlated
    market_type_1 TEXT NOT NULL,
    market_type_2 TEXT NOT NULL,
    tournament_context TEXT, -- 'majors', 'regular', 'all'
    
    -- Correlation strength
    correlation_coefficient DECIMAL(6,4) NOT NULL,
    sample_size INTEGER NOT NULL,
    statistical_significance DECIMAL(6,4), -- p-value
    
    -- Risk implications
    diversification_benefit DECIMAL(6,4), -- How much correlation reduces diversification
    parlay_risk_multiplier DECIMAL(6,4), -- Risk multiplier for parlays
    
    -- Market-specific insights
    common_outcomes JSONB, -- Commonly correlated outcomes
    hedge_strategies JSONB, -- Potential hedging strategies
    
    -- Analysis metadata
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    analysis_window TEXT DEFAULT '1_year',
    
    UNIQUE(market_type_1, market_type_2, tournament_context)
);

-- =========================================
-- MACHINE LEARNING FEATURE STORE
-- =========================================

-- ML Feature Vectors - Pre-computed features for machine learning models
CREATE TABLE ml_feature_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    player_id UUID NOT NULL REFERENCES players(id),
    tournament_id UUID REFERENCES tournaments(id),
    as_of_date DATE NOT NULL, -- When these features were calculated
    
    -- Feature categories
    recent_performance_features JSONB NOT NULL, -- Last 5, 10, 20 tournaments
    historical_performance_features JSONB NOT NULL, -- Career stats, trends
    course_fit_features JSONB, -- Course-specific performance indicators
    form_and_momentum_features JSONB, -- Current form, streak indicators
    situational_features JSONB, -- Weather, field strength, pressure situations
    
    -- Advanced metrics
    consistency_metrics JSONB, -- Variance, standard deviation measures
    clutch_performance_features JSONB, -- Performance under pressure
    physical_condition_indicators JSONB, -- Rest, travel, consecutive weeks
    
    -- Strokes gained decomposition
    sg_trend_features JSONB, -- Trends in each SG category
    sg_relative_to_field JSONB, -- SG relative to current field
    sg_course_history JSONB, -- SG on similar courses
    
    -- Competitive context
    field_strength_adjustment DECIMAL(6,4), -- Adjustment for field quality
    tournament_importance_factor DECIMAL(6,4), -- Major vs regular event
    cut_line_pressure DECIMAL(6,4), -- Pressure from projected cut line
    
    -- Feature vector for ML models
    feature_vector VECTOR(256) NOT NULL, -- Dense feature representation
    feature_names TEXT[] NOT NULL, -- Names of features in vector
    
    -- Quality metrics
    data_completeness_score DECIMAL(4,3) CHECK (data_completeness_score BETWEEN 0 AND 1),
    feature_importance_weights JSONB, -- Importance of each feature category
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    feature_version TEXT DEFAULT '1.0',
    
    UNIQUE(player_id, tournament_id, as_of_date, feature_version)
);

-- Convert to hypertable for efficient time-based queries
SELECT create_hypertable('ml_feature_vectors', 'as_of_date', 
    chunk_time_interval => INTERVAL '3 months',
    if_not_exists => TRUE
);

-- ML Model Registry - Track different prediction models
CREATE TABLE ml_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Model identification
    model_name TEXT NOT NULL UNIQUE,
    model_type TEXT NOT NULL CHECK (model_type IN (
        'cut_prediction', 'finish_position', 'score_prediction', 
        'head_to_head', 'parlay_optimization', 'edge_detection'
    )),
    model_version TEXT NOT NULL,
    
    -- Model details
    algorithm TEXT NOT NULL, -- 'xgboost', 'random_forest', 'neural_network', etc
    hyperparameters JSONB,
    feature_importance JSONB, -- Feature importance scores
    
    -- Training information
    training_data_size INTEGER,
    training_period_start DATE,
    training_period_end DATE,
    cross_validation_scores JSONB,
    
    -- Performance metrics
    accuracy DECIMAL(6,4),
    precision_score DECIMAL(6,4),
    recall_score DECIMAL(6,4),
    f1_score DECIMAL(6,4),
    auc_roc DECIMAL(6,4),
    log_loss DECIMAL(8,6),
    
    -- Business metrics
    expected_roi DECIMAL(8,4), -- Expected return on investment
    sharpe_ratio DECIMAL(6,4), -- Risk-adjusted returns
    max_drawdown DECIMAL(6,4), -- Maximum observed loss
    
    -- Model status
    status TEXT DEFAULT 'development' CHECK (status IN ('development', 'testing', 'production', 'retired')),
    deployed_at TIMESTAMPTZ,
    last_retrained_at TIMESTAMPTZ,
    
    -- Model artifacts
    model_file_path TEXT, -- Path to serialized model
    feature_pipeline_config JSONB, -- Feature engineering pipeline
    
    -- Metadata
    created_by TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(model_name, model_version)
);

-- ML Predictions - Store model predictions for evaluation and comparison
CREATE TABLE ml_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    model_id UUID NOT NULL REFERENCES ml_models(id),
    player_id UUID NOT NULL REFERENCES players(id),
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    
    -- Prediction details
    prediction_type TEXT NOT NULL,
    predicted_value DECIMAL(10,4) NOT NULL,
    confidence_score DECIMAL(6,4) CHECK (confidence_score BETWEEN 0 AND 1),
    prediction_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Probability distributions (for classification tasks)
    class_probabilities JSONB, -- P(make_cut), P(top_10), etc.
    prediction_intervals JSONB, -- Confidence intervals
    
    -- Feature attribution
    feature_contributions JSONB, -- SHAP values or similar
    top_contributing_features JSONB, -- Most important features for this prediction
    
    -- Prediction context
    market_conditions JSONB, -- Market state when prediction was made
    field_strength DECIMAL(6,4), -- Tournament field strength
    course_fit_score DECIMAL(6,4), -- Player-course fit
    
    -- Actual outcomes (filled in after tournament)
    actual_value DECIMAL(10,4),
    prediction_error DECIMAL(10,4), -- |predicted - actual|
    squared_error DECIMAL(10,4), -- (predicted - actual)^2
    absolute_percentage_error DECIMAL(8,4),
    
    -- Binary outcome evaluation
    correct_prediction BOOLEAN, -- For classification tasks
    outcome_category TEXT, -- 'correct', 'close', 'wrong'
    
    -- Betting performance
    betting_edge DECIMAL(8,4), -- If converted to bet, what was the edge
    hypothetical_profit_loss DECIMAL(10,2), -- If bet was placed
    kelly_fraction DECIMAL(6,4), -- Recommended bet size
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(model_id, player_id, tournament_id, prediction_type)
);

-- Convert to hypertable for time-series analysis
SELECT create_hypertable('ml_predictions', 'prediction_timestamp', 
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- =========================================
-- PARLAY OPTIMIZATION TABLES
-- =========================================

-- Parlay Strategies - Define different parlay construction strategies
CREATE TABLE parlay_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Strategy definition
    strategy_name TEXT NOT NULL UNIQUE,
    strategy_type TEXT NOT NULL CHECK (strategy_type IN (
        'correlation_based', 'value_based', 'diversified', 
        'momentum_based', 'course_fit', 'contrarian'
    )),
    
    -- Strategy parameters
    min_legs INTEGER DEFAULT 2 CHECK (min_legs >= 2),
    max_legs INTEGER DEFAULT 6 CHECK (max_legs <= 12),
    min_edge_per_leg DECIMAL(6,4) DEFAULT 0.05, -- 5% minimum edge
    max_correlation_allowed DECIMAL(4,3) DEFAULT 0.3, -- 30% max correlation
    
    -- Risk management
    max_stake_percentage DECIMAL(4,3) DEFAULT 0.02, -- Max 2% of bankroll
    max_parlay_odds DECIMAL(8,2) DEFAULT 100.0, -- Max combined odds
    stop_loss_percentage DECIMAL(4,3) DEFAULT 0.10, -- 10% stop loss
    
    -- Selection criteria
    player_selection_criteria JSONB, -- How to select players
    market_selection_criteria JSONB, -- Which markets to include
    tournament_filters JSONB, -- Tournament type filters
    
    -- Performance tracking
    total_parlays_generated INTEGER DEFAULT 0,
    winning_parlays INTEGER DEFAULT 0,
    total_profit_loss DECIMAL(12,2) DEFAULT 0,
    roi DECIMAL(8,4) DEFAULT 0,
    
    -- Strategy status
    active BOOLEAN DEFAULT true,
    backtest_results JSONB, -- Historical performance
    
    -- Metadata
    created_by TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimal Parlay Combinations - AI-generated optimal parlay suggestions
CREATE TABLE optimal_parlay_combinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    strategy_id UUID REFERENCES parlay_strategies(id),
    
    -- Parlay composition
    selected_players UUID[] NOT NULL,
    selected_markets TEXT[] NOT NULL,
    market_ids UUID[] NOT NULL,
    
    -- Optimization metrics
    expected_value DECIMAL(8,4) NOT NULL,
    variance DECIMAL(8,4) NOT NULL,
    sharpe_ratio DECIMAL(6,4) NOT NULL,
    kelly_fraction DECIMAL(6,4) NOT NULL,
    
    -- Correlation analysis
    pairwise_correlations JSONB, -- All pairwise correlations
    overall_correlation_score DECIMAL(6,4), -- Weighted average correlation
    independence_score DECIMAL(6,4), -- How independent the legs are
    diversification_benefit DECIMAL(6,4), -- Benefit from diversification
    
    -- Risk metrics
    value_at_risk_95 DECIMAL(10,2), -- 95% VaR
    conditional_var DECIMAL(10,2), -- Expected shortfall
    maximum_drawdown DECIMAL(6,4), -- Maximum expected drawdown
    
    -- Parlay characteristics
    combined_odds DECIMAL(12,2) NOT NULL,
    total_implied_probability DECIMAL(8,6) NOT NULL,
    model_probability DECIMAL(8,6) NOT NULL,
    confidence_level DECIMAL(6,4), -- Overall confidence
    
    -- Optimization context
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    market_conditions_snapshot JSONB, -- Market state when generated
    optimization_algorithm TEXT DEFAULT 'genetic_algorithm',
    optimization_duration_ms INTEGER,
    
    -- Performance tracking
    recommended_stake DECIMAL(10,2),
    actual_stake DECIMAL(10,2),
    final_outcome TEXT, -- 'won', 'lost', 'partial', 'void'
    actual_payout DECIMAL(12,2),
    realized_roi DECIMAL(8,4),
    
    -- AI insights
    key_insights JSONB, -- AI-generated insights about this parlay
    risk_warnings JSONB, -- Potential risks identified
    alternative_suggestions JSONB, -- Alternative parlay compositions
    
    -- Status
    status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'recommended', 'placed', 'monitored', 'settled')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- ADVANCED ANALYTICS TABLES
-- =========================================

-- Player Similarity Matrix - For finding similar players and style matching
CREATE TABLE player_similarity_matrix (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Player pair
    player1_id UUID NOT NULL REFERENCES players(id),
    player2_id UUID NOT NULL REFERENCES players(id),
    
    -- Similarity metrics
    overall_similarity DECIMAL(6,4) CHECK (overall_similarity BETWEEN 0 AND 1),
    playing_style_similarity DECIMAL(6,4),
    performance_pattern_similarity DECIMAL(6,4),
    course_preference_similarity DECIMAL(6,4),
    
    -- Specific similarities
    sg_profile_similarity DECIMAL(6,4), -- Similar strokes gained profiles
    consistency_similarity DECIMAL(6,4), -- Similar consistency patterns
    pressure_performance_similarity DECIMAL(6,4), -- Similar clutch performance
    
    -- Physical similarities
    physical_similarity DECIMAL(6,4), -- Height, build, swing characteristics
    demographic_similarity DECIMAL(6,4), -- Age, nationality, experience
    
    -- Career trajectory similarity
    career_arc_similarity DECIMAL(6,4), -- Similar career progression
    peak_performance_similarity DECIMAL(6,4), -- Similar peak years
    
    -- Calculated using embeddings
    embedding_cosine_similarity DECIMAL(8,6), -- Cosine similarity of embeddings
    
    -- Metadata
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    sample_tournaments INTEGER, -- Number of tournaments compared
    calculation_method TEXT DEFAULT 'embedding_plus_stats',
    
    UNIQUE(player1_id, player2_id),
    CHECK(player1_id != player2_id),
    CHECK(player1_id < player2_id)
);

-- Tournament Context Analysis - Understanding tournament-specific factors
CREATE TABLE tournament_context_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    
    -- Field analysis
    field_strength_percentile DECIMAL(5,2), -- Where this field ranks historically
    field_depth_score DECIMAL(6,4), -- How deep the competitive field is
    star_power_index DECIMAL(6,4), -- Presence of top-ranked players
    
    -- Course context
    course_difficulty_ranking DECIMAL(5,2), -- Relative difficulty
    scoring_environment TEXT, -- 'low_scoring', 'average', 'high_scoring'
    weather_impact_factor DECIMAL(6,4), -- How much weather affects play
    
    -- Market implications
    betting_interest_level DECIMAL(6,4), -- Market liquidity and interest
    public_betting_patterns JSONB, -- Where public money is going
    sharp_money_indicators JSONB, -- Professional betting patterns
    
    -- Historical comparisons
    similar_tournaments UUID[], -- IDs of historically similar tournaments
    historical_winner_profile JSONB, -- Typical winner characteristics
    upset_potential DECIMAL(6,4), -- Likelihood of surprise winner
    
    -- Parlay implications
    correlation_environment TEXT, -- 'high_correlation', 'normal', 'low_correlation'
    value_opportunities_count INTEGER, -- Number of identified edges
    parlay_friendly_score DECIMAL(6,4), -- How good for parlay construction
    
    -- Analysis metadata
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    analysis_confidence DECIMAL(4,3),
    data_sources_used TEXT[],
    
    UNIQUE(tournament_id)
);

-- =========================================
-- INDEXES FOR AI/ML PERFORMANCE
-- =========================================

-- Player correlations
CREATE INDEX idx_correlations_players ON player_correlations(player1_id, player2_id);
CREATE INDEX idx_correlations_type ON player_correlations(correlation_type, correlation_coefficient);
CREATE INDEX idx_correlations_parlay_suitable ON player_correlations(parlay_suitability_score DESC) 
    WHERE anti_correlation_flag = true;

-- ML feature vectors
CREATE INDEX idx_features_player_date ON ml_feature_vectors(player_id, as_of_date DESC);
CREATE INDEX idx_features_tournament ON ml_feature_vectors(tournament_id);
CREATE INDEX idx_features_embedding ON ml_feature_vectors USING ivfflat (feature_vector vector_cosine_ops) WITH (lists = 200);
CREATE INDEX idx_features_completeness ON ml_feature_vectors(data_completeness_score) 
    WHERE data_completeness_score > 0.8;

-- ML models
CREATE INDEX idx_models_type_status ON ml_models(model_type, status);
CREATE INDEX idx_models_performance ON ml_models(accuracy DESC, f1_score DESC) WHERE status = 'production';

-- ML predictions
CREATE INDEX idx_predictions_model_tournament ON ml_predictions(model_id, tournament_id);
CREATE INDEX idx_predictions_player_time ON ml_predictions(player_id, prediction_timestamp DESC);
CREATE INDEX idx_predictions_accuracy ON ml_predictions(prediction_error ASC) WHERE actual_value IS NOT NULL;
CREATE INDEX idx_predictions_betting_edge ON ml_predictions(betting_edge DESC) WHERE betting_edge > 0;

-- Parlay optimization
CREATE INDEX idx_parlay_strategies_performance ON parlay_strategies(roi DESC, winning_parlays DESC) WHERE active = true;
CREATE INDEX idx_optimal_parlays_ev ON optimal_parlay_combinations(expected_value DESC, sharpe_ratio DESC);
CREATE INDEX idx_optimal_parlays_tournament ON optimal_parlay_combinations(tournament_id, generated_at DESC);

-- Player similarity
CREATE INDEX idx_similarity_players ON player_similarity_matrix(player1_id, player2_id);
CREATE INDEX idx_similarity_overall ON player_similarity_matrix(overall_similarity DESC);
CREATE INDEX idx_similarity_style ON player_similarity_matrix(playing_style_similarity DESC);

-- Tournament context
CREATE INDEX idx_context_tournament ON tournament_context_analysis(tournament_id);
CREATE INDEX idx_context_field_strength ON tournament_context_analysis(field_strength_percentile);
CREATE INDEX idx_context_parlay_friendly ON tournament_context_analysis(parlay_friendly_score DESC);

-- =========================================
-- MATERIALIZED VIEWS FOR AI ANALYTICS
-- =========================================

-- Player performance predictions summary
CREATE MATERIALIZED VIEW player_prediction_summary AS
SELECT 
    p.name as player_name,
    t.name as tournament_name,
    t.start_date,
    AVG(mp.predicted_value) as avg_predicted_value,
    AVG(mp.confidence_score) as avg_confidence,
    COUNT(DISTINCT mp.model_id) as model_count,
    AVG(mp.kelly_fraction) as avg_kelly_fraction,
    MAX(mp.prediction_timestamp) as latest_prediction
FROM ml_predictions mp
JOIN players p ON mp.player_id = p.id
JOIN tournaments t ON mp.tournament_id = t.id
JOIN ml_models m ON mp.model_id = m.id
WHERE m.status = 'production'
AND t.status IN ('active', 'scheduled')
AND mp.prediction_timestamp > NOW() - INTERVAL '24 hours'
GROUP BY p.id, p.name, t.id, t.name, t.start_date
HAVING COUNT(DISTINCT mp.model_id) >= 2; -- At least 2 models agree

-- Parlay opportunity heatmap
CREATE MATERIALIZED VIEW parlay_opportunity_heatmap AS
SELECT 
    t.name as tournament_name,
    COUNT(DISTINCT opc.id) as total_opportunities,
    AVG(opc.expected_value) as avg_expected_value,
    AVG(opc.independence_score) as avg_independence,
    COUNT(*) FILTER (WHERE opc.expected_value > 0.15) as high_value_count,
    COUNT(*) FILTER (WHERE opc.independence_score > 0.8) as low_correlation_count,
    MAX(opc.generated_at) as latest_analysis
FROM tournaments t
JOIN optimal_parlay_combinations opc ON t.id = opc.tournament_id
WHERE t.status = 'active'
AND opc.generated_at > NOW() - INTERVAL '6 hours'
GROUP BY t.id, t.name;

-- Comments
COMMENT ON TABLE player_correlations IS 'Correlation analysis between players for parlay optimization';
COMMENT ON TABLE ml_feature_vectors IS 'Pre-computed feature vectors for machine learning models';
COMMENT ON TABLE ml_models IS 'Registry of machine learning models with performance tracking';
COMMENT ON TABLE optimal_parlay_combinations IS 'AI-generated optimal parlay combinations with risk analysis';

SELECT 'AI/ML tables for correlation analysis and machine learning created successfully!' as result;