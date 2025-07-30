import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/api-utils';

// Define the interfaces (matches the scraper output)
interface HoleStatistic {
  holeNumber: number;
  par: number;
  yardage: number;
  scoringAverage: number;
  difficultyRank: number;
  relativeToPar: number;
  holeLocation: 'front_nine' | 'back_nine';
}

interface CourseInfo {
  courseName: string;
  location: string;
  country: string;
  par: number | null;
  yardage: number | null;
  courseRating: number | null;
  slopeRating: number | null;
  courseType: string | null;
  elevation: number | null;
  designer: string | null;
  yearBuilt: number | null;
  difficultyFactors: {
    wind?: string;
    rough?: string;
    greens?: string;
    waterHazards?: string;
    elevationChanges?: string;
    treeLineage?: string;
  };
  holeStatistics?: HoleStatistic[];
  lastUpdated: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    
    // Parse the request body to get course information
    const { courses }: { courses: CourseInfo[] } = await req.json();
    
    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No course data provided' 
      }, { status: 400 });
    }

    console.log(`Processing ${courses.length} courses for insertion...`);
    
    const insertResults = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const course of courses) {
      try {
        // Check if course already exists
        const { data: existingCourse } = await supabase
          .from('courses')
          .select('course_id')
          .eq('course_name', course.courseName)
          .eq('location', course.location)
          .single();

        if (existingCourse) {
          console.log(`Course ${course.courseName} already exists, skipping...`);
          insertResults.push({
            courseName: course.courseName,
            status: 'skipped',
            reason: 'Course already exists'
          });
          continue;
        }

        // Insert the new course
        const { data: insertedCourse, error: insertError } = await supabase
          .from('courses')
          .insert({
            course_name: course.courseName,
            location: course.location,
            country: course.country,
            par: course.par || 72, // Default to 72 if not provided
            yardage: course.yardage,
            course_rating: course.courseRating,
            slope_rating: course.slopeRating,
            course_type: course.courseType,
            elevation: course.elevation,
            designer: course.designer,
            year_built: course.yearBuilt,
            difficulty_factors: course.difficultyFactors,
            // Note: renovation_history and signature_holes are not populated by scraper
            renovation_history: [],
            signature_holes: []
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting course ${course.courseName}:`, insertError);
          insertResults.push({
            courseName: course.courseName,
            status: 'error',
            error: insertError.message
          });
          errorCount++;
        } else {
          console.log(`Successfully inserted course ${course.courseName} with ID ${insertedCourse.course_id}`);
          
          // Insert hole statistics if available
          let holeStatsInserted = 0;
          if (course.holeStatistics && course.holeStatistics.length > 0) {
            console.log(`Inserting ${course.holeStatistics.length} hole statistics for ${course.courseName}...`);
            
            const holeStatsData = course.holeStatistics.map(hole => ({
              course_id: insertedCourse.course_id,
              tournament_id: null, // Will be updated when we have tournament context
              hole_number: hole.holeNumber,
              par: hole.par,
              yardage: hole.yardage,
              scoring_average: hole.scoringAverage,
              difficulty_rank: hole.difficultyRank,
              relative_to_par: hole.relativeToPar,
              hole_location: hole.holeLocation,
              data_source: 'pga_tour'
            }));

            console.log('Hole stats data being inserted:', JSON.stringify(holeStatsData, null, 2));

            const { data: holeStatsResult, error: holeStatsError } = await supabase
              .from('hole_statistics')
              .insert(holeStatsData)
              .select();

            if (holeStatsError) {
              console.error(`Error inserting hole statistics for ${course.courseName}:`, holeStatsError);
              console.error('Full error object:', JSON.stringify(holeStatsError, null, 2));
              // Don't fail the entire course insertion, just log the error
            } else {
              holeStatsInserted = holeStatsResult?.length || 0;
              console.log(`Successfully inserted ${holeStatsInserted} hole statistics for ${course.courseName}`);
            }
          } else {
            console.log(`No hole statistics provided for ${course.courseName}`);
          }

          insertResults.push({
            courseName: course.courseName,
            status: 'success',
            courseId: insertedCourse.course_id,
            holeStatistics: holeStatsInserted,
            holeStatisticsProvided: course.holeStatistics?.length || 0,
            debug: {
              hasHoleStatistics: !!(course.holeStatistics && course.holeStatistics.length > 0)
            }
          });
          successCount++;
        }
      } catch (error) {
        console.error(`Error processing course ${course.courseName}:`, error);
        insertResults.push({
          courseName: course.courseName,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Course population completed: ${successCount} inserted, ${errorCount} errors`,
      totalCourses: courses.length,
      successCount,
      errorCount,
      results: insertResults
    });

  } catch (error) {
    console.error('Error in course population API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to retrieve course information from existing tournaments
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    
    // Get all unique course names from tournaments
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('course_name')
      .not('course_name', 'is', null);

    if (tournamentsError) {
      return NextResponse.json({ 
        success: false, 
        error: tournamentsError.message 
      }, { status: 500 });
    }

    // Get existing courses to avoid duplicates
    const { data: existingCourses, error: coursesError } = await supabase
      .from('courses')
      .select('course_name, location, country, par, yardage, course_type, designer, year_built');

    if (coursesError) {
      return NextResponse.json({ 
        success: false, 
        error: coursesError.message 
      }, { status: 500 });
    }

    const existingCourseNames = new Set(existingCourses?.map(c => c.course_name) || []);
    
    // Group and count course names manually
    const courseNameCounts: { [key: string]: number } = {};
    tournaments?.forEach(t => {
      if (t.course_name) {
        courseNameCounts[t.course_name] = (courseNameCounts[t.course_name] || 0) + 1;
      }
    });
    
    // Convert to array and sort by count
    const uniqueCourses = Object.entries(courseNameCounts)
      .map(([course_name, tournament_count]) => ({ course_name, tournament_count }))
      .sort((a, b) => b.tournament_count - a.tournament_count);
    
    // Filter out courses that already exist
    const missingCourses = uniqueCourses.filter(c => 
      !existingCourseNames.has(c.course_name)
    );

    return NextResponse.json({
      success: true,
      totalUniqueCourses: uniqueCourses.length,
      existingCourses: existingCourses?.length || 0,
      missingCourses: missingCourses.length,
      missingCourseNames: missingCourses.map(c => c.course_name),
      existingCoursesData: existingCourses,
      tournamentCounts: uniqueCourses
    });

  } catch (error) {
    console.error('Error in course retrieval API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}