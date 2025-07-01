import { NextRequest, NextResponse } from 'next/server'

// Force this route to be dynamic and bypass edge caching
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Manual odds refresh requested...')
    
    // Get the base URL from the current request
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`
    
    console.log('Using base URL:', baseUrl)
    console.log('INGEST_SECRET available:', !!process.env.INGEST_SECRET)
    
    // Tours to refresh - 'all' means all tours
    const tours = ['pga', 'euro', 'opp', 'alt']
    const results: any[] = []
    let totalInserted = 0
    
    // Call each tour individually
    for (const tour of tours) {
      try {
        console.log(`Refreshing ${tour} tour...`)
        
        const ingestResponse = await fetch(`${baseUrl}/api/matchups/ingest?tour=${tour}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.INGEST_SECRET}`
          }
        })

        console.log(`${tour} response status:`, ingestResponse.status)
        
        if (!ingestResponse.ok) {
          const errorText = await ingestResponse.text()
          console.error(`${tour} failed:`, errorText)
          throw new Error(`${tour.toUpperCase()} tour failed: ${ingestResponse.statusText}`)
        }

        const result = await ingestResponse.json()
        console.log(`${tour} result:`, result)
        
        results.push({
          tour,
          inserted: result.inserted || 0,
          three_ball: result.three_ball || 0,
          two_ball: result.two_ball || 0,
          message: result.message
        })
        
        totalInserted += result.inserted || 0
        
      } catch (tourError: any) {
        console.error(`Error refreshing ${tour}:`, tourError.message)
        results.push({
          tour,
          error: tourError.message,
          inserted: 0
        })
      }
    }
    
    console.log('✅ Manual refresh completed. Total inserted:', totalInserted)
    
    const response = NextResponse.json({
      success: true,
      message: 'Odds refreshed successfully',
      timestamp: new Date().toISOString(),
      totalInserted,
      results,
      inserted: totalInserted // Add for compatibility with manual-ingest-button
    })

    // Ensure this endpoint is never cached
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response

  } catch (error: any) {
    console.error('❌ Manual refresh failed:', error)
    
    const errorResponse = NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })

    // Ensure error responses are also not cached
    errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    errorResponse.headers.set('Pragma', 'no-cache')
    errorResponse.headers.set('Expires', '0')

    return errorResponse
  }
} 