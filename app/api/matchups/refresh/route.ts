import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Manual odds refresh requested...')
    
    // Use the existing ingest API endpoint internally
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
    
    console.log('✅ Manual refresh completed:', result)
    
    return NextResponse.json({
      success: true,
      message: 'Odds refreshed successfully',
      timestamp: new Date().toISOString(),
      result
    })

  } catch (error: any) {
    console.error('❌ Manual refresh failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 