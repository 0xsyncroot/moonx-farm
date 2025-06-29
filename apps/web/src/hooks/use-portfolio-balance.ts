'use client'

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { coreApi } from '@/lib/api-client'
import { TokenHolding } from '@/types/core-api'

interface PortfolioBalance {
  totalValueUSD: number
  totalTokens: number
  holdings: TokenHolding[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook to get portfolio balance from core service
 * Fetches token holdings across all supported chains
 */
export function usePortfolioBalance(): PortfolioBalance {
  const { address: wagmiAddress } = useAccount()
  const { client: smartWalletClient } = useSmartWallets()
  
  // Prioritize smart wallet address over wagmi address
  const walletAddress = smartWalletClient?.account?.address || wagmiAddress

  const {
    data: portfolioData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['portfolio-balance', walletAddress],
    queryFn: async () => {
      if (!walletAddress) {
        throw new Error('No wallet address')
      }

      // Fetch portfolio from core service
      const response = await coreApi.getPortfolio({ 
        includeSpam: false, 
        minValueUSD: 0.01 
      })
      return response
    },
    enabled: !!walletAddress,
    // Refetch every 60 seconds
    refetchInterval: 60000,
    // Stale time of 30 seconds
    staleTime: 30000,
    // Keep previous data while refetching
    placeholderData: (previousData) => previousData,
    // Retry on error
    retry: 2,
    retryDelay: 1000,
  })

  // Calculate totals
  const portfolio = portfolioData?.data?.portfolio
  const totalValueUSD = portfolio?.totalValueUSD || 0
  const totalTokens = portfolio?.holdings?.length || 0

  return {
    totalValueUSD,
    totalTokens,
    holdings: portfolio?.holdings || [],
    isLoading,
    error: error as Error | null,
    refetch
  }
}

/**
 * Hook to get native token balance across all chains
 */
export function useNativeBalances(): Record<number, number> {
  const { address: wagmiAddress } = useAccount()
  const { client: smartWalletClient } = useSmartWallets()
  
  // Prioritize smart wallet address over wagmi address
  const walletAddress = smartWalletClient?.account?.address || wagmiAddress

  const {
    data: nativeBalances,
  } = useQuery({
    queryKey: ['native-balances', walletAddress],
    queryFn: async () => {
      if (!walletAddress) {
        return {}
      }

      // This would ideally fetch native balances from multiple chains
      // For now, return empty object
      return {}
    },
    enabled: !!walletAddress,
    refetchInterval: 30000,
    staleTime: 15000,
  })

  return nativeBalances || {}
}

/**
 * Format portfolio value for display
 */
export function formatPortfolioValue(value: number): string {
  if (value === 0) return '$0.00'
  
  if (value < 0.01) return '<$0.01'
  
  if (value < 1000) {
    return `$${value.toFixed(2)}`
  }
  
  if (value < 1000000) {
    return `$${(value / 1000).toFixed(1)}K`
  }
  
  return `$${(value / 1000000).toFixed(1)}M`
} 