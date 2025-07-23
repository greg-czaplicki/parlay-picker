import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    
    // Check if hole_statistics table exists by trying to select from it
    const { data: holeStatsTest, error: holeStatsError } = await supabase
      .from('hole_statistics')
      .select('hole_stat_id')
      .limit(1);

    const { data: coursesTest, error: coursesError } = await supabase
      .from('courses_v2')
      .select('course_id')
      .limit(1);

    return NextResponse.json({
      success: true,
      holeStatisticsExists: !holeStatsError,
      holeStatsError: holeStatsError?.message || null,
      coursesV2Exists: !coursesError,
      coursesError: coursesError?.message || null
    });

  } catch (error) {
    console.error('Error in check-tables API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}