'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Users, Target } from 'lucide-react'

interface PlayerPerformanceData {
  playerName: string
  sgTotal: number
  recentForm: number
  confidence: number
}

interface AnalysisChartsProps {
  playerPerformance?: PlayerPerformanceData[]
  parlaySuccessData?: Array<{ category: string; winRate: number; count: number }>
  tournamentDistribution?: Array<{ tournament: string; players: number; avgOdds: number }>
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

export default function AnalysisCharts({ 
  playerPerformance = [], 
  parlaySuccessData = [],
  tournamentDistribution = []
}: AnalysisChartsProps) {
  
  if (playerPerformance.length === 0 && parlaySuccessData.length === 0 && tournamentDistribution.length === 0) {
    return (
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Analysis Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Target className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No chart data available</p>
            <p className="text-sm text-slate-500">
              Ask the AI about specific players or tournaments to see visual insights.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Player Performance Chart */}
      {playerPerformance.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5" />
              Player Performance Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={playerPerformance.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="playerName" 
                    stroke="#9CA3AF"
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Bar 
                    dataKey="sgTotal" 
                    fill="#3B82F6" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Strokes Gained Total - Higher values indicate better performance
            </p>
          </CardContent>
        </Card>
      )}

      {/* Parlay Success Rate Chart */}
      {parlaySuccessData.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Target className="h-5 w-5" />
              Parlay Success Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={parlaySuccessData}
                    dataKey="winRate"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ category, winRate }) => `${category}: ${winRate.toFixed(1)}%`}
                  >
                    {parlaySuccessData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
              {parlaySuccessData.map((item, index) => (
                <div key={item.category} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-sm" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-slate-300">
                    {item.category}: {item.winRate.toFixed(1)}% ({item.count})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tournament Distribution */}
      {tournamentDistribution.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tournament Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tournamentDistribution.slice(0, 5).map((tournament, index) => (
                <div key={tournament.tournament} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-300 font-medium">
                      {tournament.tournament}
                    </span>
                    <span className="text-xs text-slate-500">
                      {tournament.players} players
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-800 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min((tournament.avgOdds / 500) * 100, 100)}%` 
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 min-w-[60px]">
                      +{tournament.avgOdds} avg
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Average odds indicate betting market assessment of tournament difficulty
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}