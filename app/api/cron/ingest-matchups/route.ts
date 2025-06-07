import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Verify this is coming from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('🤖 Starting automated matchup ingestion...')
    
    // Use the existing ingest API endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
    
    const ingestResponse = await fetch(`${baseUrl}/api/matchups/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INGEST_SECRET}`
      },
      body: JSON.stringify({ tour: 'all' })
    })

    if (!ingestResponse.ok) {
      throw new Error(`Ingestion failed: ${ingestResponse.statusText}`)
    }

    const result = await ingestResponse.json()
    
    console.log('✅ Automated ingestion completed:', result)
    
    return NextResponse.json({
      success: true,
      message: 'Automated matchup ingestion completed',
      timestamp: new Date().toISOString(),
      result
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