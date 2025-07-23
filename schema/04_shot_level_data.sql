-- AI-Optimized Golf Parlay Analytics Schema  
-- Phase 4: Shot-Level Data Structure
-- Designed for granular shot tracking and advanced analytics

-- =========================================
-- SHOT-LEVEL TRACKING TABLES
-- =========================================

-- Shot Tracking table - Individual shot data with spatial coordinates
CREATE TABLE shot_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    tournament_round_id UUID NOT NULL REFERENCES tournament_rounds(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id),
    
    -- Shot identification
    hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
    shot_sequence INTEGER NOT NULL CHECK (shot_sequence >= 1), -- Shot number on this hole
    shot_timestamp TIMESTAMPTZ,
    
    -- Shot location data
    start_coordinates JSONB NOT NULL, -- {lat, lng, elevation, lie_type}
    end_coordinates JSONB NOT NULL, -- {lat, lng, elevation}
    distance_to_pin_start DECIMAL(6,2), -- Yards to pin before shot
    distance_to_pin_end DECIMAL(6,2), -- Yards to pin after shot
    
    -- Shot characteristics
    club_used TEXT, -- 'driver', '7_iron', 'sand_wedge', 'putter', etc
    shot_type TEXT CHECK (shot_type IN (
        'tee_shot', 'approach', 'chip', 'pitch', 'bunker', 'putt', 'recovery'
    )),
    shot_distance DECIMAL(6,2), -- Actual shot distance in yards
    carry_distance DECIMAL(6,2), -- Carry distance (for drives/approaches)
    
    -- Shot quality metrics
    strokes_gained_shot DECIMAL(6,3), -- SG for this individual shot
    expected_strokes_before DECIMAL(6,3), -- Expected strokes before shot
    expected_strokes_after DECIMAL(6,3), -- Expected strokes after shot
    
    -- Shot outcome
    shot_result TEXT CHECK (shot_result IN (
        'excellent', 'good', 'average', 'poor', 'penalty'
    )),
    penalty_strokes INTEGER DEFAULT 0 CHECK (penalty_strokes >= 0),
    
    -- Lie and conditions
    lie_type TEXT CHECK (lie_type IN (
        'tee', 'fairway', 'rough_light', 'rough_heavy', 'bunker', 'green', 
        'fringe', 'water', 'trees', 'cart_path', 'drop_zone'
    )),
    green_surface_type TEXT, -- For putts: 'green', 'fringe'
    slope_percentage DECIMAL(5,2), -- Uphill/downhill slope
    
    -- Environmental factors
    wind_speed DECIMAL(4,1), -- MPH
    wind_direction INTEGER CHECK (wind_direction BETWEEN 0 AND 359), -- Degrees
    temperature INTEGER, -- Fahrenheit
    humidity INTEGER CHECK (humidity BETWEEN 0 AND 100),
    
    -- Advanced analytics
    shot_efficiency DECIMAL(6,4), -- Distance gained per stroke
    trajectory_analysis JSONB, -- Ball flight data if available
    spin_rate INTEGER, -- RPM (if TrackMan data available)
    launch_angle DECIMAL(4,1), -- Degrees
    
    -- Shot context
    pressure_situation BOOLEAN DEFAULT false, -- Critical shot (playoff, final round, etc)
    crowd_reaction TEXT, -- 'positive', 'negative', 'neutral'
    shot_difficulty DECIMAL(3,1) CHECK (shot_difficulty BETWEEN 1 AND 10),
    
    -- Data source and quality
    data_source TEXT DEFAULT 'shotlink' CHECK (data_source IN (
        'shotlink', 'trackman', 'toptracer', 'manual', 'estimated'
    )),
    data_quality_score DECIMAL(3,2) DEFAULT 1.0 CHECK (data_quality_score BETWEEN 0 AND 1),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tournament_round_id, hole_number, shot_sequence),
    CONSTRAINT valid_shot_progression CHECK (
        distance_to_pin_end <= distance_to_pin_start OR shot_type = 'penalty'
    )
);

-- Convert to hypertable for efficient time-series queries
SELECT create_hypertable('shot_tracking', 'created_at', 
    chunk_time_interval => INTERVAL '1 week',
    if_not_exists => TRUE
);

