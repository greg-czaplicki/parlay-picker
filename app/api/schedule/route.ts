import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// New endpoint: /api/schedule (returns tournaments from DB, no sync)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("tournaments")
      .select("event_id, event_name, course, start_date, end_date")
      .order("start_date", { ascending: true });
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, tournaments: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}