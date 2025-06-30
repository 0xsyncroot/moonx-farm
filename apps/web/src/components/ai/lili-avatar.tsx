'use client'

import { useState, useEffect } from 'react'

interface LiliAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  isAnimated?: boolean
  className?: string
}

export function LiliAvatar({ size = 'md', isAnimated = true, className = '' }: LiliAvatarProps) {
  const [isBlinking, setIsBlinking] = useState(false)

  // Blinking animation
  useEffect(() => {
    if (!isAnimated) return

    const blinkInterval = setInterval(() => {
      setIsBlinking(true)
      setTimeout(() => setIsBlinking(false), 150)
    }, 3000 + Math.random() * 2000) // Random blinking every 3-5 seconds

    return () => clearInterval(blinkInterval)
  }, [isAnimated])

  const sizes = {
    xs: 16,
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64
  }

  const avatarSize = sizes[size]

  return (
    <div className={`lili-avatar ${className}`} style={{ width: avatarSize, height: avatarSize }}>
      <svg
        width={avatarSize}
        height={avatarSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={isAnimated ? 'animate-float' : ''}
      >
        {/* Glow Effect */}
        <defs>
          <radialGradient id="glowGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff7842" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ff7842" stopOpacity="0" />
          </radialGradient>
          
          <linearGradient id="hairGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff9a6b" />
            <stop offset="50%" stopColor="#ff7842" />
            <stop offset="100%" stopColor="#ff5722" />
          </linearGradient>
          
          <linearGradient id="skinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffeaa7" />
            <stop offset="100%" stopColor="#fdcb6e" />
          </linearGradient>
          
          <linearGradient id="eyeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#74b9ff" />
            <stop offset="100%" stopColor="#0984e3" />
          </linearGradient>

          {/* Sparkle Animation */}
          <g id="sparkle">
            <path d="M2,2 L2,6 M0,4 L4,4" stroke="#fff" strokeWidth="0.5" opacity="0.8">
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 2 4;360 2 4"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.8;0.3;0.8"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </path>
          </g>
        </defs>

        {/* Background Glow */}
        <circle cx="32" cy="32" r="30" fill="url(#glowGradient)" />

        {/* Hair Background */}
        <path
          d="M32 8 C22 8, 16 14, 16 22 L16 28 C16 30, 18 32, 20 32 L44 32 C46 32, 48 30, 48 28 L48 22 C48 14, 42 8, 32 8 Z"
          fill="url(#hairGradient)"
        />

        {/* Hair Details */}
        <path
          d="M24 16 C26 12, 30 10, 32 10 C34 10, 38 12, 40 16"
          stroke="#ff5722"
          strokeWidth="0.5"
          fill="none"
          opacity="0.6"
        />

        {/* Face */}
        <ellipse
          cx="32"
          cy="35"
          rx="12"
          ry="14"
          fill="url(#skinGradient)"
        />

        {/* Eyes */}
        <g className="eyes">
          {/* Left Eye */}
          <ellipse
            cx="28"
            cy="32"
            rx="3"
            ry={isBlinking ? "0.5" : "4"}
            fill="url(#eyeGradient)"
            style={{ transition: 'all 0.15s ease' }}
          />
          {!isBlinking && (
            <>
              <ellipse cx="28" cy="30" rx="1.5" ry="2" fill="#fff" opacity="0.9" />
              <circle cx="28.5" cy="30.5" r="0.5" fill="#fff" />
            </>
          )}

          {/* Right Eye */}
          <ellipse
            cx="36"
            cy="32"
            rx="3"
            ry={isBlinking ? "0.5" : "4"}
            fill="url(#eyeGradient)"
            style={{ transition: 'all 0.15s ease' }}
          />
          {!isBlinking && (
            <>
              <ellipse cx="36" cy="30" rx="1.5" ry="2" fill="#fff" opacity="0.9" />
              <circle cx="36.5" cy="30.5" r="0.5" fill="#fff" />
            </>
          )}
        </g>

        {/* Eyebrows */}
        <path d="M25 28 Q28 26 31 28" stroke="#ff5722" strokeWidth="1" fill="none" strokeLinecap="round" />
        <path d="M33 28 Q36 26 39 28" stroke="#ff5722" strokeWidth="1" fill="none" strokeLinecap="round" />

        {/* Nose */}
        <ellipse cx="32" cy="36" rx="0.8" ry="1.2" fill="#fdcb6e" opacity="0.6" />

        {/* Mouth */}
        <path
          d="M29 40 Q32 43 35 40"
          stroke="#e17055"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Cheek Blush */}
        <ellipse cx="24" cy="38" rx="2" ry="1.5" fill="#ff7675" opacity="0.3" />
        <ellipse cx="40" cy="38" rx="2" ry="1.5" fill="#ff7675" opacity="0.3" />

        {/* Hair Front Strands */}
        <path
          d="M20 20 Q18 24 20 28"
          stroke="url(#hairGradient)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M44 20 Q46 24 44 28"
          stroke="url(#hairGradient)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />

        {/* Hair Accessories - Small bow */}
        <g transform="translate(38, 18)">
          <path d="M0 0 L4 2 L0 4 L2 2 Z" fill="#ff6b9d" />
          <path d="M4 0 L8 2 L4 4 L6 2 Z" fill="#ff6b9d" />
          <circle cx="4" cy="2" r="1" fill="#ff3838" />
        </g>

        {/* Sparkles around head */}
        {isAnimated && (
          <g className="sparkles">
            <use href="#sparkle" transform="translate(18, 15)" />
            <use href="#sparkle" transform="translate(46, 20)" />
            <use href="#sparkle" transform="translate(15, 35)" />
            <use href="#sparkle" transform="translate(49, 38)" />
            <use href="#sparkle" transform="translate(25, 12)" />
          </g>
        )}

        {/* Floating Heart (occasional) */}
        {isAnimated && (
          <g className="floating-heart" opacity="0">
            <path
              d="M32 50 C32 50, 29 47, 27 45 C25 43, 25 41, 27 41 C28 41, 29 42, 32 45 C35 42, 36 41, 37 41 C39 41, 39 43, 37 45 C35 47, 32 50, 32 50 Z"
              fill="#ff6b9d"
            >
              <animate
                attributeName="opacity"
                values="0;0.7;0"
                dur="3s"
                begin="0s"
                repeatCount="indefinite"
              />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0,0;0,-10;0,-20"
                dur="3s"
                begin="0s"
                repeatCount="indefinite"
              />
            </path>
          </g>
        )}
      </svg>

      {/* CSS Animations */}
      <style jsx>{`
        .lili-avatar {
          display: inline-block;
          transition: all 0.3s ease;
        }
        
        .lili-avatar:hover {
          transform: scale(1.05);
        }
        
        .animate-float {
          animation: gentleFloat 3s ease-in-out infinite;
        }
        
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-2px) rotate(1deg); }
        }
        
        .sparkles {
          animation: sparkleRotate 8s linear infinite;
        }
        
        @keyframes sparkleRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .floating-heart {
          animation: heartFloat 5s ease-in-out infinite;
          animation-delay: 2s;
        }
        
        @keyframes heartFloat {
          0%, 90%, 100% { opacity: 0; transform: translateY(0); }
          10%, 80% { opacity: 0.7; transform: translateY(-15px); }
        }
      `}</style>
    </div>
  )
} 