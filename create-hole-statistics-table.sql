-- Create the hole_statistics table
CREATE TABLE IF NOT EXISTS hole_statistics (
    hole_stat_id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses_v2(course_id) ON DELETE CASCADE,
    tournament_id INTEGER DEFAULT NULL,
    hole_number INTEGER NOT NULL,
    par INTEGER NOT NULL,
    yardage INTEGER NOT NULL,
    scoring_average DECIMAL(5,3),
    difficulty_rank INTEGER,
    relative_to_par DECIMAL(5,3),
    hole_location TEXT CHECK (hole_location IN ('front_nine', 'back_nine')),
    data_source TEXT DEFAULT 'pga_tour',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hole_statistics_course_id ON hole_statistics(course_id);
CREATE INDEX IF NOT EXISTS idx_hole_statistics_tournament_id ON hole_statistics(tournament_id);
CREATE INDEX IF NOT EXISTS idx_hole_statistics_hole_number ON hole_statistics(hole_number);

-- Create unique constraint to prevent duplicate hole statistics for the same course
CREATE UNIQUE INDEX IF NOT EXISTS idx_hole_statistics_unique 
ON hole_statistics(course_id, hole_number, COALESCE(tournament_id, 0));

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_hole_statistics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_hole_statistics_updated_at
    BEFORE UPDATE ON hole_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_hole_statistics_updated_at();