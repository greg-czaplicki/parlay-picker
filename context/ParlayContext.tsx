"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"

export type ParlaySelection = {
  id: string
  matchupType: string
  group: string
  player: string
  matchupId?: number
  eventName?: string
  roundNum?: number
  odds: number
  valueRating: number
  confidenceScore: number
}

interface ParlayContextType {
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
}

export const ParlayContext = createContext<ParlayContextType | undefined>(undefined)

export function ParlayProvider({ children }: { children: ReactNode }) {
  // Initialize with empty selections - no defaults
  const [selections, setSelections] = useState<ParlaySelection[]>([])
  const [totalOdds, setTotalOdds] = useState(0)
  const [stake, setStake] = useState(10) // Default to $10 stake instead of $100
  const [potentialPayout, setPotentialPayout] = useState(0)

  // Add selection to parlay
  const addSelection = (newSelection: Partial<ParlaySelection>) => {
    // Generate ID if not provided
    const id = newSelection.id || Date.now().toString()
    
    // Check if this player is already in the parlay to avoid duplicates
    if (newSelection.player && newSelection.player.trim() !== "" && 
        selections.some(s => s.player.toLowerCase() === newSelection.player?.toLowerCase())) {
      return
    }
    
    // Create default values for player data
    const updatedSelections = [...selections, {
      id,
      matchupType: newSelection.matchupType || "3ball",
      group: newSelection.group || "",
      player: newSelection.player || "",
      odds: newSelection.odds || 0,
      valueRating: newSelection.valueRating || 7.5, // Default to reasonable values
      confidenceScore: newSelection.confidenceScore || 75, // Default to reasonable values
      matchupId: newSelection.matchupId,
      eventName: newSelection.eventName,
      roundNum: newSelection.roundNum
    } as ParlaySelection]
    
    setSelections(updatedSelections)
  }
  
  // Remove selection from parlay
  const removeSelection = (id: string) => {
    const updatedSelections = selections.filter((selection) => selection.id !== id)
    setSelections(updatedSelections)
    
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
    if (selections.length === 0) {
      setTotalOdds(0);
      setPotentialPayout(0);
      return;
    }
    
    try {
      // Convert American odds to decimal odds
      const decimalOdds = selections.map((selection) => {
        const americanOdds = Number(selection.odds); // Ensure it's a number
        // Skip invalid odds
        if (isNaN(americanOdds) || americanOdds === 0) return 1;
        
        return americanOdds > 0 
          ? (americanOdds / 100) + 1 
          : (100 / Math.abs(americanOdds)) + 1;
      });
      
      // Multiply all decimal odds together to get total decimal odds
      const totalDecimalOdds = decimalOdds.reduce((acc, curr) => acc * curr, 1);
      
      // Convert total decimal odds back to American odds
      // For parlays, we make sure all positive odds are properly converted
      let americanOdds;
      if (totalDecimalOdds >= 2) {
        americanOdds = Math.round((totalDecimalOdds - 1) * 100);
      } else {
        americanOdds = Math.round(-100 / (totalDecimalOdds - 1));
      }
      
      setTotalOdds(americanOdds);
      
      // Calculate payout directly using the decimal odds
      // Note: This includes the original stake (same as FanDuel display)
      const totalPayout = Number(stake) * totalDecimalOdds;
      setPotentialPayout(Number(totalPayout.toFixed(2)));
    } catch (error) {
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
    
    // Check for valid value
    if (isNaN(numericValue) || numericValue < 0) {
      setStake(0);
    } else {
      setStake(numericValue);
    }
    
    // Add a short delay to ensure state is updated before calculation
    setTimeout(() => calculateParlay(), 10);
  }
  
  // Automatically recalculate the parlay when selections change
  useEffect(() => {
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
    }}>
      {children}
    </ParlayContext.Provider>
  )
}

// Custom hook for easier context consumption
export function useParlay() {
  const context = useContext(ParlayContext)
  if (context === undefined) {
    throw new Error('useParlay must be used within a ParlayProvider')
  }
  return context
}