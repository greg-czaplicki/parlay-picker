-- AI-Optimized Golf Parlay Analytics Schema
-- Phase 1: Core Entity Tables
-- Designed for ML/LLM integration and sophisticated parlay analysis

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;
CREATE EXTENSION IF NOT EXISTS "vector" CASCADE; -- For ML embeddings

-- =========================================
-- CORE ENTITY TABLES
-- =========================================

-- Players table - Enhanced player profiles optimized for AI analysis
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dg_id BIGINT UNIQUE NOT NULL, -- DataGolf ID (preserve existing)
    pga_id TEXT UNIQUE, -- PGA Tour Player ID
    owgr_id INTEGER UNIQUE, -- Official World Golf Ranking ID
    
    -- Basic info
    name TEXT NOT NULL,
    country TEXT,
    country_code TEXT,
    birth_date DATE,
    height_cm INTEGER CHECK (height_cm BETWEEN 150 AND 220),
    weight_kg INTEGER CHECK (weight_kg BETWEEN 50 AND 150),
    
    -- Career info
    turned_professional INTEGER CHECK (turned_professional >= 1950),
    pga_tour_wins INTEGER DEFAULT 0,
    major_wins INTEGER DEFAULT 0,
    career_earnings DECIMAL(12,2),
    
    -- Playing characteristics (for AI analysis)
    playing_style JSONB, -- {driving_style: 'power', putting_style: 'aggressive', etc}
    physical_attributes JSONB, -- {swing_speed: 115, etc}
    mental_attributes JSONB, -- {pressure_performance: 0.8, consistency: 0.7}
    
    -- AI embeddings for similarity analysis
    style_embedding VECTOR(128), -- Player style embedding vector
    performance_embedding VECTOR(128), -- Performance pattern embedding
    
    -- Status tracking
    active BOOLEAN DEFAULT true,
    retirement_date DATE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_career_span CHECK (
        retirement_date IS NULL OR retirement_date > birth_date + INTERVAL '18 years'
    )
);

-- Courses table - Comprehensive course information for fit analysis
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic info
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    city TEXT,
    state_province TEXT,
    country TEXT NOT NULL,
    
    -- Physical characteristics
    par INTEGER NOT NULL CHECK (par BETWEEN 68 AND 73),
    yardage INTEGER NOT NULL CHECK (yardage BETWEEN 6000 AND 8000),
    course_rating DECIMAL(4,1) CHECK (course_rating BETWEEN 65.0 AND 80.0),
    slope_rating INTEGER CHECK (slope_rating BETWEEN 55 AND 155),
    
    -- Course type and design
    course_type TEXT CHECK (course_type IN ('links', 'parkland', 'desert', 'mountain', 'resort', 'stadium')),
    designer TEXT,
    year_built INTEGER CHECK (year_built >= 1850),
    
    -- Playing characteristics (for AI course fit analysis)
    characteristics JSONB NOT NULL DEFAULT '{}', -- {rough_difficulty: 8, green_speed: 12, wind_factor: 6}
    hole_details JSONB, -- Array of hole-by-hole details
    weather_patterns JSONB, -- Historical weather patterns
    
    -- Difficulty metrics
    scoring_average DECIMAL(4,2), -- Historical tournament scoring average
    cut_line_average DECIMAL(4,1), -- Typical cut line relative to par
    
    -- AI analysis
    course_dna JSONB, -- DNA characteristics for player matching
    course_embedding VECTOR(64), -- Course characteristics embedding
    
    -- Metadata  
    elevation INTEGER, -- Feet above sea level
    timezone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournaments table - Enhanced tournament metadata with AI features
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identifiers (preserve existing system)
    event_id INTEGER UNIQUE NOT NULL, -- Original event_id for migration
    
    -- Basic info
    name TEXT NOT NULL,
    tour TEXT NOT NULL CHECK (tour IN ('pga', 'european', 'korn_ferry', 'liv', 'asian', 'other')),
    season INTEGER NOT NULL CHECK (season >= 1990),
    
    -- Dates and timing
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    timezone TEXT,
    
    -- Tournament details
    course_id UUID REFERENCES courses(id),
    purse DECIMAL(12,2) CHECK (purse >= 0),
    fedex_cup_points INTEGER DEFAULT 0,
    world_ranking_points INTEGER DEFAULT 0,
    
    -- Tournament characteristics (for AI analysis)
    tournament_type TEXT CHECK (tournament_type IN ('major', 'wgc', 'signature', 'regular', 'alternate', 'playoff')),
    field_strength DECIMAL(4,2), -- Average world ranking of field
    cut_rule TEXT, -- "Top 70 and ties", "Top 65 and ties", etc
    
    -- Conditions and setup
    weather_conditions JSONB, -- Tournament week weather summary
    course_setup JSONB, -- Pin positions, rough height, green speed by day
    field_quality_metrics JSONB, -- Field strength analysis
    
    -- Status and results
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled', 'postponed')),
    winner_id UUID REFERENCES players(id),
    winning_score INTEGER, -- Relative to par
    
    -- AI features
    tournament_embedding VECTOR(32), -- Tournament characteristics embedding
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_tournament_dates CHECK (end_date >= start_date),
    CONSTRAINT valid_tournament_duration CHECK (end_date <= start_date + INTERVAL '7 days')
);

