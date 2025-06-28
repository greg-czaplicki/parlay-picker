import { NextRequest } from 'next/server';
import { TrendsCalculationService } from '@/lib/services/trends-calculation-service';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'last_10';
    
    // Skip auth in development, require secret in production
    if (process.env.NODE_ENV === 'production') {
      const cronSecret = req.headers.get('x-cron-secret');
      if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const trendsService = new TrendsCalculationService();
    
    // Calculate trends for the specified period
    const trends = await trendsService.calculateAdvancedTrends(period);
    
    // Save the calculated trends
    await trendsService.saveTrends(trends, period);
    
    // Also populate any new tournament results if needed
    const populateResponse = await fetch(`${req.url.split('/api')[0]}/api/trends/populate-results`, {
      method: 'POST'
    });

    let populateMessage = '';
    if (populateResponse.ok) {
      const populateData = await populateResponse.json();
      populateMessage = populateData.message;
    }

    return Response.json({
      success: true,
      message: `Automated trends calculation completed for ${period}`,
      trends_calculated: trends.length,
      period,
      populate_message: populateMessage,
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('Cron trends calculation failed:', err);
    return Response.json({ 
      success: false, 
      error: err.message || String(err),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also allow GET for manual triggering/testing
export async function GET(req: NextRequest) {
  return POST(req);
}