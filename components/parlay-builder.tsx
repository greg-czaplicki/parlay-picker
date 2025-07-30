"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus, Calculator } from "lucide-react"
import { useParlayContext } from "@/context/ParlayContext"
import ParlaySummary from "./parlay-summary"
import { Button } from "@/components/ui/button"

export default function ParlayBuilder({ matchupType, roundNum }: { matchupType: string, roundNum?: number | null }) {
  const {
    selections,
    addSelection,
    removeSelection,
    updateSelection,
    totalOdds,
    stake: contextStake,
    setStake,
    potentialPayout,
  } = useParlayContext()

  // Sort selections by tee time for display (earliest first)
  const sortedSelections = [...selections].sort((a, b) => {
    // If both have tee times, sort by tee time
    if (a.teeTime && b.teeTime) {
      return new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime()
    }
    // If only one has a tee time, put it first
    if (a.teeTime && !b.teeTime) return -1
    if (!a.teeTime && b.teeTime) return 1
    // If neither has a tee time, maintain original order
    return 0
  })
  
  // Local state for stake input
  const [localStake, setLocalStake] = useState(contextStake)
  
  // Update local stake when context stake changes
  useEffect(() => {
    setLocalStake(contextStake)
  }, [contextStake])

  const formatAmericanOdds = (odds: number) => {
    if (isNaN(odds)) return '-';
    if (odds >= 2) return `+${Math.round((odds - 1) * 100)}`;
    if (odds > 1) return `${Math.round(-100 / (odds - 1))}`;
    // If already American odds, just show as is
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="glass-card md:col-span-2 p-6">
          <h2 className="text-xl font-bold mb-4">Build Your Parlay</h2>
          <div className="space-y-4">
            {sortedSelections.map((selection, index) => (
              <div key={selection.id} className="p-4 bg-[#1e1e23] rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium">Selection {index + 1}</h3>
                    {selection.eventName && (
                      <span className="text-xs text-gray-400">Event: {selection.eventName}</span>
                    )}
                    {selection.teeTime && (
                      <div className="text-xs text-gray-400">
                        Tee Time: {new Date(selection.teeTime).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          timeZoneName: 'short'
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-[#2a2a35]">
                      {selection.matchupType === "2ball" ? "2-Ball" : "3-Ball"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSelection(selection.id)}
                      className="h-8 w-8 text-gray-400 hover:text-white hover:bg-[#2a2a35]"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Player</label>
                    <div className="bg-[#2a2a35] px-3 py-2 rounded text-sm">
                      {selection.player}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Odds</label>
                    <div className="bg-[#2a2a35] px-3 py-2 rounded text-sm">
                      {formatAmericanOdds(selection.odds)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Value Rating:</span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        selection.valueRating > 8
                          ? "bg-green-900/30 text-green-400"
                          : selection.valueRating > 7
                            ? "bg-yellow-900/30 text-yellow-400"
                            : "bg-red-900/30 text-red-400"
                      }`}
                    >
                      {selection.valueRating.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Confidence:</span>
                    <span className="text-xs px-2 py-1 rounded bg-green-900/30 text-green-400">
                      {selection.confidenceScore}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
      </div>

      <ParlaySummary selections={selections} />
    </div>
  )
}
