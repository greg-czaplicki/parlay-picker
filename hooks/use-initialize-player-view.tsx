"use client"

import { useState, useEffect } from "react"
import { useActiveEvents } from "@/lib/queries"

interface InitializePlayerViewResult {
  dataView: "season" | "tournament"
  setDataView: (view: "season" | "tournament") => void
  selectedEventId: number | null
  setSelectedEventId: (id: number | null) => void
  eventOptions: Array<{ dg_id: number, name: string }>
  eventsLoading: boolean
  currentEventEnded: boolean | null
}

/**
 * Custom hook to initialize and manage player table view state
 * This hook handles the logic for:
 * 1. Fetching active events via React Query
 * 2. Setting the appropriate default view (season or tournament)
 * 3. Initializing the selected event only once when data is loaded
 * 
 * This keeps the initialization logic separate from the UI component
 */
export function useInitializePlayerView(): InitializePlayerViewResult {
  const [dataView, setDataView] = useState<"season" | "tournament">("season")
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [hasSetInitialEvent, setHasSetInitialEvent] = useState(false)
  
  // Use React Query to fetch active events
  const { data: eventOptions = [], isLoading: eventsLoading } = useActiveEvents()
  
  // Determine if an event is ongoing based on query results
  const currentEventEnded = eventsLoading ? null : eventOptions.length === 0
  
  // Set default view based on active events - only on initial load
  useEffect(() => {
    if (!eventsLoading && !hasSetInitialEvent) {
      if (eventOptions.length > 0) {
        setDataView('tournament')
        // Only set initial event if there hasn't been a selection yet
        setSelectedEventId(eventOptions[0].dg_id)
      } else {
        setDataView('season')
      }
      setHasSetInitialEvent(true)
    }
  }, [eventsLoading, eventOptions, hasSetInitialEvent]);

  return {
    dataView,
    setDataView,
    selectedEventId,
    setSelectedEventId,
    eventOptions,
    eventsLoading,
    currentEventEnded
  }
}