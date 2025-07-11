'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { LiliAvatar } from './lili-avatar'
import { useChat } from './chat-provider'
import { cn } from '@/lib/utils'

interface Position {
  x: number
  y: number
}

interface LiliScreenWalkerProps {
  className?: string
}

export function LiliScreenWalker({ className }: LiliScreenWalkerProps) {
  const { isWalkerEnabled: isEnabled, setIsWalkerEnabled, setIsOpen } = useChat()
  
  // Initialize with safe starting position
  const [position, setPosition] = useState<Position>({ x: 300, y: 200 })
  const [isMoving, setIsMoving] = useState(false)
  const [direction, setDirection] = useState<'left' | 'right'>('right')
  const [isHovered, setIsHovered] = useState(false)
  const [showBubble, setShowBubble] = useState(false)
  const [bubbleText, setBubbleText] = useState('')
  const moveTimeoutRef = useRef<NodeJS.Timeout>()
  const bubbleTimeoutRef = useRef<NodeJS.Timeout>()
  const [isInitialized, setIsInitialized] = useState(false)

  const bubbleMessages = useMemo(() => [
    "Hi there! 👋",
    "Need help with DeFi? 💰", 
    "Click me to chat! 💬",
    "Let's trade together! 🚀",
    "I'm here to help! ✨",
    "Exploring MoonX Farm? 🌙",
    "Got questions? Ask me! 💭"
  ], [])

  // Get safe movement boundaries (memoized)
  const getSafeBoundaries = useCallback(() => {
    if (typeof window === 'undefined') return { minX: 50, maxX: 500, minY: 100, maxY: 400 }
    
    const margin = 80
    const headerHeight = 100
    const footerHeight = 120
    return {
      minX: margin,
      maxX: window.innerWidth - margin,
      minY: headerHeight + margin,
      maxY: window.innerHeight - footerHeight - margin
    }
  }, [])

  // Generate random position within safe boundaries (memoized)
  const getRandomPosition = useCallback((): Position => {
    const boundaries = getSafeBoundaries()
    return {
      x: Math.random() * (boundaries.maxX - boundaries.minX) + boundaries.minX,
      y: Math.random() * (boundaries.maxY - boundaries.minY) + boundaries.minY
    }
  }, [getSafeBoundaries])

  // Move Lili to a new random position with smooth animation (optimized)
  const moveToRandomPosition = useCallback(() => {
    if (!isEnabled || isHovered) return

    const newPosition = getRandomPosition()
    const distance = Math.sqrt(
      Math.pow(newPosition.x - position.x, 2) + Math.pow(newPosition.y - position.y, 2)
    )
    
    // Calculate movement duration based on distance
    const baseSpeed = 80
    const movementDuration = Math.max(2000, Math.min(4500, (distance / baseSpeed) * 1000))
    
    setDirection(newPosition.x > position.x ? 'right' : 'left')
    setIsMoving(true)
    
    // Use CSS custom property for dynamic timing
    const walkerElement = document.querySelector('.lili-walker') as HTMLElement
    if (walkerElement) {
      walkerElement.style.setProperty('--movement-duration', `${movementDuration}ms`)
    }
    
    setPosition(newPosition)

    // Clean up previous timeout if exists
    if (moveTimeoutRef.current) {
      clearTimeout(moveTimeoutRef.current)
    }

    // Stop moving animation after transition completes
    moveTimeoutRef.current = setTimeout(() => {
      setIsMoving(false)
    }, movementDuration + 200)
  }, [isEnabled, isHovered, position.x, position.y, getRandomPosition])

  // Show random speech bubble (optimized)
  const showRandomBubble = useCallback(() => {
    if (!isEnabled || showBubble) return

    const randomMessage = bubbleMessages[Math.floor(Math.random() * bubbleMessages.length)]
    setBubbleText(randomMessage)
    setShowBubble(true)

    // Clean up previous timeout if exists
    if (bubbleTimeoutRef.current) {
      clearTimeout(bubbleTimeoutRef.current)
    }

    // Hide bubble after 3 seconds
    bubbleTimeoutRef.current = setTimeout(() => {
      setShowBubble(false)
    }, 3000)
  }, [isEnabled, showBubble, bubbleMessages])

  // Handle click - open chat (optimized)
  const handleClick = useCallback(() => {
    setIsOpen(true)
    setShowBubble(false)
  }, [setIsOpen])

  // Initialize movement after component mounts (optimized)
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      const boundaries = getSafeBoundaries()
      const initialPos = {
        x: Math.min(300, boundaries.maxX - 100),
        y: Math.min(250, boundaries.maxY - 100)
      }
      setPosition(initialPos)
      setIsInitialized(true)
      
      // Start first movement after delay
      const initTimeout = setTimeout(() => {
        if (isEnabled) {
          moveToRandomPosition()
        }
      }, 5000)

      return () => clearTimeout(initTimeout)
    }
  }, [isEnabled, moveToRandomPosition, getSafeBoundaries, isInitialized])

  // Movement interval (optimized)
  useEffect(() => {
    if (!isEnabled || !isInitialized) return

    const moveInterval = setInterval(() => {
      moveToRandomPosition()
    }, 10000 + Math.random() * 8000)

    const bubbleInterval = setInterval(() => {
      showRandomBubble()
    }, 15000 + Math.random() * 10000)

    return () => {
      clearInterval(moveInterval)
      clearInterval(bubbleInterval)
    }
  }, [isEnabled, isInitialized, moveToRandomPosition, showRandomBubble])

  // Handle window resize (optimized)
  useEffect(() => {
    const handleResize = () => {
      const boundaries = getSafeBoundaries()
      setPosition(prev => ({
        x: Math.min(Math.max(prev.x, boundaries.minX), boundaries.maxX),
        y: Math.min(Math.max(prev.y, boundaries.minY), boundaries.maxY)
      }))
    }

    window.addEventListener('resize', handleResize, { passive: true })
    return () => window.removeEventListener('resize', handleResize)
  }, [getSafeBoundaries])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current)
      if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current)
    }
  }, [])

  if (!isEnabled) return null

  return (
    <>
      {/* Speech Bubble - Fixed text direction */}
      {showBubble && (
        <div
          className="fixed pointer-events-none"
          style={{
            zIndex: 10001,
            left: position.x - 60,
            top: position.y - 70,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="relative">
            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 
                          shadow-lg animate-in fade-in zoom-in duration-300"
                 style={{ transform: 'scaleX(1)' }}>
              <p className="text-sm text-gray-800 whitespace-nowrap font-medium"
                 style={{ transform: 'scaleX(1)' }}>
                {bubbleText}
              </p>
            </div>
            {/* Speech bubble tail */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1"
                 style={{ transform: 'translateX(-50%) scaleX(1)' }}>
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-white/95"></div>
            </div>
          </div>
        </div>
      )}

      {/* Lili Walker */}
      <div
        className={cn(
          "fixed cursor-pointer select-none lili-walker",
          "hover:scale-110 active:scale-95",
          className
        )}
        style={{
          zIndex: 10000, // Higher than most elements but below speech bubble
          left: position.x,
          top: position.y,
          transform: `translateX(-50%) translateY(-50%) ${direction === 'left' ? 'scaleX(-1)' : ''}`,
          transition: `left var(--movement-duration, 1.5s) cubic-bezier(0.4, 0.0, 0.2, 1), top var(--movement-duration, 1.5s) cubic-bezier(0.4, 0.0, 0.2, 1), transform 0.3s ease-out`,
          willChange: 'left, top, transform',
          ['--movement-duration' as string]: '1.5s'
        } as React.CSSProperties}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Walking animation container */}
        <div className={cn(
          "relative transition-transform duration-300",
          isMoving && "lili-walking",
          isHovered && "lili-hover",
          !isMoving && "lili-idle"
        )}>
          <LiliAvatar 
            size="lg" 
            isAnimated={true}
            className="drop-shadow-lg"
          />
          
          {/* Movement indicator dots */}
          {isMoving && (
            <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-[#ff7842] rounded-full animate-pulse"></div>
                <div className="w-1.5 h-1.5 bg-[#ff7842] rounded-full animate-pulse delay-150"></div>
                <div className="w-1.5 h-1.5 bg-[#ff7842] rounded-full animate-pulse delay-300"></div>
              </div>
            </div>
          )}

          {/* Hover tooltip - Fixed text direction */}
          {isHovered && (
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 
                          bg-gray-900/90 text-white text-xs px-3 py-1.5 rounded-lg 
                          whitespace-nowrap animate-in fade-in zoom-in duration-200
                          shadow-lg border border-white/10 z-[10002]"
                 style={{ transform: 'translateX(-50%) scaleX(1)' }}>
              <span style={{ transform: 'scaleX(1)' }}>
                Click to chat with me! 💬
              </span>
            </div>
          )}

          {/* Enhanced sparkle trail when moving */}
          {isMoving && (
            <div className="absolute inset-0 pointer-events-none sparkle-trail">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-gradient-to-r from-[#ff7842] to-[#ff4d00] rounded-full"
                  style={{
                    left: `${15 + i * 12}%`,
                    top: `${25 + (i % 2) * 20}%`,
                    animation: `sparkle 1.5s ease-in-out infinite`,
                    animationDelay: `${i * 100}ms`
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Control toggle */}
      <button
        onClick={() => setIsWalkerEnabled(!isEnabled)}
        className="fixed bottom-20 right-4 p-2 bg-gray-800/80 hover:bg-gray-700/80 
                 text-white rounded-lg shadow-lg transition-all duration-200 backdrop-blur-sm
                 border border-white/10 text-xs"
        style={{ zIndex: 9998 }}
        title={isEnabled ? "Disable Lili walker" : "Enable Lili walker"}
      >
        {isEnabled ? "🚶‍♀️" : "⏸️"}
      </button>

      {/* Custom CSS Animations */}
      <style jsx>{`
        /* Smooth walking animation */
        .lili-walking {
          animation: walking 0.8s ease-in-out infinite;
        }

        .lili-hover {
          animation: hover 2s ease-in-out infinite;
        }

        .lili-idle {
          animation: idle 4s ease-in-out infinite;
        }

        .sparkle-trail {
          animation: trailGlow 1.5s ease-in-out infinite;
        }

        @keyframes walking {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg); 
          }
          25% { 
            transform: translateY(-2px) rotate(-1deg); 
          }
          50% { 
            transform: translateY(-1px) rotate(0deg); 
          }
          75% { 
            transform: translateY(-2px) rotate(1deg); 
          }
        }

        @keyframes hover {
          0%, 100% { 
            transform: translateY(0px) scale(1); 
          }
          50% { 
            transform: translateY(-3px) scale(1.05); 
          }
        }

        @keyframes idle {
          0%, 100% { 
            transform: translateY(0px); 
          }
          50% { 
            transform: translateY(-1px); 
          }
        }

        @keyframes sparkle {
          0% { 
            opacity: 0; 
            transform: scale(0) rotate(0deg); 
          }
          50% { 
            opacity: 1; 
            transform: scale(1) rotate(180deg); 
          }
          100% { 
            opacity: 0; 
            transform: scale(0) rotate(360deg); 
          }
        }

        @keyframes trailGlow {
          0%, 100% { 
            opacity: 0.7; 
          }
          50% { 
            opacity: 1; 
          }
        }

        /* Enhanced smooth transitions */
        .lili-walker {
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          --movement-duration: 2.5s; /* Slower default duration */
          transform: translateZ(0); /* GPU acceleration */
          backface-visibility: hidden;
        }

        .lili-walker:hover {
          filter: drop-shadow(0 8px 16px rgba(255, 120, 66, 0.3));
        }

        /* Mobile optimizations */
        @media (max-width: 768px) {
          .lili-walker {
            --movement-duration: 2.0s; /* Still slower on mobile */
          }
          
          .lili-walking {
            animation: walking 1.0s ease-in-out infinite; /* Slower walking animation */
          }
        }
      `}</style>
    </>
  )
} 