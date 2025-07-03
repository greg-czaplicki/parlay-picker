import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

// Force this route to be dynamic and bypass edge caching
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    
    // Get the most recent matchup update time
    const { data, error } = await supabase
      .from('matchups_v2')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (error) {
      throw new Error(`Failed to get last updated time: ${error.message}`)
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        lastUpdated: null,
        message: 'No matchups found'
      })
    }
    
    const lastUpdated = data[0].created_at
    const now = new Date()
    const updatedAt = new Date(lastUpdated)
    const minutesAgo = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60))
    
    const response = NextResponse.json({
      success: true,
      lastUpdated,
      minutesAgo,
      isRecent: minutesAgo <= 5, // Consider "current" if updated within 5 minutes
      formattedTime: updatedAt.toLocaleString()
    })
    
    // Set cache headers to prevent caching
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
    
  } catch (error: any) {
    console.error('Error getting last updated time:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
} 