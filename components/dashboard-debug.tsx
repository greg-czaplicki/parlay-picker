"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase"

export default function DashboardDebug() {
  const [events, setEvents] = useState<any[]>([])
  const [matchups2Ball, setMatchups2Ball] = useState<any[]>([])
  const [matchups3Ball, setMatchups3Ball] = useState<any[]>([])
  const [directMatches, setDirectMatches] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  async function runTest() {
    setLoading(true)
    setError(null)
    
    try {
      // Step 1: Fetch current week events
      console.log("Step 1: Fetching current events")
      const supabase = createBrowserClient()
      const today = new Date()
      const mondayStr = new Date(today.setDate(today.getDate() - today.getDay() + 1)).toISOString().split('T')[0]
      const sundayStr = new Date(today.setDate(today.getDate() + 6)).toISOString().split('T')[0]
      
      const { data: eventsData, error: eventsError } = await supabase
        .from("tournaments")
        .select("event_id, event_name, start_date, end_date")
        .lte("start_date", sundayStr)
        .gte("end_date", mondayStr)
      
      if (eventsError) throw new Error(`Error fetching events: ${eventsError.message}`)
      setEvents(eventsData || [])
      console.log(`Found ${eventsData?.length || 0} events this week`, eventsData)
      
      // Step 2: Try direct database queries for these events
      const directResults = {}
      
      for (const event of eventsData || []) {
        console.log(`Step 2: Testing direct queries for event ${event.event_name} (${event.event_id})`)
        
        // 2a. Try string comparison
        const { data: stringMatch, error: stringError } = await supabase
          .from("latest_two_ball_matchups")
          .select("id")
          .eq("event_id", event.event_id.toString())
          .limit(1)
        
        // 2b. Try numeric comparison
        const { data: numericMatch, error: numericError } = await supabase
          .from("latest_two_ball_matchups")
          .select("id")
          .eq("event_id", parseInt(event.event_id.toString(), 10))
          .limit(1)
          
        // 2c. Try name match
        const { data: nameMatch, error: nameError } = await supabase
          .from("latest_two_ball_matchups")
          .select("id")
          .ilike("event_name", `%${event.event_name}%`)
          .limit(1)
          
        directResults[event.event_id] = {
          stringMatch: {
            success: !stringError,
            matches: stringMatch?.length || 0
          },
          numericMatch: {
            success: !numericError,
            matches: numericMatch?.length || 0
          },
          nameMatch: {
            success: !nameError,
            matches: nameMatch?.length || 0
          }
        }
      }
      setDirectMatches(directResults)
      
      // Step 3: Fetch matchups from our API endpoint
      if (eventsData && eventsData.length > 0) {
        for (const event of eventsData) {
          console.log(`Step 3: Testing API endpoint for event ${event.event_name} (${event.event_id})`)
          
          // 3a. Fetch 2-ball matchups
          const response2Ball = await fetch(`/api/matchups/2ball?eventId=${event.event_id}`)
          const data2Ball = await response2Ball.json()
          
          console.log(`2-ball API response for ${event.event_name}:`, {
            success: data2Ball.success,
            matchupCount: data2Ball.matchups?.length || 0
          })
          
          if (data2Ball.success) {
            setMatchups2Ball(prevMatchups => [
              ...prevMatchups,
              {
                event_id: event.event_id,
                event_name: event.event_name,
                count: data2Ball.matchups?.length || 0,
                sample: data2Ball.matchups?.slice(0, 2) || []
              }
            ])
          }
          
          // 3b. Fetch 3-ball matchups
          const response3Ball = await fetch(`/api/matchups/3ball?eventId=${event.event_id}`)
          const data3Ball = await response3Ball.json()
          
          console.log(`3-ball API response for ${event.event_name}:`, {
            success: data3Ball.success,
            matchupCount: data3Ball.matchups?.length || 0
          })
          
          if (data3Ball.success) {
            setMatchups3Ball(prevMatchups => [
              ...prevMatchups,
              {
                event_id: event.event_id,
                event_name: event.event_name,
                count: data3Ball.matchups?.length || 0,
                sample: data3Ball.matchups?.slice(0, 2) || []
              }
            ])
          }
        }
      }
      
    } catch (err) {
      console.error("Debug test error:", err)
      setError(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Dashboard Debugging Tool</h1>
      
      <Button 
        onClick={runTest} 
        disabled={loading}
        className="mb-6"
      >
        {loading ? "Running Tests..." : "Run Diagnostic Tests"}
      </Button>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {events.length > 0 && (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-4">Current Events</h2>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left">Event ID</th>
                    <th className="text-left">Event Name</th>
                    <th className="text-left">Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(event => (
                    <tr key={event.event_id}>
                      <td className="py-2">{event.event_id}</td>
                      <td className="py-2">{event.event_name}</td>
                      <td className="py-2">{event.start_date} to {event.end_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-4">Direct Database Query Results</h2>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left">Event</th>
                    <th className="text-center">String Match</th>
                    <th className="text-center">Numeric Match</th>
                    <th className="text-center">Name Match</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(event => (
                    <tr key={`direct-${event.event_id}`}>
                      <td className="py-2">{event.event_name}</td>
                      <td className="py-2 text-center">
                        {directMatches[event.event_id]?.stringMatch.matches || 0}
                      </td>
                      <td className="py-2 text-center">
                        {directMatches[event.event_id]?.numericMatch.matches || 0}
                      </td>
                      <td className="py-2 text-center">
                        {directMatches[event.event_id]?.nameMatch.matches || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold mb-4">2-Ball Matchups (API)</h2>
                {matchups2Ball.length > 0 ? (
                  <div className="space-y-4">
                    {matchups2Ball.map(match => (
                      <div key={`2ball-${match.event_id}`} className="border p-4 rounded">
                        <h3 className="font-bold">{match.event_name}</h3>
                        <p>Matchups Found: {match.count}</p>
                        {match.count > 0 && (
                          <div className="mt-2">
                            <h4 className="text-sm font-medium">Sample Matchups:</h4>
                            {match.sample.map((m: any, index: number) => (
                              <div key={m.id || `2ball-match-${index}`} className="text-sm text-gray-400 mt-1">
                                {m.p1_player_name} vs {m.p2_player_name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No 2-ball matchups found</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold mb-4">3-Ball Matchups (API)</h2>
                {matchups3Ball.length > 0 ? (
                  <div className="space-y-4">
                    {matchups3Ball.map(match => (
                      <div key={`3ball-${match.event_id}`} className="border p-4 rounded">
                        <h3 className="font-bold">{match.event_name}</h3>
                        <p>Matchups Found: {match.count}</p>
                        {match.count > 0 && (
                          <div className="mt-2">
                            <h4 className="text-sm font-medium">Sample Matchups:</h4>
                            {match.sample.map((m: any, index: number) => (
                              <div key={m.id || `3ball-match-${index}`} className="text-sm text-gray-400 mt-1">
                                {m.p1_player_name} vs {m.p2_player_name} vs {m.p3_player_name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No 3-ball matchups found</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}