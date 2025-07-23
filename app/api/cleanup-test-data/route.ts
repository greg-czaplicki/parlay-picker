import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    
    // Get all courses that look like test data or have corrupted data
    const { data: testCourses, error: fetchError } = await supabase
      .from('courses_v2')
      .select('course_id, course_name, designer')
      .or('course_name.ilike.%test%,course_name.ilike.%debug%,course_name.ilike.%fixed%,designer.ilike.%THE TOUR%');

    if (fetchError) {
      console.error('Error fetching test courses:', fetchError);
      return NextResponse.json({
        success: false,
        error: fetchError.message
      }, { status: 500 });
    }

    if (!testCourses || testCourses.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No test courses found to delete',
        deletedCourses: []
      });
    }

    console.log('Found test courses to delete:', testCourses);

    // Delete the test courses (hole statistics will be deleted automatically due to CASCADE)
    const courseIds = testCourses.map(c => c.course_id);
    
    const { error: deleteError } = await supabase
      .from('courses_v2')
      .delete()
      .in('course_id', courseIds);

    if (deleteError) {
      console.error('Error deleting test courses:', deleteError);
      return NextResponse.json({
        success: false,
        error: deleteError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${testCourses.length} test courses and their hole statistics`,
      deletedCourses: testCourses.map(c => ({
        courseId: c.course_id,
        courseName: c.course_name
      }))
    });

  } catch (error) {
    console.error('Error in cleanup-test-data API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    
    // Just show what test data exists without deleting
    const { data: testCourses, error: fetchError } = await supabase
      .from('courses_v2')
      .select('course_id, course_name, created_at, designer')
      .or('course_name.ilike.%test%,course_name.ilike.%debug%,course_name.ilike.%fixed%,designer.ilike.%THE TOUR%');

    if (fetchError) {
      console.error('Error fetching test courses:', fetchError);
      return NextResponse.json({
        success: false,
        error: fetchError.message
      }, { status: 500 });
    }

    // Also get hole statistics count for each test course
    const coursesWithHoleStats = await Promise.all(
      (testCourses || []).map(async (course) => {
        const { data: holeStats, error: holeStatsError } = await supabase
          .from('hole_statistics')
          .select('hole_stat_id')
          .eq('course_id', course.course_id);

        return {
          ...course,
          holeStatisticsCount: holeStats?.length || 0
        };
      })
    );

    return NextResponse.json({
      success: true,
      testCourses: coursesWithHoleStats,
      totalTestCourses: coursesWithHoleStats.length
    });

  } catch (error) {
    console.error('Error in cleanup-test-data API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}