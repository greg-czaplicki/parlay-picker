import { createSupabaseClient } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

interface TournamentMatch {
  event_id: number
  event_name: string
  tour: string
  start_date: string
  course_name?: string
  confidence: number
  match_type: 'exact' | 'fuzzy' | 'alias'
}

interface TournamentAlias {
  event_id: number
  alias_name: string
  source: string
  is_primary: boolean
}

export class TournamentNameResolver {
  private supabase = createSupabaseClient()

  /**
   * Find tournament by name with fuzzy matching and alias support
   */
  async resolveTournamentName(
    apiEventName: string, 
    tour?: string,
    startDate?: string
  ): Promise<TournamentMatch | null> {
    logger.info(`Resolving tournament name: "${apiEventName}" for tour: ${tour}`)

    // 1. Try exact match first
    const exactMatch = await this.findExactMatch(apiEventName, tour, startDate)
    if (exactMatch) {
      logger.info(`Found exact match for "${apiEventName}"`)
      return { ...exactMatch, confidence: 1.0, match_type: 'exact' }
    }

    // 2. Try alias match
    const aliasMatch = await this.findAliasMatch(apiEventName, tour, startDate)
    if (aliasMatch) {
      logger.info(`Found alias match for "${apiEventName}"`)
      return { ...aliasMatch, confidence: 0.95, match_type: 'alias' }
    }

    // 3. Try fuzzy matching
    const fuzzyMatch = await this.findFuzzyMatch(apiEventName, tour, startDate)
    if (fuzzyMatch) {
      logger.info(`Found fuzzy match for "${apiEventName}": "${fuzzyMatch.event_name}"`)
      return fuzzyMatch
    }

    // 4. Try cross-tour exact match (for tournaments that may be categorized differently)
    // This handles cases like Barracuda Championship being in PGA tour but DataGolf sends it as OPP
    const crossTourMatch = await this.findCrossTourMatch(apiEventName, startDate)
    if (crossTourMatch) {
      logger.warn(`Found cross-tour match for "${apiEventName}": "${crossTourMatch.event_name}" on ${crossTourMatch.tour} tour (requested ${tour})`)
      return { ...crossTourMatch, confidence: 0.9, match_type: 'exact' }
    }

    logger.warn(`No tournament match found for "${apiEventName}"`)
    return null
  }

