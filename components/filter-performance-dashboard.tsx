"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  DollarSign, 
  Activity,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw
} from "lucide-react"

interface FilterPerformanceData {
  filterPreset: string
  totalMatchupsAnalyzed: number
  matchupsFlaggedByFilter: number
  flaggedMatchupsWon: number
  winRate: number
  expectedWinRate: number
  edgeDetected: number
  roiPercentage: number
  sampleSizeConfidence: 'low' | 'medium' | 'high'
  statisticalSignificance: number
}

interface HistoricalPerformanceData {
  filterPreset: string
  overallWinRate: number
  overallEdge: number
  overallRoi: number
  confidenceScore: number
  trendDirection: 'improving' | 'declining' | 'stable'
  totalEventsAnalyzed: number
}

interface FilterPerformanceDashboardProps {
  className?: string
}

const FILTER_COLORS = {
  'fade-chalk': '#ef4444', // red
  'stat-dom': '#22c55e',   // green
  'form-play': '#3b82f6',  // blue
  'value': '#f59e0b',      // amber
  'data-intel': '#8b5cf6'  // purple
}

const FILTER_NAMES = {
  'fade-chalk': 'Fade Chalk',
  'stat-dom': 'Stat Dominance', 
  'form-play': 'Form Play',
  'value': 'Value Hunter',
  'data-intel': 'Data Intelligence'
}

