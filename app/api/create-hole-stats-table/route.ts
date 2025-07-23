import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    
    const createTableSQL = `
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
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL });

    if (error) {
      console.error('Error creating hole_statistics table:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'hole_statistics table created successfully',
      data
    });

  } catch (error) {
    console.error('Error in create-hole-stats-table API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}