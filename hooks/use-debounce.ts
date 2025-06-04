import { useState, useEffect } from 'react'

/**
 * Hook that delays updating a value until after a specified delay period
 * Useful for preventing excessive API calls or expensive operations during rapid user input
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Set a timer to update the debounced value after the delay
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Clear the timeout if value changes before delay completes
    // This ensures only the latest value is used after the delay
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
} 