-- Hole Statistics table - Aggregated hole-level performance
CREATE TABLE hole_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    tournament_round_id UUID NOT NULL REFERENCES tournament_rounds(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id),
    course_id UUID NOT NULL REFERENCES courses(id),
    
    -- Hole identification
    hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
    
    -- Hole characteristics (from course design)
    hole_par INTEGER NOT NULL CHECK (hole_par BETWEEN 3 AND 5),
    hole_yardage INTEGER NOT NULL CHECK (hole_yardage BETWEEN 100 AND 650),
    hole_handicap INTEGER CHECK (hole_handicap BETWEEN 1 AND 18),
    
    -- Scoring
    strokes_taken INTEGER NOT NULL CHECK (strokes_taken >= 1),
    score_to_par INTEGER NOT NULL, -- Calculated: strokes_taken - hole_par
    
    -- Shot breakdown
    total_shots INTEGER NOT NULL,
    tee_shots INTEGER DEFAULT 1,
    approach_shots INTEGER DEFAULT 0,
    short_game_shots INTEGER DEFAULT 0, -- Chips, pitches, bunker shots
    putts INTEGER DEFAULT 0,
    
    -- Performance metrics
    sg_off_tee_hole DECIMAL(6,3),
    sg_approach_hole DECIMAL(6,3),
    sg_around_green_hole DECIMAL(6,3),
    sg_putting_hole DECIMAL(6,3),
    sg_total_hole DECIMAL(6,3),
    
    -- Driving performance (for tee shots)
    drive_distance DECIMAL(6,2), -- Yards
    drive_accuracy BOOLEAN, -- Hit fairway or not
    drive_position TEXT CHECK (drive_position IN (
        'fairway', 'left_rough', 'right_rough', 'left_trees', 'right_trees', 
        'bunker', 'water', 'out_of_bounds'
    )),
    
    -- Approach performance
    approach_distance DECIMAL(6,2), -- Distance of approach shot
    greens_in_regulation BOOLEAN, -- Hit green in regulation
    distance_from_pin DECIMAL(6,2), -- Final distance from pin after approach
    
    -- Short game performance
    up_and_down BOOLEAN, -- Got up and down from off green
    sand_save BOOLEAN, -- Got sand save from bunker
    scrambling_success BOOLEAN, -- Made par or better after missing GIR
    
    -- Putting performance
    first_putt_distance DECIMAL(6,2), -- Distance of first putt
    putts_holed INTEGER DEFAULT 0, -- Number of putts holed
    longest_putt_made DECIMAL(6,2), -- Longest successful putt
    three_putt BOOLEAN DEFAULT false,
    
    -- Hole difficulty context
    field_scoring_average DECIMAL(4,2), -- How field scored on this hole
    hole_rank_difficulty INTEGER CHECK (hole_rank_difficulty BETWEEN 1 AND 18),
    pin_position JSONB, -- {front/middle/back, left/center/right, difficulty: 1-10}
    
    -- Weather impact
    weather_factor DECIMAL(3,2) DEFAULT 1.0, -- Weather difficulty multiplier
    wind_impact_score DECIMAL(3,2), -- How much wind affected play
    
    -- Advanced analytics
    hole_momentum_change DECIMAL(6,3), -- Momentum gained/lost on hole
    pressure_level DECIMAL(3,2), -- Pressure level (1-10)
    crowd_support_level DECIMAL(3,2), -- Crowd factor (1-10)
    
    -- Time tracking
    hole_duration INTERVAL, -- Time taken to play hole
    pace_of_play_rating TEXT CHECK (pace_of_play_rating IN (
        'fast', 'average', 'slow', 'very_slow'
    )),
    
    -- Data quality
    shot_tracking_complete BOOLEAN DEFAULT false, -- All shots tracked
    data_confidence DECIMAL(3,2) DEFAULT 1.0,
    
    -- Metadata
    played_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tournament_round_id, hole_number),
    CONSTRAINT valid_hole_score CHECK (strokes_taken >= putts),
    CONSTRAINT valid_shot_count CHECK (
        total_shots = tee_shots + approach_shots + short_game_shots + putts
    )
);

