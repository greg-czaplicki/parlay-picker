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
const supabase = createClient(supabaseUrl!, supabaseAnonKey!); // Or handle nulls

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
  const [tournamentName, setTournamentName] = useState<string | null>(null);
  const [tournamentDates, setTournamentDates] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestTournament = async () => {
      setLoading(true);
      try {
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('tournaments')
          .select('event_name, start_date, end_date')
          // Filter for tournaments ending on or after today
          .gte('end_date', today)
          // Order by start date ascending to get the next one
          .order('start_date', { ascending: true })
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          const nextTournament = data[0];
          setTournamentName(nextTournament.event_name);
          setTournamentDates(formatTournamentDates(nextTournament.start_date, nextTournament.end_date));
        } else {
          // Handle case where no upcoming tournaments are found (e.g., end of season)
          // Maybe fetch the absolute last completed one as a fallback?
          console.log("No upcoming tournaments found. Fetching last completed...");
           const { data: lastData, error: lastError } = await supabase
            .from('tournaments')
            .select('event_name, start_date, end_date')
            .order('start_date', { ascending: false })
            .limit(1);

           if(lastData && lastData.length > 0) {
              const lastTournament = lastData[0];
              setTournamentName(lastTournament.event_name + " (Last Completed)");
              setTournamentDates(formatTournamentDates(lastTournament.start_date, lastTournament.end_date));
           } else {
              setTournamentName("No Tournament Data");
              setTournamentDates("");
           }
        }
      } catch (error: any) {
        console.error("Error fetching latest/next tournament:", error?.message || JSON.stringify(error));
        setTournamentName("Error Loading Tournament");
        setTournamentDates("");
      } finally {
        setLoading(false);
      }
    };

    fetchLatestTournament();
  }, []);

  return (
    <div className="top-navigation">
      <div className="flex items-center">
        {loading ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
        ) : (
            <>
                <span className="font-bold text-lg">{tournamentName || "Event Name"}</span>
                {tournamentDates && <span className="text-gray-400 text-sm ml-4">{tournamentDates}</span>}
            </>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="text-gray-400" size={18} />
          <span className="text-gray-400 text-sm">Tournament Week</span>
        </div>
      </div>
    </div>
  )
}
