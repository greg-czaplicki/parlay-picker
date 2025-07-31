import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DATAGOLF_API_KEY = process.env.DATAGOLF_API_KEY

function getCurrentWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23,59,59,999);
  return {
    monday: monday.toISOString().split('T')[0],
    sunday: sunday.toISOString().split('T')[0],
  }
}

async function fetchDataGolfTournaments(): Promise<string[]> {
  const tours = ['pga', 'opp', 'euro']
  const activeEventNames = new Set<string>()
  const { monday, sunday } = getCurrentWeekRange()

  for (const tour of tours) {
    try {
      const url = `https://feeds.datagolf.com/get-schedule?tour=${tour}&file_format=json&key=${DATAGOLF_API_KEY}`
      const response = await fetch(url, { cache: 'no-store' })
      
      if (response.ok) {
        const data = await response.json()
        
        // Filter for tournaments in current week (Monday to Sunday)
        if (data.schedule && Array.isArray(data.schedule)) {
          data.schedule.forEach((tournament: any) => {
            // Include tournaments that start within current week
            if (tournament.event_name && 
                tournament.start_date >= monday && 
                tournament.start_date <= sunday) {
              activeEventNames.add(tournament.event_name)
            }
          })
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch ${tour} schedule from DataGolf:`, error)
    }
  }

  return Array.from(activeEventNames)
}

export async function GET(req: NextRequest) {
  try {
    // Get active tournament names from DataGolf API
    const activeEventNames = await fetchDataGolfTournaments()
    
    if (activeEventNames.length === 0) {
      return NextResponse.json([])
    }

    // Get matching tournaments from database
    const supabase = createSupabaseClient()
    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('dg_id, name, start_date, end_date')
      .in('name', activeEventNames)
      .order('start_date', { ascending: false })

    if (error) {
      throw error
    }

    // Map to expected format
    const events = (tournaments || []).map((t: any) => ({
      event_id: t.dg_id,
      event_name: t.name,
      start_date: t.start_date,
      end_date: t.end_date,
    }))

    return NextResponse.json(events)

  } catch (error: any) {
    console.error('Error fetching active tournaments:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}