export function FilterPerformanceDashboard({ className }: FilterPerformanceDashboardProps) {
  const [recentPerformance, setRecentPerformance] = useState<FilterPerformanceData[]>([])
  const [historicalPerformance, setHistoricalPerformance] = useState<HistoricalPerformanceData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTimeframe, setSelectedTimeframe] = useState('last_30_days')
  const [error, setError] = useState<string | null>(null)

  // Fetch performance data
  useEffect(() => {
    fetchPerformanceData()
  }, [selectedTimeframe])

  const fetchPerformanceData = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Fetch recent performance snapshots
      const recentResponse = await fetch('/api/filter-performance')
      if (!recentResponse.ok) throw new Error('Failed to fetch recent performance')
      const recentData = await recentResponse.json()

      // Fetch historical performance
      const historicalResponse = await fetch(`/api/filter-performance?includeHistorical=true&period=${selectedTimeframe}`)
      if (!historicalResponse.ok) throw new Error('Failed to fetch historical performance')
      const historicalData = await historicalResponse.json()

      // Process and group recent data by filter
      const groupedRecent = groupRecentPerformanceByFilter(recentData.recent || [])
      setRecentPerformance(groupedRecent)
      setHistoricalPerformance(historicalData.historical || [])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error fetching performance data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const groupRecentPerformanceByFilter = (snapshots: any[]): FilterPerformanceData[] => {
    const grouped = new Map<string, any[]>()
    
    snapshots.forEach(snapshot => {
      const filter = snapshot.filter_preset
      if (!grouped.has(filter)) {
        grouped.set(filter, [])
      }
      grouped.get(filter)!.push(snapshot)
    })

    return Array.from(grouped.entries()).map(([filter, snaps]) => {
      // Aggregate data across recent snapshots
      const totalAnalyzed = snaps.reduce((sum, s) => sum + s.total_matchups_analyzed, 0)
      const totalFlagged = snaps.reduce((sum, s) => sum + s.matchups_flagged_by_filter, 0)
      const totalWon = snaps.reduce((sum, s) => sum + s.flagged_matchups_won, 0)
      
      const avgWinRate = snaps.reduce((sum, s) => sum + (s.win_rate || 0), 0) / snaps.length
      const avgExpectedRate = snaps.reduce((sum, s) => sum + (s.expected_win_rate || 0), 0) / snaps.length
      const avgEdge = snaps.reduce((sum, s) => sum + (s.edge_detected || 0), 0) / snaps.length
      const avgRoi = snaps.reduce((sum, s) => sum + (s.roi_percentage || 0), 0) / snaps.length

      // Use most recent confidence assessment
      const mostRecent = snaps.sort((a, b) => 
        new Date(b.analysis_timestamp).getTime() - new Date(a.analysis_timestamp).getTime()
      )[0]

      return {
        filterPreset: filter,
        totalMatchupsAnalyzed: totalAnalyzed,
        matchupsFlaggedByFilter: totalFlagged,
        flaggedMatchupsWon: totalWon,
        winRate: avgWinRate,
        expectedWinRate: avgExpectedRate,
        edgeDetected: avgEdge,
        roiPercentage: avgRoi,
        sampleSizeConfidence: mostRecent?.sample_size_confidence || 'low',
        statisticalSignificance: mostRecent?.statistical_significance || 1.0
      }
    })
  }

  const getConfidenceBadgeColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />
      default: return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const formatEdge = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${(value * 100).toFixed(1)}%`
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span>Error loading filter performance data: {error}</span>
          </div>
          <Button onClick={fetchPerformanceData} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Filter Performance Dashboard</h2>
          <p className="text-muted-foreground">Track how each filter preset performs over time</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="season_2024">2024 Season</option>
            <option value="all_time">All Time</option>
          </select>
          <Button onClick={fetchPerformanceData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Analysis</TabsTrigger>
          <TabsTrigger value="trends">Historical Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Performance Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {recentPerformance.map(perf => (
              <Card key={perf.filterPreset}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {FILTER_NAMES[perf.filterPreset as keyof typeof FILTER_NAMES]}
                    </CardTitle>
                    <Badge className={getConfidenceBadgeColor(perf.sampleSizeConfidence)}>
                      {perf.sampleSizeConfidence}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Win Rate</span>
                      <span className="text-sm font-medium">{formatPercentage(perf.winRate)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Edge</span>
                      <span className={`text-sm font-medium ${perf.edgeDetected >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatEdge(perf.edgeDetected)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">ROI</span>
                      <span className={`text-sm font-medium ${perf.roiPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {perf.roiPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Sample</span>
                      <span className="text-sm">{perf.matchupsFlaggedByFilter}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Performance Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Filter Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={recentPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="filterPreset" 
                    tickFormatter={(value) => FILTER_NAMES[value as keyof typeof FILTER_NAMES] || value}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => FILTER_NAMES[value as keyof typeof FILTER_NAMES] || value}
                    formatter={(value: number, name: string) => {
                      if (name === 'edgeDetected') return [formatEdge(value), 'Edge Detected']
                      if (name === 'winRate') return [formatPercentage(value), 'Win Rate']
                      return [value, name]
                    }}
                  />
                  <Bar 
                    dataKey="edgeDetected" 
                    name="Edge Detected"
                    fill="#3b82f6"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Win Rate vs Expected Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Win Rate vs Expected</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={recentPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="filterPreset"
                      tickFormatter={(value) => FILTER_NAMES[value as keyof typeof FILTER_NAMES]?.split(' ')[0] || value}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="winRate" name="Actual Win Rate" fill="#22c55e" />
                    <Bar dataKey="expectedWinRate" name="Expected Win Rate" fill="#94a3b8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Sample Size Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Sample Size Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={recentPerformance}
                      dataKey="matchupsFlaggedByFilter"
                      nameKey="filterPreset"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${FILTER_NAMES[name as keyof typeof FILTER_NAMES]}: ${value}`}
                    >
                      {recentPerformance.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={FILTER_COLORS[entry.filterPreset as keyof typeof FILTER_COLORS]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          {/* Historical Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Historical Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {historicalPerformance.map(hist => (
                  <div key={hist.filterPreset} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: FILTER_COLORS[hist.filterPreset as keyof typeof FILTER_COLORS] }}
                      />
                      <div>
                        <h4 className="font-medium">{FILTER_NAMES[hist.filterPreset as keyof typeof FILTER_NAMES]}</h4>
                        <p className="text-sm text-muted-foreground">{hist.totalEventsAnalyzed} events analyzed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-sm font-medium">{formatPercentage(hist.overallWinRate)}</div>
                        <div className="text-xs text-muted-foreground">Win Rate</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-sm font-medium ${hist.overallEdge >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatEdge(hist.overallEdge)}
                        </div>
                        <div className="text-xs text-muted-foreground">Edge</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-sm font-medium ${hist.overallRoi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {hist.overallRoi.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">ROI</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(hist.trendDirection)}
                        <Badge variant="outline">{hist.trendDirection}</Badge>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium">{(hist.confidenceScore * 100).toFixed(0)}%</div>
                        <div className="text-xs text-muted-foreground">Confidence</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading performance data...</span>
        </div>
      )}
    </div>
  )
}