-- Course Hole Details table - Static hole information for each course
CREATE TABLE course_hole_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    
    -- Hole identification
    hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
    
    -- Basic hole info
    par INTEGER NOT NULL CHECK (par BETWEEN 3 AND 5),
    yardage INTEGER NOT NULL CHECK (yardage BETWEEN 100 AND 650),
    handicap INTEGER CHECK (handicap BETWEEN 1 AND 18),
    
    -- Hole layout and design
    hole_type TEXT CHECK (hole_type IN (
        'straight', 'dogleg_left', 'dogleg_right', 'double_dogleg'
    )),
    elevation_change INTEGER, -- Total elevation change from tee to green
    fairway_width_average INTEGER, -- Average fairway width in yards
    green_size INTEGER, -- Green size in square yards
    
    -- Hazards and features
    water_hazards JSONB, -- Array of water hazard locations and types
    bunkers JSONB, -- Array of bunker locations and types
    trees_ob JSONB, -- Out of bounds and tree locations
    forced_carries JSONB, -- Required carries over hazards
    
    -- Strategic elements
    hole_strategy JSONB, -- Optimal strategy notes
    risk_reward_rating DECIMAL(3,1) CHECK (risk_reward_rating BETWEEN 1 AND 10),
    difficulty_rating DECIMAL(3,1) CHECK (difficulty_rating BETWEEN 1 AND 10),
    
    -- Historical performance
    scoring_average DECIMAL(4,2), -- Historical scoring average
    birdie_percentage DECIMAL(5,2), -- Historical birdie rate
    bogey_or_worse_percentage DECIMAL(5,2), -- Historical bogey+ rate
    eagles INTEGER DEFAULT 0, -- Historical eagle count
    
    -- Pin position varieties
    pin_positions JSONB, -- Array of common pin positions
    green_complexities JSONB, -- Green slope and reading challenges
    
    -- Yardage markers and references
    tee_box_coordinates JSONB, -- GPS coordinates of tee boxes
    green_center_coordinates JSONB, -- GPS coordinates of green center
    landing_zone_coordinates JSONB, -- Optimal landing zones
    
    -- Weather considerations
    wind_exposure_rating DECIMAL(3,1), -- How exposed to wind (1-10)
    drainage_quality TEXT CHECK (drainage_quality IN ('excellent', 'good', 'fair', 'poor')),
    sun_exposure TEXT CHECK (sun_exposure IN ('full_sun', 'partial_shade', 'mostly_shaded')),
    
    -- Maintenance and conditions
    grass_type TEXT, -- Fairway and rough grass types
    green_grass_type TEXT, -- Green grass type
    typical_green_speed DECIMAL(3,1), -- Typical stimpmeter reading
    
    -- Player feedback and insights
    player_difficulty_consensus DECIMAL(3,1), -- Player-rated difficulty
    spectator_viewing_quality DECIMAL(3,1), -- TV/spectator friendliness
    memorable_shots JSONB, -- Famous shots played on this hole
    
    -- Metadata
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(course_id, hole_number)
);

-- =========================================
-- SHOT PATTERN ANALYSIS TABLES
-- =========================================

