"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type ParlayProps = {
  selections: Array<{
    id: string
    odds: number
    player: string
  }>
}

export default function ParlaySummary({ selections }: ParlayProps) {
  const [stake, setStake] = useState(10)
  const [totalOdds, setTotalOdds] = useState(0)
  const [payout, setPayout] = useState(0)
  
  // Calculate parlay odds and payout whenever selections or stake changes
  useEffect(() => {
    if (selections.length === 0) {
      setTotalOdds(0)
      setPayout(0)
      return
    }
    
    // Convert American odds to decimal
    const decimalOdds = selections.map(selection => {
      const odds = Number(selection.odds)
      return odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1
    })
    
    // Multiply to get total odds
    const totalDecimal = decimalOdds.reduce((acc, curr) => acc * curr, 1)
    
    // Convert back to American
    const americanOdds = totalDecimal >= 2
      ? Math.round((totalDecimal - 1) * 100)
      : Math.round(-100 / (totalDecimal - 1))
    
    // Calculate payout
    const totalPayout = stake * totalDecimal
    
    // Update state
    setTotalOdds(americanOdds)
    setPayout(Number(totalPayout.toFixed(2)))
  }, [selections, stake])
  
  return (
    <Card className="glass-card highlight-card">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold mb-4">Parlay Summary</h2>
        <div className="space-y-6">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Selections</label>
            <div className="text-sm">
              {selections.map((s, i) => (
                <div key={s.id} className="py-1">
                  {s.player} <span className="float-right text-primary">{s.odds > 0 ? `+${s.odds}` : s.odds}</span>
                </div>
              ))}
              {selections.length === 0 && <div className="text-gray-400">No selections yet</div>}
            </div>
          </div>
          
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
              min="1"
              step="1"
              value={stake}
              onChange={(e) => {
                const value = e.target.valueAsNumber
                setStake(isNaN(value) ? 0 : value)
              }}
              className="bg-[#2a2a35] border-none text-lg"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">Potential Payout</label>
            <div className="text-4xl font-bold text-green-400">${payout.toFixed(2)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}