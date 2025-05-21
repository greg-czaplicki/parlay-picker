"use client"

<<<<<<< HEAD
import React, { createContext, useContext, useState, ReactNode, useEffect } from "react"
=======
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32

export type ParlaySelection = {
  id: string
  matchupType: string
  group: string
  player: string
<<<<<<< HEAD
  matchupId?: string
=======
  matchupId?: number
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
  eventName?: string
  roundNum?: number
  odds: number
  valueRating: number
  confidenceScore: number
}

interface ParlayContextType {
<<<<<<< HEAD
  // UI state for building a new parlay
  selections: ParlaySelection[]
  addSelection: (selection: Partial<ParlaySelection>) => void
  removeSelection: (id: string) => void
  updateSelection: (id: string, field: keyof ParlaySelection, value: string | number) => void
  clearSelections: () => void

  // UI state for stake and payout preview
  stake: number
  setStake: (amount: number) => void
  totalOdds: number
  potentialPayout: number

  // UI state for modals, selected parlay, etc.
  selectedParlayUuid: string | null
  setSelectedParlayUuid: (id: string | null) => void
  isParlayModalOpen: boolean
  setParlayModalOpen: (open: boolean) => void
=======
  // State
  selections: ParlaySelection[]
  totalOdds: number
  stake: number
  potentialPayout: number
  
  // Methods
  addSelection: (selection: Partial<ParlaySelection>) => void
  removeSelection: (id: string) => void
  updateSelection: (id: string, field: keyof ParlaySelection, value: string | number) => void
  calculateParlay: () => void
  setStake: (amount: number) => void
  
  // Derived values
  avgValueRating: number
  avgConfidenceScore: number
  parlayConfidence: "Low" | "Medium" | "High"
  confidencePercent: number
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
}

export const ParlayContext = createContext<ParlayContextType | undefined>(undefined)