-- Shot Pattern Analysis - Identify patterns in player shot selection
CREATE TABLE shot_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    player_id UUID NOT NULL REFERENCES players(id),
    
    -- Pattern identification
    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'club_selection', 'shot_shape', 'distance_control', 'risk_taking',
        'pressure_response', 'course_management', 'putting_style'
    )),
    pattern_name TEXT NOT NULL,
    
    -- Pattern characteristics
    pattern_strength DECIMAL(4,3) CHECK (pattern_strength BETWEEN 0 AND 1),
    confidence_level DECIMAL(4,3) CHECK (confidence_level BETWEEN 0 AND 1),
    sample_size INTEGER NOT NULL CHECK (sample_size >= 10),
    
    -- Situational context
    situation_filters JSONB, -- When this pattern applies
    course_type_relevance JSONB, -- Which course types show this pattern
    tournament_type_relevance JSONB, -- Tournament contexts where pattern applies
    
    -- Pattern details
    statistical_evidence JSONB, -- Supporting statistics
    behavioral_indicators JSONB, -- Behavioral evidence
    performance_impact JSONB, -- How pattern affects performance
    
    -- Comparative analysis
    peer_comparison JSONB, -- How pattern compares to similar players
    tour_average_comparison JSONB, -- Comparison to tour averages
    
    -- Betting implications
    betting_edge_opportunities JSONB, -- Where pattern creates betting value
    market_awareness_level DECIMAL(3,2), -- How well markets price this pattern
    
    -- Temporal analysis
    pattern_stability TEXT CHECK (pattern_stability IN (
        'very_stable', 'stable', 'variable', 'unstable'
    )),
    seasonal_variation JSONB, -- How pattern changes through season
    career_trajectory JSONB, -- How pattern has evolved
    
    -- Analysis metadata
    analyzed_period_start DATE NOT NULL,
    analyzed_period_end DATE NOT NULL,
    tournaments_analyzed INTEGER NOT NULL,
    shots_analyzed INTEGER NOT NULL,
    
    -- Pattern status
    active BOOLEAN DEFAULT true,
    last_validated TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(player_id, pattern_type, pattern_name)
);

-- Shot Clustering Analysis - Group similar shots for pattern recognition
CREATE TABLE shot_clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Cluster identification
    cluster_name TEXT NOT NULL,
    cluster_type TEXT NOT NULL CHECK (cluster_type IN (
        'approach_distance', 'lie_type', 'pressure_level', 'course_position',
        'weather_conditions', 'tournament_stage'
    )),
    
    -- Cluster definition
    cluster_criteria JSONB NOT NULL, -- Criteria that define this cluster
    center_point JSONB, -- Cluster centroid characteristics
    
    -- Cluster statistics
    total_shots INTEGER NOT NULL DEFAULT 0,
    unique_players INTEGER NOT NULL DEFAULT 0,
    average_sg DECIMAL(6,3),
    success_rate DECIMAL(5,2),
    
    -- Performance metrics by cluster
    avg_distance_accuracy DECIMAL(5,2),
    avg_direction_accuracy DECIMAL(5,2),
    avg_outcome_quality DECIMAL(4,2),
    
    -- Strategic insights
    optimal_strategy JSONB, -- Best approach for shots in this cluster
    common_mistakes JSONB, -- Frequent errors in this cluster
    success_factors JSONB, -- What leads to success
    
    -- Market implications
    betting_edge_potential DECIMAL(4,3), -- Betting value opportunity
    market_efficiency DECIMAL(4,3), -- How well markets price this cluster
    
    -- Analysis parameters
    created_with_algorithm TEXT DEFAULT 'k_means',
    cluster_quality_score DECIMAL(4,3),
    last_recalculated TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(cluster_name, cluster_type)
);

-- =========================================
-- INDEXES FOR SHOT-LEVEL PERFORMANCE
-- =========================================

-- Shot tracking indexes
CREATE INDEX idx_shots_tournament_round ON shot_tracking(tournament_round_id);
CREATE INDEX idx_shots_player_hole ON shot_tracking(player_id, hole_number);
CREATE INDEX idx_shots_club_type ON shot_tracking(club_used, shot_type);
CREATE INDEX idx_shots_sg ON shot_tracking(strokes_gained_shot) WHERE strokes_gained_shot IS NOT NULL;
CREATE INDEX idx_shots_distance_pin ON shot_tracking(distance_to_pin_start, distance_to_pin_end);
CREATE INDEX idx_shots_quality ON shot_tracking(shot_result, shot_difficulty);
CREATE INDEX idx_shots_pressure ON shot_tracking(pressure_situation) WHERE pressure_situation = true;

-- Spatial indexes for shot coordinates
CREATE INDEX idx_shots_start_coords ON shot_tracking USING gin(start_coordinates);
CREATE INDEX idx_shots_end_coords ON shot_tracking USING gin(end_coordinates);

