import { NextRequest, NextResponse } from 'next/server'
import { GolfDataAggregator } from '@/lib/services/data-aggregator'

const dataAggregator = new GolfDataAggregator()

export async function GET(request: NextRequest) {
  try {
    console.log('Testing data aggregation...')
    
    const tournaments = await dataAggregator.getActiveTournaments()
    console.log('Tournaments:', tournaments?.length || 0)
    
    const matchups = await dataAggregator.getCurrentMatchups(10)
    console.log('Matchups:', matchups?.length || 0)
    
    return NextResponse.json({
      tournaments: tournaments,
      tournamentsCount: tournaments?.length || 0,
      matchups: matchups,
      matchupsCount: matchups?.length || 0,
      sampleMatchup: matchups?.[0] || null
    })
  } catch (error) {
    console.error('Test data aggregation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}