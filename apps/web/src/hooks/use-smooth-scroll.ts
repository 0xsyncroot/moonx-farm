import { useRef, useCallback, useEffect, useState } from 'react'

interface UseSmoothScrollOptions {
  /**
   * Distance from bottom (in pixels) to consider "near bottom"
   * @default 100
   */
  nearBottomThreshold?: number
  
  /**
   * Delay before considering user has stopped scrolling
   * @default 1000
   */
  userScrollDelay?: number
  
  /**
   * Debounce delay for scroll events
   * @default 50
   */
  scrollDebounce?: number
  
  /**
   * Auto-scroll interval during active typing/loading
   * @default 200
   */
  autoScrollInterval?: number
}

export function useSmoothScroll({
  nearBottomThreshold = 100,
  userScrollDelay = 1000,
  scrollDebounce = 50,
  autoScrollInterval = 200
}: UseSmoothScrollOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollTargetRef = useRef<HTMLDivElement>(null)
  
  // Scroll state
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastScrollTop = useRef(0)
  const isScrollingProgrammatically = useRef(false)
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Check if user is at the bottom
  const isAtBottom = useCallback(() => {
    if (!containerRef.current) return false
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    return scrollHeight - scrollTop - clientHeight < nearBottomThreshold
  }, [nearBottomThreshold])

  // Smooth scroll to bottom function
  const scrollToBottom = useCallback((force = false) => {
    if (!scrollTargetRef.current || !containerRef.current) return
    
    const isNearBottom = isAtBottom()
    
    if (force || (!isUserScrolling && (shouldAutoScroll || isNearBottom))) {
      isScrollingProgrammatically.current = true
      
      // Use requestAnimationFrame for smoother animations
      requestAnimationFrame(() => {
        if (scrollTargetRef.current) {
          scrollTargetRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end',
            inline: 'nearest'
          })
        }
      })
      
      // Reset programmatic scroll flag after animation
      setTimeout(() => {
        isScrollingProgrammatically.current = false
      }, 500)
    }
  }, [isUserScrolling, shouldAutoScroll, isAtBottom])

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!containerRef.current || isScrollingProgrammatically.current) return
    
    const container = containerRef.current
    const { scrollTop, scrollHeight, clientHeight } = container
    
    // Detect manual scrolling
    if (Math.abs(scrollTop - lastScrollTop.current) > 1) {
      setIsUserScrolling(true)
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      
      // Reset user scrolling after delay
      scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false)
      }, userScrollDelay)
    }
    
    // Update auto-scroll state
    const isAtBottomNow = scrollHeight - scrollTop - clientHeight < 50
    setShouldAutoScroll(isAtBottomNow)
    
    lastScrollTop.current = scrollTop
  }, [userScrollDelay])

  // Start auto-scroll during active states
  const startAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current) return
    
    autoScrollIntervalRef.current = setInterval(() => {
      if (shouldAutoScroll && !isUserScrolling) {
        scrollToBottom()
      }
    }, autoScrollInterval)
  }, [shouldAutoScroll, isUserScrolling, scrollToBottom, autoScrollInterval])

  // Stop auto-scroll
  const stopAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
      autoScrollIntervalRef.current = null
    }
  }, [])

  // Setup scroll event listener
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let timeoutId: NodeJS.Timeout
    const debouncedHandleScroll = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(handleScroll, scrollDebounce)
    }

    container.addEventListener('scroll', debouncedHandleScroll, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', debouncedHandleScroll)
      clearTimeout(timeoutId)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [handleScroll, scrollDebounce])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoScroll()
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [stopAutoScroll])

  return {
    containerRef,
    scrollTargetRef,
    scrollToBottom,
    startAutoScroll,
    stopAutoScroll,
    isUserScrolling,
    shouldAutoScroll,
    isAtBottom
  }
} 