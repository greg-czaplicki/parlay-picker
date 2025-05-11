import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { validate } from '@/lib/validation'
import { tableEventQuerySchema } from '@/lib/schemas'

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
  
  try {
    // First, get a count by event_id
    const { data: countData, error: countError } = await supabase
      .from(table)
      .select('event_id, event_name, count(*)')
      .group('event_id, event_name');
    
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }
    
    // Now get details if event parameter is provided
    let detailData = null;
    let detailError = null;
    
    if (event) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('event_id', event)
        .limit(10);
      
      detailData = data;
      detailError = error;
    }
    
    return NextResponse.json({
      counts: countData,
      details: detailData,
      detailError: detailError ? detailError.message : null
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}