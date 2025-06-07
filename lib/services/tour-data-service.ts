import { logger } from '@/lib/logger'

// DataGolf API configuration
const DATA_GOLF_API_KEY = process.env.DATAGOLF_API_KEY

if (!DATA_GOLF_API_KEY) {
  throw new Error('DATAGOLF_API_KEY environment variable is required')
}

// Tour types
export enum TourType {
  PGA = 'pga',
  EURO = 'euro',
  DP_WORLD = 'dp_world',
  KORN_FERRY = 'korn_ferry',
  LIVGOLF = 'liv'
}

// Unified player stats interface for settlement
export interface PlayerStats {
  dg_id: number
  player_name: string
  event_id: number
  tour_type: TourType
  
  // Position and scoring
  current_position?: string | number
  total_score?: number
  today_score?: number
  thru?: number
  
  // Tournament status
  made_cut?: boolean
  finished?: boolean
  
  // Additional data
  round_num?: number
  tee_time?: string
  
  // Raw data for debugging
  raw_data?: any
}

// In-play predictions API response structure (both PGA and Euro)
interface InPlayPlayerData {
  dg_id: number
  player_name: string
  country?: string
  course?: string
  current_pos?: string
  current_score?: number
  make_cut?: number
  round?: number
  thru?: number
  today?: number | string
  position?: string
  total?: number
  // Euro tour round scores
  R1?: number
  R2?: number
  R3?: number
  R4?: number
  // Odds and probabilities
  win?: number
  top_5?: number
  top_10?: number
  top_20?: number
  [key: string]: any
}

export class TourDataService {
  /**
   * Determine tour type from tournament data
   */
  static getTourType(tournamentName?: string, tourName?: string): TourType {
    // First, check for exact matches in the database tour field
    if (tourName) {
      const dbTour = tourName.toLowerCase().trim()
      
      // Exact database tour field matches
      if (dbTour === 'euro') return TourType.EURO
      if (dbTour === 'dp_world' || dbTour === 'dp world') return TourType.DP_WORLD
      if (dbTour === 'korn_ferry' || dbTour === 'korn ferry') return TourType.KORN_FERRY
      if (dbTour === 'liv') return TourType.LIVGOLF
      if (dbTour === 'pga') return TourType.PGA
    }
    
    // Fallback: check tournament name for substring matches
    if (tournamentName) {
      const name = tournamentName.toLowerCase()
      
      if (name.includes('euro') || name.includes('dp world') || name.includes('european')) {
        return TourType.EURO
      }
      if (name.includes('korn ferry')) {
        return TourType.KORN_FERRY
      }
      if (name.includes('liv')) {
        return TourType.LIVGOLF
      }
    }
    
    // Default to PGA Tour
    return TourType.PGA
  }

  /**
   * Fetch player stats for any tour type using in-play predictions
   */
  static async fetchPlayerStats(eventId: number, tourType: TourType): Promise<PlayerStats[]> {
    logger.info(`Fetching player stats for event ${eventId}, tour: ${tourType}`)
    
    try {
      switch (tourType) {
        case TourType.PGA:
        case TourType.KORN_FERRY:
        case TourType.LIVGOLF:
          return await this.fetchInPlayPredictions('pga', eventId)
          
        case TourType.EURO:
        case TourType.DP_WORLD:
          return await this.fetchInPlayPredictions('euro', eventId)
          
        default:
          throw new Error(`Unsupported tour type: ${tourType}`)
      }
    } catch (error) {
      logger.error(`Failed to fetch player stats for ${tourType}: ${error}`)
      throw error
    }
  }

