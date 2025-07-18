'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, TrendingUp, Target, DollarSign } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

interface ParlayPick {
  playerId: number
  playerName: string
  matchupType: string
  odds: number
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

interface ParlayStrategy {
  id: string
  name: string
  description: string
  picks: ParlayPick[]
  totalOdds: number
  expectedValue: number
  riskLevel: 'conservative' | 'moderate' | 'aggressive'
  confidence: number
}

interface ParlaySuggestionsProps {
  suggestions?: ParlayStrategy[]
  onCreateParlay?: (strategy: ParlayStrategy) => void
}

export default function ParlaySuggestions({ suggestions = [], onCreateParlay }: ParlaySuggestionsProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null)

  const handleCreateParlay = async (strategy: ParlayStrategy) => {
    try {
      // This would integrate with your existing parlay creation system
      if (onCreateParlay) {
        onCreateParlay(strategy)
      } else {
        // Default behavior - you can customize this to integrate with your parlay system
        toast({
          title: "Parlay Strategy Selected",
          description: `"${strategy.name}" strategy with ${strategy.picks.length} picks has been prepared.`,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create parlay. Please try again.",
        variant: "destructive"
      })
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'conservative': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'moderate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'aggressive': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-500/20 text-green-400'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400'
      case 'low': return 'bg-red-500/20 text-red-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  if (suggestions.length === 0) {
    return (
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="h-5 w-5" />
            Parlay Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No parlay suggestions available</p>
            <p className="text-sm text-slate-500">
              Ask the AI about parlay strategies or current matchups to get personalized recommendations.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="h-5 w-5" />
            AI Parlay Suggestions
          </CardTitle>
        </CardHeader>
      </Card>

      {suggestions.map((strategy) => (
        <Card key={strategy.id} className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{strategy.name}</h3>
                <p className="text-sm text-slate-400">{strategy.description}</p>
              </div>
              <div className="flex gap-2">
                <Badge className={getRiskColor(strategy.riskLevel)} variant="outline">
                  {strategy.riskLevel}
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30" variant="outline">
                  {(strategy.confidence * 100).toFixed(0)}% confidence
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Strategy Metrics */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-800/50 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-slate-400">Total Odds</p>
                <p className="text-lg font-semibold text-white">+{strategy.totalOdds}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-400">Expected Value</p>
                <p className="text-lg font-semibold text-green-400">
                  {strategy.expectedValue > 0 ? '+' : ''}{strategy.expectedValue.toFixed(1)}%
                </p>
              </div>
            </div>

            <Separator className="bg-slate-700" />

            {/* Picks */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-300">Recommended Picks</h4>
              {strategy.picks.map((pick, index) => (
                <div key={index} className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-white">{pick.playerName}</p>
                      <p className="text-sm text-slate-400">{pick.matchupType}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getConfidenceColor(pick.confidence)} variant="outline">
                        {pick.confidence}
                      </Badge>
                      <span className="text-sm font-medium text-slate-300">
                        {pick.odds > 0 ? '+' : ''}{pick.odds}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{pick.reasoning}</p>
                </div>
              ))}
            </div>

            <Separator className="bg-slate-700" />

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={() => handleCreateParlay(strategy)}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Parlay
              </Button>
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
                onClick={() => setSelectedStrategy(selectedStrategy === strategy.id ? null : strategy.id)}
              >
                {selectedStrategy === strategy.id ? 'Hide Details' : 'View Details'}
              </Button>
            </div>

            {/* Expanded Details */}
            {selectedStrategy === strategy.id && (
              <div className="pt-4 space-y-3 border-t border-slate-700">
                <h5 className="text-sm font-medium text-slate-300">Strategy Analysis</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400 mb-1">Risk Assessment</p>
                    <p className="text-slate-300">
                      This {strategy.riskLevel} strategy has a {(strategy.confidence * 100).toFixed(0)}% 
                      confidence rating based on recent player form and historical matchup data.
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">Recommendation</p>
                    <p className="text-slate-300">
                      Expected value of {strategy.expectedValue.toFixed(1)}% suggests this parlay 
                      offers {strategy.expectedValue > 0 ? 'positive' : 'negative'} long-term value.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}