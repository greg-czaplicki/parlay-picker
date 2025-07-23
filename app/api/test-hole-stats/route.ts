import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    
    // Test inserting a single hole statistic (without last_updated)
    const testHoleStats = {
      course_id: 14, // Use the last inserted course ID
      tournament_id: null,
      hole_number: 1,
      par: 4,
      yardage: 400,
      scoring_average: 4.0,
      difficulty_rank: 1,
      relative_to_par: 0.0,
      hole_location: 'front_nine',
      data_source: 'pga_tour'
    };

    console.log('Testing hole statistics insertion with data:', testHoleStats);

    const { data: result, error } = await supabase
      .from('hole_statistics')
      .insert([testHoleStats])
      .select();

    if (error) {
      console.error('Error inserting test hole statistics:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        fullError: error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Test hole statistics inserted successfully',
      data: result
    });

  } catch (error) {
    console.error('Error in test-hole-stats API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}