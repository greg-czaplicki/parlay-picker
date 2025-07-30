import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'
import { AutomatedPerformancePipeline } from '@/lib/automated-performance-pipeline'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

// Global pipeline instance (in a real app, this would be managed differently)
let globalPipeline: AutomatedPerformancePipeline | null = null

// GET: Get pipeline status
export async function GET(req: NextRequest) {
  try {
    if (!globalPipeline) {
      return NextResponse.json({
        status: 'not_initialized',
        isRunning: false,
        isEnabled: false,
        lastRunTime: null,
        nextRunTime: null,
        config: null
      })
    }

    const status = globalPipeline.getStatus()
    
    return NextResponse.json({
      status: 'initialized',
      ...status
    })

  } catch (error: any) {
    console.error('Error getting pipeline status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Control pipeline (start, stop, run once, configure)
export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient()
  
  try {
    const body = await req.json()
    const { action, config } = body

    // Initialize pipeline if not exists
    if (!globalPipeline) {
      globalPipeline = new AutomatedPerformancePipeline(supabase, config)
    }

    switch (action) {
      case 'start':
        globalPipeline.start()
        return NextResponse.json({
          message: 'Pipeline started',
          status: globalPipeline.getStatus()
        })

      case 'stop':
        globalPipeline.stop()
        return NextResponse.json({
          message: 'Pipeline stopped',
          status: globalPipeline.getStatus()
        })

      case 'run_once':
        if (globalPipeline.getStatus().isRunning) {
          return NextResponse.json(
            { error: 'Pipeline is already running' },
            { status: 409 }
          )
        }
        
        const result = await globalPipeline.runPipeline()
        return NextResponse.json({
          message: 'Pipeline run completed',
          result
        })

      case 'configure':
        if (!config) {
          return NextResponse.json(
            { error: 'Configuration required' },
            { status: 400 }
          )
        }
        
        globalPipeline.updateConfig(config)
        return NextResponse.json({
          message: 'Pipeline configuration updated',
          status: globalPipeline.getStatus()
        })

      case 'initialize':
        globalPipeline = new AutomatedPerformancePipeline(supabase, config)
        return NextResponse.json({
          message: 'Pipeline initialized',
          status: globalPipeline.getStatus()
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('Error in pipeline control:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: Update configuration only
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    
    if (!globalPipeline) {
      return NextResponse.json(
        { error: 'Pipeline not initialized' },
        { status: 404 }
      )
    }

    globalPipeline.updateConfig(body)
    
    return NextResponse.json({
      message: 'Configuration updated successfully',
      status: globalPipeline.getStatus()
    })

  } catch (error: any) {
    console.error('Error updating pipeline configuration:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE: Stop and reset pipeline
export async function DELETE(req: NextRequest) {
  try {
    if (globalPipeline) {
      globalPipeline.stop()
      globalPipeline = null
    }

    return NextResponse.json({
      message: 'Pipeline stopped and reset'
    })

  } catch (error: any) {
    console.error('Error resetting pipeline:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}