// Greg
// Query Key Factory for React Query
// Provides a consistent, type-safe system for generating query keys with namespacing
//
// Usage example:
// const key = queryKeys.matchups.byEventAndType(123, "3ball")
// queryClient.invalidateQueries({ queryKey: key })

export const queryKeys = {
  // User-related queries
  users: {
    all: () => ["users"] as const,
    list: (filters?: Record<string, unknown>) => ["users", "list", filters] as const,
    detail: (id: string | number) => ["users", "detail", id] as const,
  },
  // Matchup-related queries
  matchups: {
    all: () => ["matchups"] as const,
    byEvent: (eventId: number) => ["matchups", "event", eventId] as const,
    byEventAndType: (eventId: number, type: "2ball" | "3ball") => ["matchups", "event", eventId, type] as const,
    list: (filters?: Record<string, unknown>) => ["matchups", "list", filters] as const,
    detail: (id: string | number) => ["matchups", "detail", id] as const,
  },
  // Parlay-related queries
  parlays: {
    all: () => ["parlays"] as const,
    list: (filters?: Record<string, unknown>) => ["parlays", "list", filters] as const,
    detail: (id: string | number) => ["parlays", "detail", id] as const,
  },
  // Recommended picks queries
  recommendedPicks: {
    all: () => ["recommendedPicks"] as const,
    byEvent: (eventId: number) => ["recommendedPicks", "event", eventId] as const,
    byEventAndType: (eventId: number, type: "2ball" | "3ball") => ["recommendedPicks", "event", eventId, type] as const,
    list: (filters?: Record<string, unknown>) => ["recommendedPicks", "list", filters] as const,
  },
  // Player data queries (season, live, PGA Tour, field)
  playerData: {
    season: (filters?: Record<string, unknown>) => ["playerData", "season", filters] as const,
    live: (eventId: number, roundAndPlayers: string) => ["playerData", "live", eventId, roundAndPlayers] as const,
    pgaTour: (filters?: Record<string, unknown>) => ["playerData", "pgaTour", filters] as const,
    field: (eventId: number) => ["playerData", "field", eventId] as const,
    direct: () => ["playerData", "direct"] as const,
  },
  // Tournament schedule
  tournamentSchedule: () => ["tournamentSchedule"] as const,
  // Current week events
  currentWeekEvents: () => ["tournaments", "currentWeek"] as const,
  // Matchup type detection
  matchupType: (eventId: number | null) => ["matchupType", eventId] as const,
}

// Helper type for inferring query key types
// Extend as new keys are added
// Usage: type QueryKey = ReturnType<typeof queryKeys.matchups.byEventAndType>
type QueryKey =
  | ReturnType<typeof queryKeys.users.all>
  | ReturnType<typeof queryKeys.users.list>
  | ReturnType<typeof queryKeys.users.detail>
  | ReturnType<typeof queryKeys.matchups.all>
  | ReturnType<typeof queryKeys.matchups.byEvent>
  | ReturnType<typeof queryKeys.matchups.byEventAndType>
  | ReturnType<typeof queryKeys.matchups.list>
  | ReturnType<typeof queryKeys.matchups.detail>
  | ReturnType<typeof queryKeys.parlays.all>
  | ReturnType<typeof queryKeys.parlays.list>
  | ReturnType<typeof queryKeys.parlays.detail>
  | ReturnType<typeof queryKeys.recommendedPicks.all>
  | ReturnType<typeof queryKeys.recommendedPicks.byEvent>
  | ReturnType<typeof queryKeys.recommendedPicks.byEventAndType>
  | ReturnType<typeof queryKeys.recommendedPicks.list>
  | ReturnType<typeof queryKeys.playerData.season>
  | ReturnType<typeof queryKeys.playerData.live>
  | ReturnType<typeof queryKeys.playerData.pgaTour>
  | ReturnType<typeof queryKeys.playerData.field>
  | ReturnType<typeof queryKeys.playerData.direct>
  | ReturnType<typeof queryKeys.tournamentSchedule>
  | ReturnType<typeof queryKeys.currentWeekEvents>
  | ReturnType<typeof queryKeys.matchupType>

export type { QueryKey }

// Usage examples:
// const key = queryKeys.matchups.byEventAndType(123, "3ball")
// queryClient.invalidateQueries({ queryKey: key })
//
// const playerKey = queryKeys.playerData.live(123, "2")
// queryClient.fetchQuery({ queryKey: playerKey }) 