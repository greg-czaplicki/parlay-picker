import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { validate } from '@/lib/validation'
import { tableEventQuerySchema } from '@/lib/schemas'
import { jsonSuccess, jsonError } from '@/lib/api-response'

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or Service Role Key is missing in environment variables.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const url = new URL(request.url);
  let params;
  try {
    params = validate(tableEventQuerySchema, {
      table: url.searchParams.get('table') ?? undefined,
      event: url.searchParams.get('event') ?? undefined,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }
  const { table, event } = params;
  if (!table || typeof table !== 'string') {
    return jsonError('Missing or invalid table parameter', 'VALIDATION_ERROR');
  }
  
  try {
    // First, get a count by event_id
    // Supabase JS does not support .group, so fetch all and group in JS if needed
    const { data: countData, error: countError } = await supabase
      .from(table)
      .select('event_id, event_name');
    // TODO: Group by event_id, event_name in JS if needed
    
    if (countError) {
      return jsonError(countError.message, 'DB_ERROR');
    }
    
    // Now get details if event parameter is provided
    let detailData = null;
    let detailError = null;
    
    if (event && typeof event === 'string') {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('event_id', event)
        .limit(10);
      
      detailData = data;
      detailError = error;
    }
    
    return jsonSuccess({
      counts: countData,
      details: detailData,
      detailError: detailError ? detailError.message : null
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 'INTERNAL_ERROR');
  }
}