export function ParlayProvider({ children }: { children: ReactNode }) {
<<<<<<< HEAD
  // Ephemeral UI state only (no persistent data)
  const [selections, setSelections] = useState<ParlaySelection[]>([])
  const [totalOdds, setTotalOdds] = useState(0)
  const [stake, setStake] = useState(10)
  const [potentialPayout, setPotentialPayout] = useState(0)
  const [selectedParlayUuid, setSelectedParlayUuid] = useState<string | null>(null)
  const [isParlayModalOpen, setParlayModalOpen] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('parlaySelections') : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved).map((s: any) => ({ ...s, id: String(s.id) }));
        setSelections(parsed);
      } catch {}
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('parlaySelections', JSON.stringify(selections));
    }
  }, [selections]);

  // Add selection to parlay
  const addSelection = (newSelection: Partial<ParlaySelection>) => {
    if (typeof newSelection.id !== 'string' || newSelection.id.length === 0) {
      // Only allow adding selections with a valid uuid as id
      return;
    }
    if (newSelection.player && newSelection.player.trim() !== "" &&
        selections.some(s => s.player.toLowerCase() === newSelection.player?.toLowerCase())) {
      return
    }
    const updatedSelections = [...selections, {
      id: newSelection.id,
=======
  // Initialize with empty selections - no defaults
  const [selections, setSelections] = useState<ParlaySelection[]>([])
  const [totalOdds, setTotalOdds] = useState(0)
  const [stake, setStake] = useState(10) // Default to $10 stake instead of $100
  const [potentialPayout, setPotentialPayout] = useState(0)

  // Add selection to parlay
  const addSelection = (newSelection: Partial<ParlaySelection>) => {
    console.log("Adding selection:", newSelection)
    
    // Generate ID if not provided
    const id = newSelection.id || Date.now().toString()
    
    // Check if this player is already in the parlay to avoid duplicates
    if (newSelection.player && newSelection.player.trim() !== "" && 
        selections.some(s => s.player.toLowerCase() === newSelection.player?.toLowerCase())) {
      console.log(`Player ${newSelection.player} already exists in parlay`)
      return
    }
    
    // Create default values for player data
    const updatedSelections = [...selections, {
      id,
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
      matchupType: newSelection.matchupType || "3ball",
      group: newSelection.group || "",
      player: newSelection.player || "",
      odds: newSelection.odds || 0,
<<<<<<< HEAD
      valueRating: newSelection.valueRating || 7.5,
      confidenceScore: newSelection.confidenceScore || 75,
=======
      valueRating: newSelection.valueRating || 7.5, // Default to reasonable values
      confidenceScore: newSelection.confidenceScore || 75, // Default to reasonable values
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
      matchupId: newSelection.matchupId,
      eventName: newSelection.eventName,
      roundNum: newSelection.roundNum
    } as ParlaySelection]
<<<<<<< HEAD
    setSelections(updatedSelections)
    recalculate(updatedSelections, stake)
  }

=======
    
    console.log("Current selections:", selections)
    console.log("New selections array:", updatedSelections)
    
    setSelections(updatedSelections)
  }
  
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
  // Remove selection from parlay
  const removeSelection = (id: string) => {
    const updatedSelections = selections.filter((selection) => selection.id !== id)
    setSelections(updatedSelections)
<<<<<<< HEAD
    recalculate(updatedSelections, stake)
  }

  // Update a selection field
  const updateSelection = (id: string, field: keyof ParlaySelection, value: string | number) => {
    const updatedSelections = selections.map((selection) =>
      (selection.id === id ? { ...selection, [field]: value } : selection)
    )
    setSelections(updatedSelections)
    recalculate(updatedSelections, stake)
  }

  // Clear all selections
  const clearSelections = () => {
    setSelections([])
    setTotalOdds(0)
    setPotentialPayout(0)
  }

  // Calculate total odds and potential payout
  const recalculate = (currentSelections: ParlaySelection[], currentStake: number) => {
    if (currentSelections.length === 0) {
      setTotalOdds(0)
      setPotentialPayout(0)
      return
    }
    try {
      const decimalOdds = currentSelections.map((selection) => {
        const americanOdds = Number(selection.odds)
        if (isNaN(americanOdds) || americanOdds === 0) return 1
        return americanOdds > 0
          ? (americanOdds / 100) + 1
          : (100 / Math.abs(americanOdds)) + 1
      })
      const totalDecimalOdds = decimalOdds.reduce((acc, curr) => acc * curr, 1)
      let americanOdds
      if (totalDecimalOdds >= 2) {
        americanOdds = Math.round((totalDecimalOdds - 1) * 100)
      } else {
        americanOdds = Math.round(-100 / (totalDecimalOdds - 1))
      }
      setTotalOdds(americanOdds)
      const totalPayout = Number(currentStake) * totalDecimalOdds
      setPotentialPayout(Number(totalPayout.toFixed(2)))
    } catch {
      setTotalOdds(0)
      setPotentialPayout(0)
    }
  }

  // Update payout when stake changes
  const handleSetStake = (amount: number) => {
    setStake(amount)
    recalculate(selections, amount)
  }

  // All persistent data (parlays, picks, mutations) is now handled by React Query hooks.

  return (
    <ParlayContext.Provider value={{
      selections,
      addSelection,
      removeSelection,
      updateSelection,
      clearSelections,
      stake,
      setStake: handleSetStake,
      totalOdds,
      potentialPayout,
      selectedParlayUuid,
      setSelectedParlayUuid,
      isParlayModalOpen,
      setParlayModalOpen,
=======
    
    // Calculate new parlay odds after a short delay to ensure state is updated
    setTimeout(() => calculateParlay(), 0)
  }
  
  // Update a selection field
  const updateSelection = (id: string, field: keyof ParlaySelection, value: string | number) => {
    const updatedSelections = selections.map((selection) => 
      (selection.id === id ? { ...selection, [field]: value } : selection)
    )
    setSelections(updatedSelections)
    
    // If updating odds or another field that affects calculation, recalculate
    if (field === 'odds') {
      setTimeout(() => calculateParlay(), 0)
    }
  }
  
  // Calculate total odds and potential payout
  const calculateParlay = () => {
    console.log("🔄 calculateParlay called with", selections.length, "selections")
    
    if (selections.length === 0) {
      console.log("No selections, resetting odds and payout")
      setTotalOdds(0);
      setPotentialPayout(0);
      return;
    }
    
    try {
      console.log("🧮 Calculating parlay with selections:", selections)
      // Convert American odds to decimal odds
      const decimalOdds = selections.map((selection) => {
        const americanOdds = Number(selection.odds); // Ensure it's a number
        // Skip invalid odds
        if (isNaN(americanOdds) || americanOdds === 0) return 1;
        
        return americanOdds > 0 
          ? (americanOdds / 100) + 1 
          : (100 / Math.abs(americanOdds)) + 1;
      });
      
      // Log for debugging
      console.log("American odds:", selections.map(s => s.odds));
      console.log("Decimal odds:", decimalOdds);
      
      // Multiply all decimal odds together to get total decimal odds
      const totalDecimalOdds = decimalOdds.reduce((acc, curr) => acc * curr, 1);
      console.log("Total decimal odds:", totalDecimalOdds);
      
      // Convert total decimal odds back to American odds
      // For parlays, we make sure all positive odds are properly converted
      let americanOdds;
      if (totalDecimalOdds >= 2) {
        americanOdds = Math.round((totalDecimalOdds - 1) * 100);
      } else {
        americanOdds = Math.round(-100 / (totalDecimalOdds - 1));
      }
      
      console.log("Total American odds:", americanOdds);
      setTotalOdds(americanOdds);
      
      // Calculate payout directly using the decimal odds
      // Note: This includes the original stake (same as FanDuel display)
      const totalPayout = Number(stake) * totalDecimalOdds;
      console.log("Stake:", stake);
      console.log("Total payout:", totalPayout);
      setPotentialPayout(Number(totalPayout.toFixed(2)));
    } catch (error) {
      console.error("Error calculating parlay:", error);
      // Set defaults on error
      setTotalOdds(0);
      setPotentialPayout(0);
    }
  }
  
  // Calculate potential payout (this function is kept for backward compatibility)
  const calculatePayout = (stakeAmount: number, odds: number) => {
    // Convert American odds to decimal odds
    const decimalOdds = odds > 0 
      ? (odds / 100) + 1 
      : (100 / Math.abs(odds)) + 1;
    
    // Calculate payout
    const payout = stakeAmount * decimalOdds;
    setPotentialPayout(Number(payout.toFixed(2)));
  }
  
  // Handle stake change
  const handleStakeChange = (value: number) => {
    // Make sure we're dealing with a number
    const numericValue = Number(value);
    console.log("handleStakeChange called with value:", value, "converted to:", numericValue);
    
    // Check for valid value
    if (isNaN(numericValue) || numericValue < 0) {
      console.log("Invalid stake value, using 0");
      setStake(0);
    } else {
      setStake(numericValue);
    }
    
    // Add a short delay to ensure state is updated before calculation
    setTimeout(() => calculateParlay(), 10);
  }
  
  // Automatically recalculate the parlay when selections change
  useEffect(() => {
    console.log("Selections changed - recalculating parlay with", selections.length, "selections")
    // Force calculator to run in the next tick to ensure state is updated
    setTimeout(() => {
      if (selections.length > 0) {
        calculateParlay()
      } else {
        setTotalOdds(0)
        setPotentialPayout(0)
      }
    }, 50)
  }, [selections]) // Re-run whenever selections change
  
  // Calculate average value rating and confidence score
  const avgValueRating =
    selections.length > 0 ? selections.reduce((acc, curr) => acc + curr.valueRating, 0) / selections.length : 0

  const avgConfidenceScore =
    selections.length > 0 ? selections.reduce((acc, curr) => acc + curr.confidenceScore, 0) / selections.length : 0

  // Determine parlay confidence based on average scores
  let parlayConfidence: "Low" | "Medium" | "High" = "Low"
  let confidencePercent = 35

  if (avgValueRating > 8 && avgConfidenceScore > 85) {
    parlayConfidence = "High"
    confidencePercent = 85
  } else if (avgValueRating > 7 && avgConfidenceScore > 75) {
    parlayConfidence = "Medium"
    confidencePercent = 65
  }
  
  return (
    <ParlayContext.Provider value={{
      selections,
      totalOdds,
      stake, 
      potentialPayout,
      addSelection,
      removeSelection,
      updateSelection,
      calculateParlay,
      setStake: handleStakeChange,
      avgValueRating,
      avgConfidenceScore,
      parlayConfidence,
      confidencePercent
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
    }}>
      {children}
    </ParlayContext.Provider>
  )
}

<<<<<<< HEAD
export function useParlayContext() {
  const ctx = useContext(ParlayContext)
  if (!ctx) throw new Error("useParlayContext must be used within a ParlayProvider")
  return ctx
=======
// Custom hook for easier context consumption
export function useParlay() {
  const context = useContext(ParlayContext)
  if (context === undefined) {
    throw new Error('useParlay must be used within a ParlayProvider')
  }
  return context
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
}