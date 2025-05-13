"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { createParlay, addParlayPick } from "@/app/actions/matchups"
import { useRouter } from "next/navigation"
import { Send } from "lucide-react"
import { useCreateParlayMutation } from '@/hooks/use-create-parlay-mutation'
import { useCreateParlayPickMutation } from '@/hooks/use-create-parlay-pick-mutation'

type ParlayProps = {
  selections: Array<{
    id: string
    odds: number
    player: string
    matchupId?: number
    eventName?: string
    roundNum?: number
    matchupType: string
  }>
  userId?: string // TODO: Replace with real user ID from auth
}

export default function ParlaySummary({ selections, userId = 'demo-user-id' }: ParlayProps) {
  const router = useRouter()
  const [stake, setStake] = useState(10)
  const [totalOdds, setTotalOdds] = useState(0)
  const [payout, setPayout] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const createParlayMutation = useCreateParlayMutation(userId)
  
  // Function to submit the parlay to the database
  const submitParlay = async () => {
    if (selections.length < 2) {
      toast({
        title: "Cannot Submit Empty Parlay",
        description: "Add at least 2 selections to your parlay.",
        variant: "destructive"
      })
      return
    }
    setSubmitting(true)
    try {
      const parlayName = `${selections[0].matchupType.toUpperCase()} Parlay - $${stake}`
      // Create the parlay
      const parlay = await createParlayMutation.mutateAsync({ name: parlayName, user_id: userId })
      // Add each pick
      for (const selection of selections) {
        // Use the mutation hook for picks
        // You may want to batch or parallelize these in the future
        await fetch('/api/parlay-picks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parlay_id: parlay.id,
            picked_player_dg_id: Number(selection.id) || 0,
            picked_player_name: selection.player,
            matchup_id: selection.matchupId,
            event_name: selection.eventName,
            round_num: selection.roundNum || 2
          })
        })
      }
      toast({
        title: "Parlay Submitted",
        description: `Your parlay has been saved with ${selections.length} selections.`,
      })
      router.push('/parlays')
    } catch (err) {
      console.error("Error submitting parlay:", err)
      toast({
        title: "Error Submitting Parlay",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }
  
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
          
          {/* Submit button */}
          <Button 
            onClick={submitParlay} 
            disabled={submitting || selections.length === 0}
            className="w-full bg-primary hover:bg-primary/90 text-white mt-4"
          >
            {submitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </>
            ) : (
              <>
                <Send size={16} className="mr-2" /> Submit Parlay
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}