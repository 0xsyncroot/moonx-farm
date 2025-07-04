'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useTestnet } from '@/hooks/use-testnet'
import { SwapInterface } from './swap-interface'
import { SwapInterfaceShimmer, SwapInterfaceProgressiveShimmer } from './swap-interface-shimmer'

interface SwapInterfaceWrapperProps {
  className?: string
}

/**
 * Wrapper component for SwapInterface that handles loading states at a higher level
 * This can be used in pages or layouts to show shimmer before the main component loads
 */
export function SwapInterfaceWrapper({ className }: SwapInterfaceWrapperProps) {
  const { isLoading: isAuthLoading, isAuthenticated } = useAuth()
  const { isHydrated, isTestnetSwitching } = useTestnet()
  const [isClientMounted, setIsClientMounted] = useState(false)

  useEffect(() => {
    setIsClientMounted(true)
  }, [])

  // Show shimmer while waiting for client to mount (SSR hydration) - ONLY during hydration
  if (!isClientMounted) {
    return (
      <SwapInterfaceProgressiveShimmer
        loadingStage="initialization"
        className="animate-pulse"
      />
    )
  }

  // Show shimmer while auth is loading - ONLY when actually loading, not when just unauthenticated
  if (isAuthLoading && !isAuthenticated) {
    return (
      <SwapInterfaceProgressiveShimmer
        loadingStage="initialization"
        className="animate-pulse"
      />
    )
  }

  // Show shimmer while testnet is switching
  if (isTestnetSwitching) {
    return (
      <SwapInterfaceShimmer
        showCrossChainIndicator={false}
        className="animate-pulse"
      />
    )
  }

  // Show shimmer while app is hydrating
  if (!isHydrated) {
    return (
      <SwapInterfaceProgressiveShimmer
        loadingStage="tokens"
        className="animate-pulse"
      />
    )
  }

  // Render the actual SwapInterface when everything is ready
  return (
    <div className={className}>
      <SwapInterface />
    </div>
  )
} 