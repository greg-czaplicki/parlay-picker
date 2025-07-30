"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Play, 
  Square, 
  RefreshCw, 
  Database,
  Trash2,
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  Settings,
  BarChart3,
  Zap,
  Shield
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AdminDashboardProps {
  className?: string
}

interface TaskResult {
  task: string
  success: boolean
  message?: string
  error?: string
  timestamp?: string
}

interface MaintenanceResult {
  success: boolean
  message: string
  execution_time_ms: number
  success_rate: number
  results: TaskResult[]
}

interface PipelineStatus {
  isRunning: boolean
  isEnabled: boolean
  lastRunTime: Date | null
  nextRunTime: Date | null
  config: any
}

export function AdminDashboard({ className }: AdminDashboardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [lastMaintenance, setLastMaintenance] = useState<MaintenanceResult | null>(null)
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  // Fetch pipeline status on mount
  useEffect(() => {
    fetchPipelineStatus()
  }, [])

  const fetchPipelineStatus = async () => {
    try {
      const response = await fetch('/api/automation/pipeline')
      if (response.ok) {
        const data = await response.json()
        setPipelineStatus(data)
      }
    } catch (error) {
      console.error('Error fetching pipeline status:', error)
    }
  }

  const runMaintenanceTasks = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/cron/weekly-maintenance', {
        method: 'GET'
      })
      
      if (response.ok) {
        const result = await response.json()
        setLastMaintenance(result)
      } else {
        const error = await response.json()
        setLastMaintenance({
          success: false,
          message: error.error || 'Maintenance failed',
          execution_time_ms: 0,
          success_rate: 0,
          results: []
        })
      }
    } catch (error) {
      setLastMaintenance({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: 0,
        success_rate: 0,
        results: []
      })
    } finally {
      setIsLoading(false)
    }
  }

  const togglePipeline = async (action: 'start' | 'stop') => {
    try {
      const response = await fetch('/api/automation/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      
      if (response.ok) {
        await fetchPipelineStatus()
      }
    } catch (error) {
      console.error(`Error ${action}ing pipeline:`, error)
    }
  }

  const runPipelineOnce = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/automation/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_once' })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('Pipeline run result:', result)
        await fetchPipelineStatus()
      }
    } catch (error) {
      console.error('Error running pipeline:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-600' : 'text-red-600'
  }

  const getStatusIcon = (success: boolean) => {
    return success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">System management and maintenance controls</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          System Status
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipeline">Filter Pipeline</TabsTrigger>
          <TabsTrigger value="maintenance">Database Maintenance</TabsTrigger>
          <TabsTrigger value="monitoring">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pipeline Status Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Filter Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <Badge variant={pipelineStatus?.isRunning ? "default" : "secondary"}>
                      {pipelineStatus?.isRunning ? 'Running' : 'Stopped'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Enabled</span>
                    <span className="text-xs">{pipelineStatus?.isEnabled ? 'Yes' : 'No'}</span>
                  </div>
                  {pipelineStatus?.lastRunTime && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Last Run</span>
                      <span className="text-xs">{new Date(pipelineStatus.lastRunTime).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Maintenance Status Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Database Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Last Maintenance</span>
                    <span className="text-xs">
                      {lastMaintenance ? 'Completed' : 'Not Run'}
                    </span>
                  </div>
                  {lastMaintenance && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Success Rate</span>
                        <span className="text-xs">{lastMaintenance.success_rate.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Duration</span>
                        <span className="text-xs">{(lastMaintenance.execution_time_ms / 1000).toFixed(1)}s</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={runPipelineOnce}
                  disabled={isLoading}
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Run Filter Analysis
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={runMaintenanceTasks}
                  disabled={isLoading}
                >
                  <Database className="h-3 w-3 mr-2" />
                  Database Cleanup
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={fetchPipelineStatus}
                >
                  <Activity className="h-3 w-3 mr-2" />
                  Refresh Status
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Filter Performance Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pipeline Controls */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => togglePipeline('start')}
                  disabled={pipelineStatus?.isRunning || isLoading}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start Pipeline
                </Button>
                <Button
                  variant="outline"
                  onClick={() => togglePipeline('stop')}
                  disabled={!pipelineStatus?.isRunning || isLoading}
                  className="flex items-center gap-2"
                >
                  <Square className="h-4 w-4" />
                  Stop Pipeline
                </Button>
                <Button
                  variant="secondary"
                  onClick={runPipelineOnce}
                  disabled={pipelineStatus?.isRunning || isLoading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Run Once
                </Button>
              </div>

              {/* Pipeline Status */}
              {pipelineStatus && (
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium">Current Status</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Running:</span>
                      <Badge className="ml-2" variant={pipelineStatus.isRunning ? "default" : "secondary"}>
                        {pipelineStatus.isRunning ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Enabled:</span>
                      <Badge className="ml-2" variant={pipelineStatus.isEnabled ? "default" : "secondary"}>
                        {pipelineStatus.isEnabled ? "Yes" : "No"}
                      </Badge>
                    </div>
                    {pipelineStatus.lastRunTime && (
                      <div>
                        <span className="text-muted-foreground">Last Run:</span>
                        <span className="ml-2">{new Date(pipelineStatus.lastRunTime).toLocaleString()}</span>
                      </div>
                    )}
                    {pipelineStatus.nextRunTime && (
                      <div>
                        <span className="text-muted-foreground">Next Run:</span>
                        <span className="ml-2">{new Date(pipelineStatus.nextRunTime).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Alert>
                <Activity className="h-4 w-4" />
                <AlertDescription>
                  The pipeline automatically checks for completed tournament rounds every 4 hours and processes filter performance data.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Maintenance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Button
                  onClick={runMaintenanceTasks}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  Run Maintenance Tasks
                </Button>
              </div>

              {/* Maintenance Tasks Description */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Maintenance Tasks</h4>
                <div className="space-y-2">
                  <div className="text-sm">
                    <div className="font-medium text-green-600 mb-1">✅ Data Preserved Forever:</div>
                    <ul className="text-muted-foreground ml-4 space-y-0.5">
                      <li>• All matchup results & filter performance data</li>
                      <li>• Historical performance analysis data</li>
                      <li>• Matchups with completed results</li>
                    </ul>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-orange-600 mb-1">🧹 Data Cleaned Up:</div>
                    <ul className="text-muted-foreground ml-4 space-y-0.5">
                      <li>• Live stats older than 30 days</li>
                      <li>• Unused matchups older than 1 year</li>
                      <li>• Parlays older than 6 months</li>
                      <li>• Filter event logs older than 2 years</li>
                    </ul>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-blue-600 mb-1">🔍 System Health:</div>
                    <ul className="text-muted-foreground ml-4 space-y-0.5">
                      <li>• Database health checks</li>
                      <li>• Table statistics collection</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Last Maintenance Results */}
              {lastMaintenance && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Last Maintenance Run</h4>
                    <Badge variant={lastMaintenance.success ? "default" : "destructive"}>
                      {lastMaintenance.success ? "Success" : "Failed"}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Success Rate:</span>
                      <span className="ml-2 font-medium">{lastMaintenance.success_rate.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="ml-2 font-medium">{(lastMaintenance.execution_time_ms / 1000).toFixed(1)}s</span>
                    </div>
                  </div>

                  {/* Individual Task Results */}
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium">Task Results:</h5>
                    {lastMaintenance.results.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                        <span className="flex items-center gap-2">
                          <span className={getStatusColor(result.success)}>
                            {getStatusIcon(result.success)}
                          </span>
                          {result.task.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        {result.error && (
                          <span className="text-xs text-red-600 max-w-xs truncate">
                            {result.error}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Health Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  System health monitoring features will be available in a future update. 
                  For now, use the maintenance tasks to check database health.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Running system tasks...</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}