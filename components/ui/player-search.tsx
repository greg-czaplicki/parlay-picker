"use client"

import { useState, useCallback, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Search, X, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatPlayerName } from "@/lib/utils"

interface PlayerSearchProps {
  placeholder?: string
  onSearchChange?: (searchTerm: string, matchingCount: number) => void
  showMatchCount?: boolean
  className?: string
}

interface PlayerSearchResult {
  searchTerm: string
  isSearching: boolean
  clearSearch: () => void
}

export interface UsePlayerSearchOptions<T extends { name: string }> {
  players: T[]
  searchTerm: string
  caseSensitive?: boolean
}

export interface UsePlayerSearchResult<T> {
  filteredPlayers: T[]
  matchingCount: number
  isPlayerMatch: (playerName: string) => boolean
  highlightText: (text: string) => React.ReactNode
}

/**
 * Hook for filtering players based on search term
 */
export function usePlayerSearch<T extends { name: string }>({
  players,
  searchTerm,
  caseSensitive = false
}: UsePlayerSearchOptions<T>): UsePlayerSearchResult<T> {
  
  const normalizedSearchTerm = useMemo(() => {
    if (!searchTerm.trim()) return ''
    return caseSensitive ? searchTerm.trim() : searchTerm.trim().toLowerCase()
  }, [searchTerm, caseSensitive])

  const { filteredPlayers, matchingCount } = useMemo(() => {
    if (!normalizedSearchTerm) {
      return { filteredPlayers: players, matchingCount: 0 }
    }

    const filtered = players.filter(player => {
      const formattedName = formatPlayerName(player.name)
      const nameToSearch = caseSensitive ? formattedName : formattedName.toLowerCase()
      
      // Support multiple search terms (e.g., "tiger woods", "woods tiger")
      const searchTerms = normalizedSearchTerm.split(' ').filter(term => term.length > 0)
      
      // Player matches if ALL search terms are found in the name
      return searchTerms.every(term => nameToSearch.includes(term))
    })

    return { 
      filteredPlayers: filtered, 
      matchingCount: filtered.length 
    }
  }, [players, normalizedSearchTerm, caseSensitive])

  const isPlayerMatch = useCallback((playerName: string): boolean => {
    if (!normalizedSearchTerm) return false
    
    const formattedName = formatPlayerName(playerName)
    const nameToSearch = caseSensitive ? formattedName : formattedName.toLowerCase()
    const searchTerms = normalizedSearchTerm.split(' ').filter(term => term.length > 0)
    
    return searchTerms.every(term => nameToSearch.includes(term))
  }, [normalizedSearchTerm, caseSensitive])

  const highlightText = useCallback((text: string): React.ReactNode => {
    if (!normalizedSearchTerm || !text) return text

    const formattedText = formatPlayerName(text)
    const searchTerms = normalizedSearchTerm.split(' ').filter(term => term.length > 0)
    
    // Create a regex that matches any of the search terms (case-insensitive)
    const regex = new RegExp(`(${searchTerms.map(term => 
      term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
    ).join('|')})`, caseSensitive ? 'g' : 'gi')

    const parts = formattedText.split(regex)
    
    return parts.map((part, index) => {
      // Handle empty parts that can occur with split
      if (!part) return null
      
      const isMatch = searchTerms.some(term => 
        caseSensitive ? part === term : part.toLowerCase() === term.toLowerCase()
      )
      
      return isMatch ? (
        <mark key={index} className="bg-yellow-200/90 text-yellow-900 px-0.5 rounded font-semibold">
          {part}
        </mark>
      ) : (
        <span key={index}>{part}</span>
      )
    }).filter(Boolean) // Remove null parts
  }, [normalizedSearchTerm, caseSensitive])

  return {
    filteredPlayers,
    matchingCount,
    isPlayerMatch,
    highlightText
  }
}

/**
 * PlayerSearch Component - Provides search input with match count
 */
export function PlayerSearch({ 
  placeholder = "Search players...", 
  onSearchChange,
  showMatchCount = true,
  className = ""
}: PlayerSearchProps): [React.ReactNode, PlayerSearchResult] {
  const [searchTerm, setSearchTerm] = useState("")

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value)
    if (onSearchChange) {
      // We can't calculate match count here without player data,
      // so we'll pass 0 and let the parent handle it
      onSearchChange(value, 0)
    }
  }, [onSearchChange])

  const clearSearch = useCallback(() => {
    setSearchTerm("")
    if (onSearchChange) {
      onSearchChange("", 0)
    }
  }, [onSearchChange])

  const searchComponent = (
    <Card className={`glass-card ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 pr-10 bg-background/50 border-border focus:border-primary"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const searchResult: PlayerSearchResult = {
    searchTerm,
    isSearching: !!searchTerm.trim(),
    clearSearch
  }

  return [searchComponent, searchResult]
}

/**
 * PlayerSearchWithCount - Search component that shows match count
 */
interface PlayerSearchWithCountProps<T extends { name: string }> extends PlayerSearchProps {
  players: T[]
  caseSensitive?: boolean
  value?: string
  onSearchChange?: (searchTerm: string) => void
}

export function PlayerSearchWithCount<T extends { name: string }>({ 
  players,
  caseSensitive = false,
  placeholder = "Search players...",
  className = "",
  value,
  onSearchChange
}: PlayerSearchWithCountProps<T>) {
  const [internalSearchTerm, setInternalSearchTerm] = useState("")
  
  // Use controlled value if provided, otherwise use internal state
  const searchTerm = value !== undefined ? value : internalSearchTerm

  const { matchingCount } = usePlayerSearch({
    players,
    searchTerm,
    caseSensitive
  })

  const handleSearchChange = (newValue: string) => {
    if (value === undefined) {
      // Uncontrolled mode
      setInternalSearchTerm(newValue)
    }
    onSearchChange?.(newValue)
  }

  const clearSearch = () => {
    const newValue = ""
    if (value === undefined) {
      setInternalSearchTerm(newValue)
    }
    onSearchChange?.(newValue)
  }

  return (
    <Card className={`glass-card ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 pr-10 bg-background/50 border-border focus:border-primary"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {searchTerm && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {matchingCount} match{matchingCount !== 1 ? 'es' : ''}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default PlayerSearch 