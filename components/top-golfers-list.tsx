"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useTopGolfersQuery } from '@/hooks/use-top-golfers-query'

interface TopGolfer {
  name: string
  matchup: string
  odds: number
  valueRating: number
  confidenceScore: number
  bookmaker: string
}

export default function TopGolfersList({
  matchupType,
  activeFilter,
}: {
  matchupType: string
  activeFilter: string
}) {
  // Use React Query for top golfers
  const { data: topGolfers = [], isLoading, isError, error, refetch, isFetching } = useTopGolfersQuery(matchupType, activeFilter)

  // Format player name (Last, First -> First Last)
  const formatPlayerName = (name: string) => {
    if (name.includes(",")) {
      return name.split(",").reverse().join(" ").trim()
    }
    return name
  }

  // Format odds for display
  const formatOdds = (odds: number) => {
    if (odds > 0) return `+${odds}`
    return odds.toString()
  }

  const handleRefresh = async () => {
    await refetch()
    toast({
      title: "Refreshed",
      description: "Top golfers list has been refreshed",
    })
  }

  if (isLoading || isFetching) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <div>Loading recommendations...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Top 10 Recommended</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="flex items-center gap-2 bg-[#1e1e23] border-none"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {isError ? (
          <div className="p-4 bg-red-900/30 rounded-lg text-center">
            <p className="text-red-400">{error instanceof Error ? error.message : String(error)}</p>
            <Button onClick={handleRefresh} className="mt-2" variant="outline">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {topGolfers.length > 0 ? (
              topGolfers.map((golfer, index) => (
                <div key={index} className="p-3 bg-[#1e1e23] rounded-lg flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <div className="font-medium">{formatPlayerName(golfer.name)}</div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        golfer.valueRating > 8
                          ? "bg-green-900/30 text-green-400"
                          : golfer.valueRating > 7
                            ? "bg-yellow-900/30 text-yellow-400"
                            : "bg-red-900/30 text-red-400"
                      }`}
                    >
                      {golfer.valueRating.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">{golfer.matchup}</span>
                    <span className="text-green-400">{formatOdds(golfer.odds)}</span>
                  </div>
                  <div className="text-xs text-gray-400 mb-1 capitalize">{golfer.bookmaker}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-1 bg-[#2a2a35] border-none hover:bg-[#34343f]"
                  >
                    <Plus size={14} className="mr-1" /> Add to Parlay
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400">No recommendations available. Try changing filters.</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
