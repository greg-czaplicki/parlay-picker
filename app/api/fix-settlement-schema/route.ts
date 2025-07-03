import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

export async function GET() {
  try {
    const supabase = createSupabaseClient()
    
    // Check if columns exist
    const { data: checkColumns } = await supabase
      .rpc('get_column_info', { 
        p_table_name: 'parlay_picks_v2' 
      })
    
    const hasSettledAt = checkColumns?.some((col: any) => col.column_name === 'settled_at')
    const hasSettlementNotes = checkColumns?.some((col: any) => col.column_name === 'settlement_notes')
    
    // Try a simpler approach - just check for unsettled picks
    const { data: unsettledPicks, error: checkError } = await supabase
      .from('parlay_picks_v2')
      .select('id, settlement_status')
      .eq('settlement_status', 'pending')
      .limit(5)
    
    if (checkError) {
      return NextResponse.json({
        error: 'Failed to check unsettled picks',
        details: checkError.message,
        hasSettledAt,
        hasSettlementNotes
      })
    }
    
    return NextResponse.json({
      success: true,
      unsettledPicksCount: unsettledPicks?.length || 0,
      hasSettledAt,
      hasSettlementNotes,
      message: 'Schema check complete. If columns are missing, please add them via Supabase dashboard.'
    })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Schema check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}