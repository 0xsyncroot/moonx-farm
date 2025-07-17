'use client'

import { useState, useEffect, useCallback } from 'react'
import { coreApi } from '@/lib/api-client'

// Types for token holdings (simplified)
interface TokenHolding {
  // Core holding data
  tokenSymbol: string
  tokenName: string
  tokenAddress: string
  chainId: number
  balance: string
  balanceFormatted: number
  balanceUSD: number
  priceUSD: number
  
  // Enhanced fields
  positionType: 'SPOT' | 'STAKED' | 'LP' | 'YIELD' | 'BRIDGE' | 'LOCKED'
  logoUrl?: string
  isVerified: boolean
  isScam: boolean
  securityScore: number
  riskScore: number
  
  // Legacy compatibility
  valueUSD?: number
  isSpam?: boolean
}

export function useTokenHoldings() {
  const [holdings, setHoldings] = useState<TokenHolding[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number>(0)

  // Fixed fetch function - use correct API endpoint
  const fetchTokenHoldings = useCallback(async () => {
    try {
      console.log('💼 Fetching token holdings from portfolio API...')
      
      // Use getPortfolio instead of non-existent getTokenHoldings
      const response = await coreApi.getPortfolio({ 
        includeSpam: false, 
        includeUnverified: false,
        hideSmallBalances: true,
        sortBy: 'value',
        sortOrder: 'desc',
        limit: 500
      })
      
      console.log('💼 Portfolio response:', response)
      
      if (response.success && response.data) {
        // Extract holdings from portfolio response
        const portfolioData = response.data
        
        // Portfolio response should have a holdings array
        let holdings: TokenHolding[] = []
        
        if (portfolioData.holdings && Array.isArray(portfolioData.holdings)) {
          holdings = portfolioData.holdings.map((holding: any) => ({
            // Core fields
            tokenSymbol: holding.tokenSymbol,
            tokenName: holding.tokenName,
            tokenAddress: holding.tokenAddress,
            chainId: holding.chainId,
            balance: holding.balance || holding.balanceRaw || '0',
            balanceFormatted: holding.balanceFormatted || 0,
            balanceUSD: holding.balanceUSD || 0,
            priceUSD: holding.priceUSD || 0,
            
            // Enhanced fields with defaults
            positionType: holding.positionType || 'SPOT',
            logoUrl: holding.logoUrl,
            isVerified: holding.isVerified || false,
            isScam: holding.isScam || false,
            securityScore: holding.securityScore || 50,
            riskScore: holding.riskScore || 30,
            
            // Legacy compatibility
            valueUSD: holding.balanceUSD || holding.valueUSD || 0,
            isSpam: holding.isScam || holding.isSpam || false
          }))
        } else {
          console.warn('💼 No holdings array in portfolio response:', portfolioData)
          return []
        }
        
        console.log('💼 Holdings extracted from portfolio:', { count: holdings.length })
        return holdings
      }
      
      console.warn('Portfolio API failed:', response.message || 'Unknown error')
      return []
    } catch (error) {
      console.error('❌ Portfolio fetch error:', error)
      throw error
    }
  }, [])

  // Load holdings data
  const loadHoldings = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true)
      }
      setError(null)

      const holdingsData = await fetchTokenHoldings()
      
      // Always set holdings array (even if empty) to prevent UI issues
      setHoldings(holdingsData || [])
      setLastUpdated(Date.now())
      
      console.log('✅ Holdings loaded successfully:', { count: holdingsData?.length || 0 })
    } catch (error) {
      console.error('❌ Failed to load holdings:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to load holdings'
      setError(errorMessage)
      
      // Don't clear existing holdings on error - keep last known state
      // This prevents UI from jumping between empty and populated states
      console.log('🔄 Keeping existing holdings on error:', { existingCount: holdings.length })
    } finally {
      if (showLoading) {
        setIsLoading(false)
      }
    }
  }, [fetchTokenHoldings, holdings.length])

  // Manual refresh
  const refreshData = useCallback(async () => {
    try {
      setRefreshing(true)
      setError(null)
      await loadHoldings(false)
    } catch (error) {
      console.error('Failed to refresh holdings:', error)
      // Error is already handled in loadHoldings
    } finally {
      setRefreshing(false)
    }
  }, [loadHoldings])

  // Load data on mount
  useEffect(() => {
    console.log('🚀 Initial holdings load')
    loadHoldings()
  }, [loadHoldings])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading && !refreshing) {
        console.log('⏰ Auto-refresh holdings')
        loadHoldings(false)
      }
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [isLoading, refreshing, loadHoldings])

  return {
    // Data
    holdings,
    isLoading,
    error,
    refreshing,
    
    // Actions
    refresh: refreshData,
    
    // Status
    lastUpdated,
    cacheAge: lastUpdated ? Date.now() - lastUpdated : 0,
  }
} 