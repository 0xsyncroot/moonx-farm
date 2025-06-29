'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { aggregatorApi, QuoteResponse, Quote } from '@/lib/api-client'
import { useAuth } from './use-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useDebounce } from './use-debounce'
import { parseTokenAmount, formatTokenAmount } from '@/lib/utils'
import { Token } from './use-tokens'

interface QuoteRequest {
  fromToken: Token | null
  toToken: Token | null
  amount: string
  slippage?: number
}

export function useQuote() {
  const { walletInfo } = useAuth()
  const { client: smartWalletClient } = useSmartWallets()
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequest>({
    fromToken: null,
    toToken: null,
    amount: '',
    slippage: 1.0,
  })

  const debouncedAmount = useDebounce(quoteRequest.amount, 800) // Increased to prevent excessive API calls

  // Get Smart Wallet address (AA wallet) instead of EOA
  const smartWalletAddress = smartWalletClient?.account?.address

  // Build quote query key
  const queryKey = [
    'quote',
    quoteRequest.fromToken?.address,
    quoteRequest.toToken?.address,
    quoteRequest.fromToken?.chainId,
    quoteRequest.toToken?.chainId,
    debouncedAmount,
    quoteRequest.slippage,
    smartWalletAddress, // ✅ SỬA: Dùng Smart Wallet address
  ]

  // Check if quote request is valid
  const isValidRequest = 
    quoteRequest.fromToken &&
    quoteRequest.toToken &&
    debouncedAmount &&
    parseFloat(debouncedAmount) > 0 &&
    quoteRequest.fromToken.address !== quoteRequest.toToken.address &&
    smartWalletAddress // ✅ SỬA: Yêu cầu Smart Wallet address

  // Get quotes from aggregator service
  const {
    data: quoteResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['quote', quoteRequest.fromToken?.address, quoteRequest.toToken?.address, debouncedAmount, quoteRequest.fromToken?.chainId, quoteRequest.toToken?.chainId, quoteRequest.slippage, smartWalletAddress],
    queryFn: async () => {
      if (!quoteRequest.fromToken || !quoteRequest.toToken || !debouncedAmount || debouncedAmount === '0') {
        return null;
      }

      // Parse amount according to fromToken decimals for API
      const parsedAmount = parseTokenAmount(debouncedAmount, quoteRequest.fromToken.decimals)

      const response = await aggregatorApi.getQuote({
        fromChainId: quoteRequest.fromToken.chainId || 1,
        toChainId: quoteRequest.toToken.chainId || 1,
        fromToken: quoteRequest.fromToken.address,
        toToken: quoteRequest.toToken.address,
        amount: parsedAmount,
        slippage: quoteRequest.slippage,
        userAddress: smartWalletAddress, // ✅ SỬA: Truyền Smart Wallet address
      });
      
      return response
    },
    enabled: !!(
      quoteRequest.fromToken &&
      quoteRequest.toToken &&
      debouncedAmount &&
      debouncedAmount !== '0' &&
      smartWalletAddress // ✅ SỬA: Chỉ gọi API khi có Smart Wallet address
    ),
    staleTime: 25000, // 25 seconds
    refetchInterval: false, // ❌ DISABLE auto-refresh - manual only
    refetchOnWindowFocus: false,
  })

  // Select best quote (lowest gas fee + highest output)
  const bestQuote = useMemo(() => {
    if (!quoteResponse?.quotes || quoteResponse.quotes.length === 0) return null
    
    // Sort by best value (highest toAmount, lowest gas fee)
    const sortedQuotes = [...quoteResponse.quotes].sort((a, b) => {
      const aOutput = parseFloat(a.toAmount)
      const bOutput = parseFloat(b.toAmount)
      const aGasFee = parseFloat(a.gasEstimate?.gasFeeUSD?.toString() || '0')
      const bGasFee = parseFloat(b.gasEstimate?.gasFeeUSD?.toString() || '0')
      
      // Calculate net value (output - gas fee)
      const aNetValue = aOutput - (aGasFee * 1e18) // Convert USD to token units roughly
      const bNetValue = bOutput - (bGasFee * 1e18)
      
      return bNetValue - aNetValue // Higher net value first
    })
    
    return sortedQuotes[0]
  }, [quoteResponse])

  // All available quotes for comparison
  const allQuotes = quoteResponse?.quotes || []

  // ❌ REMOVED: Manual auto-refresh interval that was duplicating refetchInterval
  // Only refresh when quote expires (handled by countdown in SwapInterface)

  // Update quote request
  const updateQuoteRequest = useCallback((updates: Partial<QuoteRequest>) => {
    setQuoteRequest(prev => ({ ...prev, ...updates }))
  }, [])

  // Set tokens WITHOUT auto-amount to prevent excessive API calls
  const setFromToken = useCallback((token: Token | null) => {
    setQuoteRequest(prev => ({ ...prev, fromToken: token }))
  }, [])

  const setToToken = useCallback((token: Token | null) => {
    setQuoteRequest(prev => ({ ...prev, toToken: token }))
  }, [])

  // Set amount - clear default when user inputs manually
  const setAmount = useCallback((amount: string) => {
    updateQuoteRequest({ amount })
  }, [updateQuoteRequest])

  // Set slippage
  const setSlippage = useCallback((slippage: number) => {
    updateQuoteRequest({ slippage })
  }, [updateQuoteRequest])

  // Swap tokens
  const swapTokens = useCallback(() => {
    const bestQuoteToAmount = bestQuote?.toAmount
    const formattedAmount = bestQuoteToAmount && quoteRequest.toToken
      ? formatTokenAmount(bestQuoteToAmount, quoteRequest.toToken.decimals)
      : ''
    
    setQuoteRequest(prev => ({
      ...prev,
      fromToken: prev.toToken,
      toToken: prev.fromToken,
      amount: formattedAmount,
    }))
  }, [bestQuote, quoteRequest.toToken])

  // Calculate price impact color
  const getPriceImpactColor = (impact: number) => {
    if (impact < 1) return 'text-green-500'
    if (impact < 3) return 'text-yellow-500'
    if (impact < 5) return 'text-orange-500'
    return 'text-red-500'
  }

  // Calculate price impact severity
  const getPriceImpactSeverity = (impact: number): 'low' | 'medium' | 'high' | 'critical' => {
    if (impact < 1) return 'low'
    if (impact < 3) return 'medium'
    if (impact < 5) return 'high'
    return 'critical'
  }

  // Format exchange rate
  const getExchangeRate = () => {
    if (!bestQuote || !quoteRequest.fromToken || !quoteRequest.toToken) return null
    
    const fromAmount = formatTokenAmount(bestQuote.fromAmount, quoteRequest.fromToken.decimals)
    const toAmount = formatTokenAmount(bestQuote.toAmount, quoteRequest.toToken.decimals)
    const rate = parseFloat(toAmount) / parseFloat(fromAmount)
    
    return `1 ${quoteRequest.fromToken.symbol} = ${rate.toFixed(6)} ${quoteRequest.toToken.symbol}`
  }

  // Check if quote is expired
  const isExpired = bestQuote ? new Date(bestQuote.expiresAt) < new Date() : false

  // Calculate time until expiry
  const timeUntilExpiry = bestQuote ? 
    Math.max(0, new Date(bestQuote.expiresAt).getTime() - Date.now()) : 0

  return {
    // State
    fromToken: quoteRequest.fromToken,
    toToken: quoteRequest.toToken,
    amount: quoteRequest.amount,
    slippage: quoteRequest.slippage,

    // Quote data
    quote: bestQuote,
    allQuotes,
    quoteResponse,
    isLoading,
    error,
    isValidRequest,
    isExpired,
    timeUntilExpiry,
    lastUpdated: bestQuote?.createdAt ? new Date(bestQuote.createdAt).getTime() : null,

    // Actions
    setFromToken,
    setToToken,
    setAmount,
    setSlippage,
    swapTokens,
    refetch,

    // Computed values
    exchangeRate: getExchangeRate(),
    priceImpactColor: bestQuote ? getPriceImpactColor(parseFloat(bestQuote.priceImpact)) : null,
    priceImpactSeverity: bestQuote ? getPriceImpactSeverity(parseFloat(bestQuote.priceImpact)) : null,

    // Utilities
    getPriceImpactColor,
    getPriceImpactSeverity,
  }
} 