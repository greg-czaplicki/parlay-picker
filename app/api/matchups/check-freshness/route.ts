import { NextRequest, NextResponse } from 'next/server'

const DATA_GOLF_API_KEY = process.env.DATAGOLF_API_KEY

function getDG3BallURL(tour: string = 'pga') {
  return `https://feeds.datagolf.com/betting-tools/matchups?tour=${tour}&market=3_balls&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`
}

async function fetchDGMetadata(url: string) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch DataGolf: ${url}`)
  const data = await res.json()
  // Return only the metadata we need for freshness check
  return {
    event_name: data.event_name,
    last_updated: data.last_updated,
    round_num: data.round_num
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tour = searchParams.get('tour') || 'pga'

  // Validate tour parameter
  if (!['pga', 'opp', 'euro', 'alt'].includes(tour)) {
    return NextResponse.json({ error: 'Invalid tour parameter. Must be one of: pga, opp, euro, alt' }, { status: 400 })
  }

  try {
    const metadata = await fetchDGMetadata(getDG3BallURL(tour))
    return NextResponse.json(metadata)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
} 