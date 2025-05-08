"use client"

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Calendar, Loader2 } from "lucide-react";

// Supabase client initialization (assuming public env vars)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key missing for TopNavigation");
}
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

// Type definitions for better type safety
type EventType = 'main' | 'opposite' | 'euro' | null;

interface Tournament {
  event_id: number;
  event_name: string;
  start_date: string | null;
  end_date: string | null;
  tour?: string;
}

interface DisplayEvent {
  event_id: number;
  event_name: string;
  dates: string;
  eventType: EventType;
  tour?: string;
}

// Helper to format dates
function formatTournamentDates(startDateStr: string | null, endDateStr: string | null): string {
  if (!startDateStr || !endDateStr) return "Dates TBC";
  try {
    // Add time component to ensure correct date parsing regardless of timezone issues
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T00:00:00');

    const startMonth = startDate.toLocaleString('default', { month: 'short' });
    const endMonth = endDate.toLocaleString('default', { month: 'short' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const year = startDate.getFullYear(); // Assuming start/end in same year

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}, ${year}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }
  } catch (e) {
    console.error("Error formatting dates:", e);
    return "Invalid Dates";
  }
}

export default function TopNavigation() {
  const [activeEvents, setActiveEvents] = useState<DisplayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveEvents = async () => {
      setLoading(true);
      try {
        // Get this week's dates (Monday to Sunday)
        const currentDate = new Date();
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const monday = new Date(currentDate);
        monday.setDate(currentDate.getDate() - ((dayOfWeek + 6) % 7)); // Go back to the most recent Monday
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        const mondayStr = monday.toISOString().split('T')[0];
        const sundayStr = sunday.toISOString().split('T')[0];

        // Log the date range for debugging
        console.log(`Fetching tournaments from ${mondayStr} to ${sundayStr}`);

        // Fetch all tournaments happening this week with their event_id and tour for sorting
        const { data, error } = await supabase
          .from('tournaments')
          .select('event_id, event_name, start_date, end_date, tour')
          // Tournament starts before or on Sunday AND ends after or on Monday
          .lte('start_date', sundayStr)
          .gte('end_date', mondayStr)
          // Order first by tour (pga first), then by event_id
          .order('tour', { ascending: true })
          .order('event_id', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          console.log(`Found ${data.length} active tournaments`, data);
          
          // First, identify PGA Tour events (both main and opposite field)
          const pgaEvents = data.filter(t => t.tour === 'pga' || !t.tour);
          
          // Get lowest event ID for PGA events - this will be our main event
          let mainEventId = -1;
          if (pgaEvents.length > 0) {
            const lowestIdPgaEvent = pgaEvents.reduce((lowest, current) => 
              current.event_id < lowest.event_id ? current : lowest, pgaEvents[0]);
            mainEventId = lowestIdPgaEvent.event_id;
          }
          
          // Process the tournaments - determine event type based on tour and event ID
          let eventsWithTypes = data.map((tournament: Tournament) => {
            // Determine event type based on tour field and event ID
            let eventType: EventType = null;
            
            if (tournament.tour === 'euro') {
              // European Tour event
              eventType = 'euro';
            } else if (tournament.tour === 'opp') {
              // Explicitly labeled opposite field event
              eventType = 'opposite';
            } else if (tournament.tour === 'pga' || !tournament.tour) {
              // For PGA events, the lowest event ID is the main event
              if (tournament.event_id === mainEventId) {
                eventType = 'main';
              } else {
                eventType = 'opposite';
              }
            }
              
            return {
              event_id: tournament.event_id,
              event_name: tournament.event_name,
              dates: formatTournamentDates(tournament.start_date, tournament.end_date),
              eventType,
              tour: tournament.tour
            };
          });
          
          // Sort so main event is first, then opposite field, then European, then others
          eventsWithTypes.sort((a, b) => {
            // Main event goes first
            if (a.eventType === 'main') return -1;
            if (b.eventType === 'main') return 1;
            // Opposite field goes next
            if (a.eventType === 'opposite') return -1;
            if (b.eventType === 'opposite') return 1;
            // European tour goes after that
            if (a.eventType === 'euro') return -1;
            if (b.eventType === 'euro') return 1;
            // Otherwise, sort by event_id
            return a.event_id - b.event_id;
          });
          
          setActiveEvents(eventsWithTypes);
        } else {
          console.log("No active tournaments found for the current week.");
          setActiveEvents([]);
        }
      } catch (error: any) {
        console.error("Error fetching active tournaments:", error?.message || JSON.stringify(error));
        setActiveEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveEvents();
  }, []);

  return (
    <div className="top-navigation">
      <div className="flex items-center">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
        ) : (
          <div className="flex flex-col">
            {activeEvents.length > 0 ? (
              activeEvents.map((event, index) => (
                <div key={index} className="flex items-center mb-1 last:mb-0">
                  <span className="font-bold text-lg">{event.event_name}</span>
                  <span className="text-gray-400 text-sm ml-4">{event.dates}</span>
                  {event.eventType === 'main' && 
                    <span className="ml-2 text-xs px-2 py-0.5 bg-green-800 text-white rounded-full">Main</span>
                  }
                  {event.eventType === 'opposite' && 
                    <span className="ml-2 text-xs px-2 py-0.5 bg-blue-800 text-white rounded-full">Opposite</span>
                  }
                  {event.eventType === 'euro' && 
                    <span className="ml-2 text-xs px-2 py-0.5 bg-purple-800 text-white rounded-full">Euro</span>
                  }
                </div>
              ))
            ) : (
              <span className="font-bold text-lg">No Active Tournaments</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