-- Tournament Rounds table - Individual round data with comprehensive tracking
CREATE TABLE tournament_rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id),
    
    -- Round info
    round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 4),
    round_date DATE NOT NULL,
    
    -- Scoring
    strokes INTEGER CHECK (strokes BETWEEN 50 AND 100),
    score_to_par INTEGER, -- Calculated: strokes - course par
    position TEXT, -- "1", "T5", "CUT", "WD", "DQ"
    position_numeric INTEGER, -- For sorting and analysis
    
    -- Round progress
    holes_completed INTEGER DEFAULT 18 CHECK (holes_completed BETWEEN 0 AND 18),
    tee_time TIMESTAMPTZ,
    round_duration INTERVAL, -- Time to complete round
    
    -- Detailed stats (Strokes Gained)
    sg_total DECIMAL(6,3),
    sg_off_tee DECIMAL(6,3),
    sg_approach DECIMAL(6,3),
    sg_around_green DECIMAL(6,3),
    sg_putting DECIMAL(6,3),
    sg_tee_to_green DECIMAL(6,3),
    
    -- Traditional stats
    driving_distance DECIMAL(6,2),
    driving_accuracy DECIMAL(5,2), -- Percentage
    greens_in_regulation DECIMAL(5,2), -- Percentage
    putts INTEGER CHECK (putts BETWEEN 20 AND 50),
    putts_per_gir DECIMAL(4,2),
    scrambling DECIMAL(5,2), -- Percentage
    sand_saves DECIMAL(5,2), -- Percentage
    
    -- Advanced metrics
    proximity_to_hole JSONB, -- Distance from pin by shot type
    club_performance JSONB, -- Performance by club type
    hole_by_hole_scores JSONB, -- Array of scores for each hole
    
    -- Conditions and context
    weather_conditions JSONB, -- Weather during this round
    pin_positions JSONB, -- Pin positions for this round
    course_conditions JSONB, -- Firmness, speed, etc.
    
    -- AI features
    momentum_score DECIMAL(6,3), -- Calculated momentum for this round
    pressure_situations JSONB, -- Performance in pressure situations
    round_narrative TEXT, -- AI-generated round summary
    
    -- Metadata
    data_source TEXT DEFAULT 'api',
    data_quality_score DECIMAL(3,2) DEFAULT 1.0 CHECK (data_quality_score BETWEEN 0 AND 1),
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tournament_id, player_id, round_number),
    CONSTRAINT valid_round_context CHECK (
        round_date BETWEEN (SELECT start_date FROM tournaments WHERE id = tournament_id) 
        AND (SELECT end_date FROM tournaments WHERE id = tournament_id)
    )
);

