import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Verify this is coming from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('🤖 Starting automated matchup ingestion for all tours...')
    
    // Use the existing ingest API endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
    
    // Ingest all available tours
    const tours = ['pga', 'euro', 'opp', 'alt']
    const results = []
    
    for (const tour of tours) {
      try {
        console.log(`📡 Ingesting ${tour.toUpperCase()} tour...`)
        
        const ingestResponse = await fetch(`${baseUrl}/api/betting-markets/ingest?tour=${tour}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.INGEST_SECRET}`
          }
        })

        const result = await ingestResponse.json()
        
        if (ingestResponse.ok) {
          console.log(`✅ ${tour.toUpperCase()}: ${result.inserted || 0} markets inserted`)
          results.push({
            tour: tour.toUpperCase(),
            status: 'success',
            inserted: result.inserted || 0,
            tournament: result.tournament,
            message: result.message
          })
        } else {
          console.log(`⚠️ ${tour.toUpperCase()}: ${result.message || 'Failed'}`)
          results.push({
            tour: tour.toUpperCase(),
            status: 'failed',
            inserted: 0,
            error: result.message || result.error
          })
        }
      } catch (tourError) {
        console.error(`❌ Error ingesting ${tour.toUpperCase()}:`, tourError)
        results.push({
          tour: tour.toUpperCase(),
          status: 'error',
          inserted: 0,
          error: tourError instanceof Error ? tourError.message : 'Unknown error'
        })
      }
    }
    
    // Calculate totals
    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0)
    const successfulTours = results.filter(r => r.status === 'success').length
    
    console.log(`✅ Automated ingestion completed: ${totalInserted} total markets from ${successfulTours}/${tours.length} tours`)
    
    return NextResponse.json({
      success: true,
      message: `Matchup ingestion completed for ${successfulTours}/${tours.length} tours`,
      totalInserted,
      tourResults: results,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Automated ingestion failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 