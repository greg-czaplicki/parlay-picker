"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"

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
  selectedParlayId: number | null
  setSelectedParlayId: (id: number | null) => void
  isParlayModalOpen: boolean
  setParlayModalOpen: (open: boolean) => void
}

export const ParlayContext = createContext<ParlayContextType | undefined>(undefined)

export function ParlayProvider({ children }: { children: ReactNode }) {
  // Ephemeral UI state only (no persistent data)
  const [selections, setSelections] = useState<ParlaySelection[]>([])
  const [totalOdds, setTotalOdds] = useState(0)
  const [stake, setStake] = useState(10)
  const [potentialPayout, setPotentialPayout] = useState(0)
  const [selectedParlayId, setSelectedParlayId] = useState<number | null>(null)
  const [isParlayModalOpen, setParlayModalOpen] = useState(false)

  // Add selection to parlay
  const addSelection = (newSelection: Partial<ParlaySelection>) => {
    const id = newSelection.id || Date.now().toString()
    if (newSelection.player && newSelection.player.trim() !== "" &&
        selections.some(s => s.player.toLowerCase() === newSelection.player?.toLowerCase())) {
      return
    }
    const updatedSelections = [...selections, {
      id,
      matchupType: newSelection.matchupType || "3ball",
      group: newSelection.group || "",
      player: newSelection.player || "",
      odds: newSelection.odds || 0,
      valueRating: newSelection.valueRating || 7.5,
      confidenceScore: newSelection.confidenceScore || 75,
      matchupId: newSelection.matchupId,
      eventName: newSelection.eventName,
      roundNum: newSelection.roundNum
    } as ParlaySelection]
    setSelections(updatedSelections)
    recalculate(updatedSelections, stake)
  }

  // Remove selection from parlay
  const removeSelection = (id: string) => {
    const updatedSelections = selections.filter((selection) => selection.id !== id)
    setSelections(updatedSelections)
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
      selectedParlayId,
      setSelectedParlayId,
      isParlayModalOpen,
      setParlayModalOpen,
    }}>
      {children}
    </ParlayContext.Provider>
  )
}

export function useParlayContext() {
  const ctx = useContext(ParlayContext)
  if (!ctx) throw new Error("useParlayContext must be used within a ParlayProvider")
  return ctx
}