"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase"
import { useDashboardDebugDiagnostics } from '@/hooks/use-dashboard-debug-diagnostics'

export default function DashboardDebug() {
  const { mutate: runDiagnostics, data, isPending, isError, error } = useDashboardDebugDiagnostics()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Dashboard Debugging Tool</h1>
      <Button 
        onClick={() => runDiagnostics()} 
        disabled={isPending}
        className="mb-6"
      >
        {isPending ? "Running Tests..." : "Run Diagnostic Tests"}
      </Button>
      {isError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error?.message}</AlertDescription>
        </Alert>
      )}
      {data?.events && data.events.length > 0 && (
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
                  {data.events.map(event => (
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
                  {data.events.map(event => (
                    <tr key={`direct-${event.event_id}`}>
                      <td className="py-2">{event.event_name}</td>
                      <td className="py-2 text-center">{data.directMatches[event.event_id]?.stringMatch.matches}</td>
                      <td className="py-2 text-center">{data.directMatches[event.event_id]?.numericMatch.matches}</td>
                      <td className="py-2 text-center">{data.directMatches[event.event_id]?.nameMatch.matches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-4">2-Ball API Results</h2>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left">Event</th>
                    <th className="text-center">Matchup Count</th>
                    <th className="text-left">Sample</th>
                  </tr>
                </thead>
                <tbody>
                  {data.matchups2Ball.map(matchup => (
                    <tr key={`2ball-${matchup.event_id}`}>
                      <td className="py-2">{matchup.event_name}</td>
                      <td className="py-2 text-center">{matchup.count}</td>
                      <td className="py-2">{JSON.stringify(matchup.sample)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-4">3-Ball API Results</h2>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left">Event</th>
                    <th className="text-center">Matchup Count</th>
                    <th className="text-left">Sample</th>
                  </tr>
                </thead>
                <tbody>
                  {data.matchups3Ball.map(matchup => (
                    <tr key={`3ball-${matchup.event_id}`}>
                      <td className="py-2">{matchup.event_name}</td>
                      <td className="py-2 text-center">{matchup.count}</td>
                      <td className="py-2">{JSON.stringify(matchup.sample)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}