"use client"

import { Loader2 } from "lucide-react";
import { useActiveEventsQuery } from '@/hooks/use-active-events-query'

export default function TopNavigation() {
  const { data: activeEvents = [], isLoading, isError, error } = useActiveEventsQuery()

  return (
    <div className="top-navigation">
      <div className="flex items-center">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
        ) : isError ? (
          <span className="text-red-500 font-bold text-lg">Error loading tournaments: {error?.message}</span>
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
                    <span className="ml-2 text-xs px-2 py-0.5 bg-green-800 text-white rounded-full">Euro</span>
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
