import { createSupabaseClient, jsonSuccess, handleApiError } from '@/lib/api-utils'

export async function GET() {
  try {
    const supabase = createSupabaseClient();
    
    // Try to query tournaments table with all possible columns
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .limit(1);
    
    if (error) {
      return handleApiError(`Error querying tournaments table: ${error.message}`);
    }
    
    // Get column names from the result
    const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
    
    return jsonSuccess({
      columns,
      sampleData: data?.[0] || null,
      message: `Tournaments table has ${columns.length} columns`
    });
    
  } catch (error) {
    return handleApiError(error);
  }
}