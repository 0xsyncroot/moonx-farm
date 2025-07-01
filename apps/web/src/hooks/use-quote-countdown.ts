import { useState, useEffect, useRef, useCallback } from 'react'

interface UseQuoteCountdownProps {
  quote: any
  onAutoRefresh: () => Promise<void>
  isLoading: boolean
}

export function useQuoteCountdown({ quote, onAutoRefresh, isLoading }: UseQuoteCountdownProps) {
  const [realtimeCountdown, setRealtimeCountdown] = useState(0)
  const [isCountdownPaused, setIsCountdownPaused] = useState(false)
  const [isSwapInProgress, setIsSwapInProgress] = useState(false)
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false)
  
  const hasRefetchedRef = useRef(false)
  const pausedTimeRef = useRef(0)
  const pauseStartTimeRef = useRef(0)

  // DEX-style countdown with PAUSE/RESUME control
  useEffect(() => {
    if (!quote) {
      setRealtimeCountdown(0)
      hasRefetchedRef.current = false
      pausedTimeRef.current = 0
      pauseStartTimeRef.current = 0
      return
    }
    
    // Reset pause tracking for new quote
    pausedTimeRef.current = 0
    pauseStartTimeRef.current = 0

    // Initial calculation
    const calculateCountdown = () => {
      const expiry = new Date(quote.expiresAt).getTime()
      const now = Date.now()
      // Subtract paused time to extend quote life
      return Math.max(0, expiry - now + pausedTimeRef.current)
    }

    // Set initial value
    setRealtimeCountdown(calculateCountdown())
    hasRefetchedRef.current = false

    // Update every 200ms for smooth animation
    const interval = setInterval(() => {
      // PAUSE logic: Don't update countdown when swap is in progress
      if (isCountdownPaused || isSwapInProgress) {
        // Track pause duration to extend quote life
        if (pauseStartTimeRef.current === 0) {
          pauseStartTimeRef.current = Date.now()
        }
        return
      }

      // Resume: Add paused time to extend quote
      if (pauseStartTimeRef.current > 0) {
        const pauseDuration = Date.now() - pauseStartTimeRef.current
        pausedTimeRef.current += pauseDuration
        pauseStartTimeRef.current = 0
      }

      const remaining = calculateCountdown()
      setRealtimeCountdown(remaining)
      
      // Auto-refresh quote when it expires - ONLY ONCE
      if (remaining <= 0 && !hasRefetchedRef.current) {
        hasRefetchedRef.current = true
        setIsAutoRefreshing(true)
        onAutoRefresh().finally(() => {
          // Reset auto-refresh state after a delay to show the skeleton
          setTimeout(() => {
            setIsAutoRefreshing(false)
          }, 800)
        })
      }
    }, 200) // Smoother animation

    return () => clearInterval(interval)
  }, [quote?.expiresAt, quote?.id, isCountdownPaused, isSwapInProgress, onAutoRefresh])

  // Reset auto-refresh state when new quote arrives - FIXED: Remove isAutoRefreshing dependency
  useEffect(() => {
    if (quote) {
      setIsAutoRefreshing(false)
    }
  }, [quote?.id])

  // DEX-style countdown control functions
  const pauseCountdown = useCallback((reason: 'swap' | 'approval' = 'swap') => {
    setIsCountdownPaused(true)
    if (reason === 'swap') {
      setIsSwapInProgress(true)
    }
  }, [])
  
  const resumeCountdown = useCallback((reason: 'cancelled' | 'completed' | 'error' = 'completed') => {
    setIsCountdownPaused(false)
    setIsSwapInProgress(false)
    
    // Reset refs when resuming
    pauseStartTimeRef.current = 0
  }, [])

  return {
    realtimeCountdown,
    isCountdownPaused,
    isSwapInProgress,
    isAutoRefreshing,
    pauseCountdown,
    resumeCountdown
  }
} 