-- Convert tournament_rounds to hypertable for time-series optimization
SELECT create_hypertable('tournament_rounds', 'round_date', 
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- =========================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- =========================================

-- Players indexes
CREATE INDEX idx_players_dg_id ON players(dg_id);
CREATE INDEX idx_players_name ON players USING gin(to_tsvector('english', name));
CREATE INDEX idx_players_country ON players(country);
CREATE INDEX idx_players_active ON players(active) WHERE active = true;
CREATE INDEX idx_players_style_embedding ON players USING ivfflat (style_embedding vector_cosine_ops) WITH (lists = 100);

-- Courses indexes  
CREATE INDEX idx_courses_name ON courses USING gin(to_tsvector('english', name));
CREATE INDEX idx_courses_location ON courses(country, state_province, city);
CREATE INDEX idx_courses_type ON courses(course_type);
CREATE INDEX idx_courses_characteristics ON courses USING gin(characteristics);
CREATE INDEX idx_courses_embedding ON courses USING ivfflat (course_embedding vector_cosine_ops) WITH (lists = 50);

-- Tournaments indexes
CREATE INDEX idx_tournaments_event_id ON tournaments(event_id);
CREATE INDEX idx_tournaments_dates ON tournaments(start_date, end_date);
CREATE INDEX idx_tournaments_tour_season ON tournaments(tour, season);
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_course ON tournaments(course_id);
CREATE INDEX idx_tournaments_type_strength ON tournaments(tournament_type, field_strength);

-- Tournament rounds indexes (optimized for analytics)
CREATE INDEX idx_rounds_tournament_player ON tournament_rounds(tournament_id, player_id);
CREATE INDEX idx_rounds_player_date ON tournament_rounds(player_id, round_date);
CREATE INDEX idx_rounds_tournament_round ON tournament_rounds(tournament_id, round_number);
CREATE INDEX idx_rounds_position ON tournament_rounds(position_numeric) WHERE position_numeric IS NOT NULL;
CREATE INDEX idx_rounds_sg_total ON tournament_rounds(sg_total) WHERE sg_total IS NOT NULL;
CREATE INDEX idx_rounds_performance ON tournament_rounds(sg_total, sg_off_tee, sg_approach, sg_putting);

-- =========================================
-- TRIGGERS FOR DATA CONSISTENCY
-- =========================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_rounds_updated_at BEFORE UPDATE ON tournament_rounds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calculate score_to_par automatically
CREATE OR REPLACE FUNCTION calculate_score_to_par()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.strokes IS NOT NULL THEN
        NEW.score_to_par = NEW.strokes - (
            SELECT par FROM courses c 
            JOIN tournaments t ON t.course_id = c.id 
            WHERE t.id = NEW.tournament_id
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_round_score_to_par 
    BEFORE INSERT OR UPDATE ON tournament_rounds
    FOR EACH ROW EXECUTE FUNCTION calculate_score_to_par();

-- =========================================
-- COMMENTS FOR DOCUMENTATION
-- =========================================

COMMENT ON TABLE players IS 'Enhanced player profiles with AI features for sophisticated analytics and player similarity analysis';
COMMENT ON TABLE courses IS 'Comprehensive course information with characteristics for AI-powered course fit analysis';  
COMMENT ON TABLE tournaments IS 'Tournament metadata with field strength and conditions for context-aware analysis';
COMMENT ON TABLE tournament_rounds IS 'Time-series optimized round data with comprehensive stats and AI features';

COMMENT ON COLUMN players.style_embedding IS 'Vector embedding representing player style for similarity matching';
COMMENT ON COLUMN players.playing_style IS 'JSON object with playing characteristics like driving_style, putting_style, etc';
COMMENT ON COLUMN courses.course_dna IS 'Course characteristics for player-course fit analysis';
COMMENT ON COLUMN tournament_rounds.momentum_score IS 'Calculated momentum indicator for this specific round';

-- Success message
SELECT 'Core entity tables created successfully! Ready for betting markets and AI tables.' as result;