  /**
   * Fetch in-play predictions for any tour
   */
  private static async fetchInPlayPredictions(tour: 'pga' | 'euro', eventId: number): Promise<PlayerStats[]> {
    const url = `https://feeds.datagolf.com/preds/in-play?tour=${tour}&dead_heat=no&odds_format=percent&key=${DATA_GOLF_API_KEY}`
    
    logger.info(`Fetching ${tour.toUpperCase()} in-play predictions: ${url.replace(DATA_GOLF_API_KEY || '', 'REDACTED')}`)
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 } // Cache for 5 minutes
    })

    if (!response.ok) {
      throw new Error(`${tour.toUpperCase()} in-play API error: ${response.status} ${response.statusText}`)
    }

    const apiResponse = await response.json()
    const data = apiResponse.data || []
    
    logger.info(`${tour.toUpperCase()} in-play predictions fetched: ${data.length} players`)

    // Normalize the in-play predictions data to our PlayerStats interface
    const allPlayerStats: PlayerStats[] = []
    
    for (const player of data) {
      const tourType = tour === 'pga' ? TourType.PGA : TourType.EURO
      
      // Add current tournament state for settlement
      allPlayerStats.push(this.normalizeInPlayPlayerStats(player, eventId, tourType))
      
      // Add historical round data if available (both PGA and Euro have R1, R2, R3, R4 data)
      const rounds = [
        { round: 1, score: player.R1 },
        { round: 2, score: player.R2 }, 
        { round: 3, score: player.R3 },
        { round: 4, score: player.R4 }
      ]
      
      for (const roundData of rounds) {
        if (roundData.score !== null && roundData.score !== undefined) {
          allPlayerStats.push(this.normalizeInPlayPlayerStatsForRound(player, eventId, tourType, roundData.round, roundData.score))
        }
      }
    }

    return allPlayerStats
  }

  /**
   * Normalize in-play predictions data to common interface
   */
  private static normalizeInPlayPlayerStats(player: any, eventId: number, tourType: TourType): PlayerStats {
    // Handle both PGA and Euro tour in-play prediction formats
    const position = player.current_pos || player.position || player.current_position
    const totalScore = player.current_score || player.total
    const todayScore = typeof player.today === 'number' ? player.today : 0
    const holesThru = player.thru || 0
    const roundNum = player.round || 1
    const madeCut = player.make_cut === 1 || this.determineCutStatus(position)

    return {
      dg_id: player.dg_id,
      player_name: player.player_name,
      event_id: eventId,
      tour_type: tourType,
      current_position: position,
      total_score: totalScore,
      today_score: todayScore,
      thru: holesThru,
      round_num: roundNum,
      finished: holesThru === 18,
      made_cut: madeCut,
      raw_data: player
    }
  }

  /**
   * Normalize in-play predictions data for a specific round
   */
  private static normalizeInPlayPlayerStatsForRound(
    player: any, 
    eventId: number, 
    tourType: TourType,
    roundNum: number, 
    roundScore: number
  ): PlayerStats {
    const madeCut = player.make_cut === 1 || this.determineCutStatus(player.current_pos || player.position)

    return {
      dg_id: player.dg_id,
      player_name: player.player_name,
      event_id: eventId,
      tour_type: tourType,
      current_position: undefined, // Position is calculated after all round scores are collected
      total_score: roundScore,
      today_score: roundScore,
      thru: 18, // Historical rounds are always complete
      round_num: roundNum,
      finished: true,
      made_cut: madeCut,
      raw_data: {
        ...player,
        round_specific_score: roundScore,
        historical_round: roundNum
      }
    }
  }

  /**
   * Determine if player made the cut based on position
   */
  private static determineCutStatus(position: string): boolean | undefined {
    if (!position) return undefined
    
    // Handle various position formats
    if (position.toLowerCase() === 'cut' || position.toLowerCase() === 'mc') {
      return false
    }
    
    // If it's a number, they made the cut
    const posNum = parseInt(position)
    if (!isNaN(posNum)) {
      return true
    }
    
    return undefined
  }

  /**
   * Get the appropriate API endpoint for a tour type
   */
  static getAPIEndpoint(tourType: TourType): string {
    switch (tourType) {
      case TourType.PGA:
      case TourType.KORN_FERRY:
      case TourType.LIVGOLF:
        return `https://feeds.datagolf.com/preds/in-play?tour=pga&dead_heat=no&odds_format=percent&key=${DATA_GOLF_API_KEY}`
        
      case TourType.EURO:
      case TourType.DP_WORLD:
        return `https://feeds.datagolf.com/preds/in-play?tour=euro&dead_heat=no&odds_format=percent&key=${DATA_GOLF_API_KEY}`
        
      default:
        throw new Error(`No API endpoint defined for tour type: ${tourType}`)
    }
  }
} 