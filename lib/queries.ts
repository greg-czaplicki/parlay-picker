"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@supabase/supabase-js"

// Get supabase client
const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase credentials not found")
  }
  
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Query to fetch active events (tournaments happening today)
export function useActiveEvents() {
  return useQuery({
    queryKey: ["activeEvents"],
    queryFn: async () => {
      const supabase = getSupabase()
      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('tournaments_v2')
        .select('event_id, event_name, start_date, end_date')
        .lte('start_date', today) // Started before or on today
        .gte('end_date', today)   // Ends after or on today
        .order('start_date', { ascending: true })
      
      if (error) throw error
      
      return data || []
    }
  })
}

// Query to fetch the next scheduled event (upcoming)
export function useUpcomingEvent() {
  return useQuery({
    queryKey: ["upcomingEvent"],
    queryFn: async () => {
      const supabase = getSupabase()
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('tournaments_v2')
        .select('event_id, event_name, start_date, end_date')
        .gt('start_date', today)
        .order('start_date', { ascending: true })
        .limit(1)
      if (error) throw error
      return data?.[0] || null
    }
  })
}

// Query to fetch the most recent completed event
export function useLastCompletedEvent() {
  return useQuery({
    queryKey: ["lastCompletedEvent"],
    queryFn: async () => {
      const supabase = getSupabase()
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('tournaments_v2')
        .select('event_id, event_name, start_date, end_date')
        .lt('end_date', today)
        .order('end_date', { ascending: false })
        .limit(1)
      if (error) throw error
      return data?.[0] || null
    }
  })
}