  /**
   * Add tournament alias to prevent future mismatches
   */
  async addTournamentAlias(
    eventId: number,
    aliasName: string,
    source: string = 'datagolf'
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('tournament_aliases')
        .upsert({
          event_id: eventId,
          alias_name: aliasName,
          source,
          is_primary: false,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'event_id,alias_name'
        })

      if (error) throw error
      logger.info(`Added tournament alias: "${aliasName}" for event_id: ${eventId}`)
    } catch (error) {
      logger.error(`Failed to add tournament alias:`, error)
    }
  }

  /**
   * Get all aliases for a tournament
   */
  async getTournamentAliases(eventId: number): Promise<TournamentAlias[]> {
    const { data, error } = await this.supabase
      .from('tournament_aliases')
      .select('*')
      .eq('event_id', eventId)

    if (error) {
      logger.error(`Failed to get tournament aliases:`, error)
      return []
    }

    return data || []
  }

  private async findExactMatch(
    eventName: string, 
    tour?: string, 
    startDate?: string
  ): Promise<Omit<TournamentMatch, 'confidence' | 'match_type'> | null> {
    let query = this.supabase
      .from('tournaments_v2')
      .select('event_id, event_name, tour, start_date, course_name')
      .eq('event_name', eventName)

    if (tour) query = query.eq('tour', tour)
    if (startDate) query = query.gte('start_date', startDate).lte('end_date', startDate)

    const { data, error } = await query.limit(1).single()

    if (error || !data) return null
    return data
  }

  private async findAliasMatch(
    eventName: string,
    tour?: string,
    startDate?: string
  ): Promise<Omit<TournamentMatch, 'confidence' | 'match_type'> | null> {
    let query = this.supabase
      .from('tournament_aliases')
      .select(`
        event_id,
        tournaments!inner(event_name, tour, start_date, end_date, course_name)
      `)
      .eq('alias_name', eventName)

    const { data, error } = await query

    if (error || !data || data.length === 0) return null

    // Filter by tour and date if provided
    const filtered = data.filter(item => {
      const tournament = item.tournaments as any
      if (tour && tournament.tour !== tour) return false
      if (startDate) {
        const start = new Date(tournament.start_date)
        const end = new Date(tournament.end_date)
        const date = new Date(startDate)
        if (date < start || date > end) return false
      }
      return true
    })

    if (filtered.length === 0) return null

    const match = filtered[0]
    const tournament = match.tournaments as any
    return {
      event_id: match.event_id,
      event_name: tournament.event_name,
      tour: tournament.tour,
      start_date: tournament.start_date,
      course_name: tournament.course_name
    }
  }

  private async findFuzzyMatch(
    eventName: string,
    tour?: string,
    startDate?: string
  ): Promise<TournamentMatch | null> {
    // Get tournaments for fuzzy matching
    let query = this.supabase
      .from('tournaments_v2')
      .select('event_id, event_name, tour, start_date, end_date')

    if (tour) query = query.eq('tour', tour)

    // If we have a start date, look for tournaments around that time (±7 days)
    if (startDate) {
      const date = new Date(startDate)
      const weekBefore = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000)
      const weekAfter = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000)
      query = query
        .gte('start_date', weekBefore.toISOString().split('T')[0])
        .lte('start_date', weekAfter.toISOString().split('T')[0])
    }

    const { data, error } = await query

    if (error || !data || data.length === 0) return null

    // Calculate similarity scores
    const matches = data
      .map(tournament => ({
        ...tournament,
        confidence: this.calculateSimilarity(eventName, tournament.event_name),
        match_type: 'fuzzy' as const
      }))
      .filter(match => match.confidence > 0.7) // Only consider matches above 70% similarity
      .sort((a, b) => b.confidence - a.confidence)

    return matches.length > 0 ? matches[0] : null
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Normalize strings for comparison
    const normalize = (str: string) => 
      str.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ')    // Normalize whitespace
        .trim()

    const norm1 = normalize(str1)
    const norm2 = normalize(str2)

    // Check if one is contained in the other (high confidence)
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return 0.9
    }

    // Use Levenshtein distance for similarity
    const distance = this.levenshteinDistance(norm1, norm2)
    const maxLength = Math.max(norm1.length, norm2.length)
    
    if (maxLength === 0) return 1.0
    
    return 1 - (distance / maxLength)
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  private async findCrossTourMatch(
    eventName: string,
    startDate?: string
  ): Promise<Omit<TournamentMatch, 'confidence' | 'match_type'> | null> {
    // Look for exact match across all tours
    let query = this.supabase
      .from('tournaments_v2')
      .select('event_id, event_name, tour, start_date, course_name')
      .eq('event_name', eventName)

    if (startDate) {
      query = query.gte('start_date', startDate).lte('end_date', startDate)
    }

    const { data, error } = await query.limit(1).single()

    if (error || !data) return null
    return data
  }

  /**
   * Validate and suggest tournament name corrections
   */
  async validateTournamentName(
    apiEventName: string,
    tour?: string
  ): Promise<{
    isValid: boolean
    suggestions: Array<{ event_name: string; confidence: number }>
    recommendedAction: string
  }> {
    const match = await this.resolveTournamentName(apiEventName, tour)
    
    if (match && match.confidence >= 0.95) {
      return {
        isValid: true,
        suggestions: [],
        recommendedAction: 'none'
      }
    }

    // Get suggestions for low confidence or no matches
    let query = this.supabase
      .from('tournaments_v2')
      .select('event_name')
      .order('start_date', { ascending: false })
      .limit(20)

    if (tour) query = query.eq('tour', tour)

    const { data } = await query
    const tournaments = data || []

    const suggestions = tournaments
      .map(t => ({
        event_name: t.event_name,
        confidence: this.calculateSimilarity(apiEventName, t.event_name)
      }))
      .filter(s => s.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)

    return {
      isValid: false,
      suggestions,
      recommendedAction: match 
        ? 'add_alias' 
        : suggestions.length > 0 
          ? 'update_tournament_name' 
          : 'add_new_tournament'
    }
  }
} 