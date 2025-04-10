"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus, Calculator } from "lucide-react"

type ParlaySelection = {
  id: string
  matchupType: string
  group: string
  player: string
  odds: number
  valueRating: number
  confidenceScore: number
}

export default function ParlayBuilder({ matchupType }: { matchupType: string }) {
  const [selections, setSelections] = useState<ParlaySelection[]>([
    {
      id: "1",
      matchupType: "3ball",
      group: "Group 1",
      player: "Justin Thomas",
      odds: 250,
      valueRating: 9.1,
      confidenceScore: 88,
    },
  ])
  const [totalOdds, setTotalOdds] = useState(0)
  const [stake, setStake] = useState(100)
  const [potentialPayout, setPotentialPayout] = useState(0)

  const addSelection = () => {
    const newSelection: ParlaySelection = {
      id: Date.now().toString(),
      matchupType: matchupType,
      group: "",
      player: "",
      odds: 0,
      valueRating: 0,
      confidenceScore: 0,
    }
    setSelections([...selections, newSelection])
  }

  const removeSelection = (id: string) => {
    setSelections(selections.filter((selection) => selection.id !== id))
  }

  const updateSelection = (id: string, field: keyof ParlaySelection, value: string | number) => {
    setSelections(selections.map((selection) => (selection.id === id ? { ...selection, [field]: value } : selection)))
  }

  const calculateParlay = () => {
    const decimalOdds = selections.map((selection) => {
      const americanOdds = selection.odds
      return americanOdds > 0 ? americanOdds / 100 + 1 : 100 / Math.abs(americanOdds) + 1
    })

    const totalDecimalOdds = decimalOdds.reduce((acc, curr) => acc * curr, 1)
    const americanOdds =
      totalDecimalOdds > 2 ? ((totalDecimalOdds - 1) * 100).toFixed(0) : (-100 / (totalDecimalOdds - 1)).toFixed(0)

    setTotalOdds(Number(americanOdds))
    calculatePayout(stake, Number(americanOdds))
  }

  const calculatePayout = (stakeAmount: number, odds: number) => {
    let payout = stakeAmount
    if (odds > 0) {
      payout += (stakeAmount * odds) / 100
    } else {
      payout += (stakeAmount * 100) / Math.abs(odds)
    }
    setPotentialPayout(Number(payout.toFixed(2)))
  }

  const handleStakeChange = (value: number) => {
    setStake(value)
    calculatePayout(value, totalOdds)
  }

  // Calculate average value rating and confidence score
  const avgValueRating =
    selections.length > 0 ? selections.reduce((acc, curr) => acc + curr.valueRating, 0) / selections.length : 0

  const avgConfidenceScore =
    selections.length > 0 ? selections.reduce((acc, curr) => acc + curr.confidenceScore, 0) / selections.length : 0

  // Determine parlay confidence based on average scores
  let parlayConfidence = "Low"
  let confidencePercent = 35

  if (avgValueRating > 8 && avgConfidenceScore > 85) {
    parlayConfidence = "High"
    confidencePercent = 85
  } else if (avgValueRating > 7 && avgConfidenceScore > 75) {
    parlayConfidence = "Medium"
    confidencePercent = 65
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="glass-card md:col-span-2">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-4">Build Your Parlay</h2>
          <div className="space-y-4">
            {selections.map((selection, index) => (
              <div key={selection.id} className="p-4 bg-[#1e1e23] rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Selection {index + 1}</h3>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Group</label>
                    <Select
                      value={selection.group}
                      onValueChange={(value) => updateSelection(selection.id, "group", value)}
                    >
                      <SelectTrigger className="bg-[#2a2a35] border-none">
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Group 1">Group 1</SelectItem>
                        <SelectItem value="Group 2">Group 2</SelectItem>
                        <SelectItem value="Group 3">Group 3</SelectItem>
                        <SelectItem value="Group 4">Group 4</SelectItem>
                        <SelectItem value="Group 5">Group 5</SelectItem>
                        <SelectItem value="Group 6">Group 6</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Player</label>
                    <Select
                      value={selection.player}
                      onValueChange={(value) => {
                        updateSelection(selection.id, "player", value)
                        // Set default values based on player selection
                        if (value === "Rory McIlroy") {
                          updateSelection(selection.id, "odds", 200)
                          updateSelection(selection.id, "valueRating", 8.5)
                          updateSelection(selection.id, "confidenceScore", 95)
                        } else if (value === "Jon Rahm") {
                          updateSelection(selection.id, "odds", 150)
                          updateSelection(selection.id, "valueRating", 7.2)
                          updateSelection(selection.id, "confidenceScore", 93)
                        } else if (value === "Justin Thomas") {
                          updateSelection(selection.id, "odds", 250)
                          updateSelection(selection.id, "valueRating", 9.1)
                          updateSelection(selection.id, "confidenceScore", 88)
                        } else if (value === "Scottie Scheffler") {
                          updateSelection(selection.id, "odds", 120)
                          updateSelection(selection.id, "valueRating", 6.8)
                          updateSelection(selection.id, "confidenceScore", 91)
                        } else if (value === "Collin Morikawa") {
                          updateSelection(selection.id, "odds", 220)
                          updateSelection(selection.id, "valueRating", 8.5)
                          updateSelection(selection.id, "confidenceScore", 85)
                        } else if (value === "Xander Schauffele") {
                          updateSelection(selection.id, "odds", 250)
                          updateSelection(selection.id, "valueRating", 7.9)
                          updateSelection(selection.id, "confidenceScore", 82)
                        } else if (value === "Bryson DeChambeau") {
                          updateSelection(selection.id, "odds", 170)
                          updateSelection(selection.id, "valueRating", 8.3)
                          updateSelection(selection.id, "confidenceScore", 84)
                        } else if (value === "Viktor Hovland") {
                          updateSelection(selection.id, "odds", 200)
                          updateSelection(selection.id, "valueRating", 8.2)
                          updateSelection(selection.id, "confidenceScore", 83)
                        }
                      }}
                    >
                      <SelectTrigger className="bg-[#2a2a35] border-none">
                        <SelectValue placeholder="Select player" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Rory McIlroy">Rory McIlroy</SelectItem>
                        <SelectItem value="Jon Rahm">Jon Rahm</SelectItem>
                        <SelectItem value="Justin Thomas">Justin Thomas</SelectItem>
                        <SelectItem value="Scottie Scheffler">Scottie Scheffler</SelectItem>
                        <SelectItem value="Collin Morikawa">Collin Morikawa</SelectItem>
                        <SelectItem value="Xander Schauffele">Xander Schauffele</SelectItem>
                        <SelectItem value="Bryson DeChambeau">Bryson DeChambeau</SelectItem>
                        <SelectItem value="Viktor Hovland">Viktor Hovland</SelectItem>
                        <SelectItem value="Brooks Koepka">Brooks Koepka</SelectItem>
                        <SelectItem value="Jordan Spieth">Jordan Spieth</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Odds</label>
                    <Input
                      type="number"
                      placeholder="Odds"
                      value={selection.odds || ""}
                      onChange={(e) => updateSelection(selection.id, "odds", Number(e.target.value))}
                      className="bg-[#2a2a35] border-none"
                    />
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
            <Button onClick={addSelection} className="w-full bg-[#1e1e23] hover:bg-[#2a2a35] text-white border-none">
              <Plus size={16} className="mr-2" /> Add Selection
            </Button>
            <Button onClick={calculateParlay} className="w-full bg-primary hover:bg-primary/90 text-white">
              <Calculator size={16} className="mr-2" /> Calculate Parlay
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card highlight-card">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-4">Parlay Summary</h2>
          <div className="space-y-6">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Total Odds</label>
              <div className="text-4xl font-bold text-primary">
                {totalOdds > 0 ? `+${totalOdds}` : totalOdds || "—"}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Stake ($)</label>
              <Input
                type="number"
                value={stake}
                onChange={(e) => handleStakeChange(Number(e.target.value))}
                className="bg-[#2a2a35] border-none text-lg"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Potential Payout</label>
              <div className="text-4xl font-bold text-green-400">${potentialPayout.toLocaleString() || "—"}</div>
            </div>

            <div className="pt-4 border-t border-gray-800">
              <h3 className="font-medium mb-2">Parlay Confidence</h3>
              <div className="w-full bg-[#2a2a35] rounded-full h-2.5">
                <div className="bg-primary h-2.5 rounded-full" style={{ width: `${confidencePercent}%` }}></div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-400">Low</span>
                <span
                  className={`text-xs ${parlayConfidence === "Medium" ? "text-primary font-medium" : "text-gray-400"}`}
                >
                  Medium
                </span>
                <span
                  className={`text-xs ${parlayConfidence === "High" ? "text-primary font-medium" : "text-gray-400"}`}
                >
                  High
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-800">
              <h3 className="font-medium mb-3">Value Analysis</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Avg. Value Rating:</span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      avgValueRating > 8
                        ? "bg-green-900/30 text-green-400"
                        : avgValueRating > 7
                          ? "bg-yellow-900/30 text-yellow-400"
                          : "bg-red-900/30 text-red-400"
                    }`}
                  >
                    {avgValueRating.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Avg. Confidence:</span>
                  <span className="text-xs px-2 py-1 rounded bg-green-900/30 text-green-400">
                    {avgConfidenceScore.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
