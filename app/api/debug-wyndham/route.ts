import { NextResponse } from 'next/server'

const DATAGOLF_API_KEY = process.env.DATAGOLF_API_KEY

export async function GET() {
  if (!DATAGOLF_API_KEY) {
    return NextResponse.json({ error: 'DataGolf API key missing' }, { status: 500 })
  }

  const results: any = {}

  // Test all three tours
  const tours = ['pga', 'euro', 'opp']
  
  for (const tour of tours) {
    try {
      const url = `https://feeds.datagolf.com/preds/in-play?tour=${tour}&dead_heat=no&odds_format=percent&key=${DATAGOLF_API_KEY}`
      
      const response = await fetch(url, { cache: 'no-store' })
      const data = await response.json()
      
      results[tour] = {
        status: response.status,
        hasData: !!(data?.data?.length),
        dataCount: data?.data?.length || 0,
        eventName: data?.info?.event_name || null,
        info: data?.info || null,
        firstPlayer: data?.data?.[0] || null
      }
    } catch (error) {
      results[tour] = {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results
  })
}