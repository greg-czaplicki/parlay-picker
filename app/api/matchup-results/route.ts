import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

// GET: Fetch matchup results
export async function GET(req: NextRequest) {
  const supabase = createSupabaseClient()
  const { searchParams } = new URL(req.url)
  
  const eventId = searchParams.get('eventId')
  const roundNum = searchParams.get('roundNum')
  const matchupId = searchParams.get('matchupId')

  try {
    let query = supabase
      .from('matchup_results')
      .select('*')

    // Apply filters
    if (eventId) {
      query = query.eq('event_id', parseInt(eventId))
    }

    if (roundNum) {
      query = query.eq('round_num', parseInt(roundNum))
    }

    if (matchupId) {
      query = query.eq('matchup_id', parseInt(matchupId))
    }

    const { data, error } = await query
      .order('result_determined_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      results: data || [],
      count: data?.length || 0
    })

  } catch (error: any) {
    console.error('Error fetching matchup results:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Record matchup results
export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient()
  
  try {
    const body = await req.json()
    const { 
      matchupId,
      eventId,
      eventName,
      roundNum,
      matchupType,
      players,
      winnerDgId,
      winnerName,
      scores,
      totalScores,
      resultDeterminedAt
    } = body

    // Validate required fields
    if (!matchupId || !eventId || !roundNum || !winnerDgId) {
      return NextResponse.json(
        { error: 'Missing required fields: matchupId, eventId, roundNum, winnerDgId' },
        { status: 400 }
      )
    }

    // Prepare result record
    const resultRecord = {
      matchup_id: matchupId,
      event_id: eventId,
      event_name: eventName,
      round_num: roundNum,
      matchup_type: matchupType,
      
      // Player info
      player1_dg_id: players?.player1?.dgId,
      player1_name: players?.player1?.name,
      player2_dg_id: players?.player2?.dgId,
      player2_name: players?.player2?.name,
      player3_dg_id: players?.player3?.dgId || null,
      player3_name: players?.player3?.name || null,
      
      // Odds at time of matchup (if available)
      player1_odds: players?.player1?.odds || null,
      player2_odds: players?.player2?.odds || null,
      player3_odds: players?.player3?.odds || null,
      player1_dg_odds: players?.player1?.dgOdds || null,
      player2_dg_odds: players?.player2?.dgOdds || null,
      player3_dg_odds: players?.player3?.dgOdds || null,
      
      // Results
      winner_dg_id: winnerDgId,
      winner_name: winnerName,
      player1_score: scores?.player1 || null,
      player2_score: scores?.player2 || null,
      player3_score: scores?.player3 || null,
      player1_total_score: totalScores?.player1 || null,
      player2_total_score: totalScores?.player2 || null,
      player3_total_score: totalScores?.player3 || null,
      
      result_determined_at: resultDeterminedAt || new Date().toISOString()
    }

    // Insert or update result
    const { data, error } = await supabase
      .from('matchup_results')
      .upsert(resultRecord, { 
        onConflict: 'matchup_id,event_id,round_num',
        ignoreDuplicates: false 
      })
      .select()

    if (error) {
      throw error
    }

    return NextResponse.json({
      message: 'Matchup result recorded successfully',
      result: data?.[0] || resultRecord
    })

  } catch (error: any) {
    console.error('Error recording matchup result:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: Update existing matchup result
export async function PUT(req: NextRequest) {
  const supabase = createSupabaseClient()
  
  try {
    const body = await req.json()
    const { 
      resultId,
      winnerDgId,
      winnerName,
      scores,
      totalScores,
      resultDeterminedAt
    } = body

    if (!resultId) {
      return NextResponse.json(
        { error: 'resultId is required for updates' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    
    if (winnerDgId) updateData.winner_dg_id = winnerDgId
    if (winnerName) updateData.winner_name = winnerName
    if (scores) {
      updateData.player1_score = scores.player1 || null
      updateData.player2_score = scores.player2 || null
      updateData.player3_score = scores.player3 || null
    }
    if (totalScores) {
      updateData.player1_total_score = totalScores.player1 || null
      updateData.player2_total_score = totalScores.player2 || null
      updateData.player3_total_score = totalScores.player3 || null
    }
    if (resultDeterminedAt) {
      updateData.result_determined_at = resultDeterminedAt
    }

    const { data, error } = await supabase
      .from('matchup_results')
      .update(updateData)
      .eq('id', resultId)
      .select()

    if (error) {
      throw error
    }

    return NextResponse.json({
      message: 'Matchup result updated successfully',
      result: data?.[0]
    })

  } catch (error: any) {
    console.error('Error updating matchup result:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE: Remove matchup result
export async function DELETE(req: NextRequest) {
  const supabase = createSupabaseClient()
  const { searchParams } = new URL(req.url)
  
  const resultId = searchParams.get('resultId')

  if (!resultId) {
    return NextResponse.json(
      { error: 'resultId is required' },
      { status: 400 }
    )
  }

  try {
    const { error } = await supabase
      .from('matchup_results')
      .delete()
      .eq('id', parseInt(resultId))

    if (error) {
      throw error
    }

    return NextResponse.json({
      message: 'Matchup result deleted successfully'
    })

  } catch (error: any) {
    console.error('Error deleting matchup result:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}