-- Hole statistics indexes  
CREATE INDEX idx_hole_stats_round ON hole_statistics(tournament_round_id);
CREATE INDEX idx_hole_stats_player_course ON hole_statistics(player_id, course_id);
CREATE INDEX idx_hole_stats_hole_par ON hole_statistics(hole_number, hole_par);
CREATE INDEX idx_hole_stats_sg_total ON hole_statistics(sg_total_hole) WHERE sg_total_hole IS NOT NULL;
CREATE INDEX idx_hole_stats_scoring ON hole_statistics(score_to_par, strokes_taken);
CREATE INDEX idx_hole_stats_time ON hole_statistics(played_at);

-- Course hole details indexes
CREATE INDEX idx_course_holes_course ON course_hole_details(course_id);
CREATE INDEX idx_course_holes_difficulty ON course_hole_details(difficulty_rating, par);
CREATE INDEX idx_course_holes_scoring ON course_hole_details(scoring_average, birdie_percentage);

-- Shot pattern indexes
CREATE INDEX idx_patterns_player_type ON shot_patterns(player_id, pattern_type);
CREATE INDEX idx_patterns_strength ON shot_patterns(pattern_strength DESC) WHERE active = true;
CREATE INDEX idx_patterns_betting_edge ON shot_patterns USING gin(betting_edge_opportunities);

-- Shot cluster indexes
CREATE INDEX idx_clusters_type ON shot_clusters(cluster_type);
CREATE INDEX idx_clusters_performance ON shot_clusters(average_sg DESC, success_rate DESC);

-- =========================================
-- MATERIALIZED VIEWS FOR SHOT ANALYTICS
-- =========================================

-- Player shot performance summary
CREATE MATERIALIZED VIEW player_shot_performance_summary AS
SELECT 
    p.name as player_name,
    st.shot_type,
    st.club_used,
    COUNT(*) as total_shots,
    AVG(st.strokes_gained_shot) as avg_sg_shot,
    AVG(st.shot_distance) as avg_distance,
    COUNT(*) FILTER (WHERE st.shot_result IN ('excellent', 'good')) as good_shots,
    COUNT(*) FILTER (WHERE st.shot_result IN ('poor', 'penalty')) as poor_shots,
    AVG(st.shot_efficiency) as avg_efficiency
FROM shot_tracking st
JOIN players p ON st.player_id = p.id
WHERE st.created_at > NOW() - INTERVAL '1 year'
AND st.strokes_gained_shot IS NOT NULL
GROUP BY p.id, p.name, st.shot_type, st.club_used
HAVING COUNT(*) >= 20; -- Minimum sample size

-- Course hole difficulty ranking
CREATE MATERIALIZED VIEW course_hole_difficulty_ranking AS
SELECT 
    c.name as course_name,
    chd.hole_number,
    chd.par,
    chd.yardage,
    chd.difficulty_rating,
    AVG(hs.score_to_par) as avg_score_to_par,
    AVG(hs.sg_total_hole) as avg_sg_hole,
    COUNT(hs.id) as rounds_played,
    COUNT(*) FILTER (WHERE hs.score_to_par <= -1) as birdies_or_better,
    COUNT(*) FILTER (WHERE hs.score_to_par >= 1) as bogeys_or_worse
FROM course_hole_details chd
JOIN courses c ON chd.course_id = c.id
LEFT JOIN hole_statistics hs ON chd.course_id = hs.course_id AND chd.hole_number = hs.hole_number
WHERE hs.played_at > NOW() - INTERVAL '2 years' OR hs.played_at IS NULL
GROUP BY c.id, c.name, chd.hole_number, chd.par, chd.yardage, chd.difficulty_rating
ORDER BY c.name, chd.hole_number;

-- Comments
COMMENT ON TABLE shot_tracking IS 'Granular shot-by-shot tracking with spatial coordinates and performance metrics';
COMMENT ON TABLE hole_statistics IS 'Aggregated hole-level performance statistics with comprehensive metrics';
COMMENT ON TABLE course_hole_details IS 'Static course hole information and characteristics for analysis';
COMMENT ON TABLE shot_patterns IS 'Player shot pattern analysis for behavioral insights and betting edges';

SELECT 'Shot-level data structure created successfully! Ready for LLM integration tables.' as result;