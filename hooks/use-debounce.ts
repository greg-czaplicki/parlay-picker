import { useState, useEffect, useRef } from 'react'
import { debounce } from 'lodash'

/**
 * Hook that delays updating a value until after a specified delay period
 * Uses lodash debounce for better performance and reliability
 * Useful for preventing excessive API calls or expensive operations during rapid user input
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  
  // Create debounced function with lodash
  const debouncedUpdate = useRef(
    debounce((newValue: T) => {
      setDebouncedValue(newValue)
    }, delay)
  )

  useEffect(() => {
    // Update the delay if it changes
    debouncedUpdate.current = debounce((newValue: T) => {
      setDebouncedValue(newValue)
    }, delay)
  }, [delay])

  useEffect(() => {
    debouncedUpdate.current(value)
    
    // Cleanup
    return () => {
      debouncedUpdate.current.cancel()
    }
  }, [value])

  return debouncedValue
} 