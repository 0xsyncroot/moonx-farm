'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { aggregatorApi } from '@/lib/api-client'
import { useAuth } from './use-auth'
import { useDebounce } from './use-debounce'
import { Token } from './use-tokens'

interface QuoteRequest {
  fromToken: Token | null
  toToken: Token | null
  amount: string
  slippage?: number
}

interface Quote {
  id: string
  provider: string
  fromAmount: number
  toAmount: number
  toAmountMin: number
  price: number
  priceImpact: number
  slippageTolerance: number
  gasEstimate: {
    gasLimit: number
    gasPrice: number
    gasFee: number
    gasFeeUSD: number
  }
  route: {
    steps: Array<{
      type: string
      protocol: string
      fromToken: Token
      toToken: Token
      fromAmount: number
      toAmount: number
      fee: number
      priceImpact: number
    }>
    totalFee: number
    gasEstimate: any
  }
  callData: string
  to: string
  value: string
  createdAt: string
  expiresAt: string
}

export function useQuote() {
  const { walletInfo } = useAuth()
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequest>({
    fromToken: null,
    toToken: null,
    amount: '',
    slippage: 1.0,
  })

  const debouncedAmount = useDebounce(quoteRequest.amount, 500)

  // Build quote query key
  const queryKey = [
    'quote',
    quoteRequest.fromToken?.address,
    quoteRequest.toToken?.address,
    quoteRequest.fromToken?.chainId,
    quoteRequest.toToken?.chainId,
    debouncedAmount,
    quoteRequest.slippage,
    walletInfo?.address,
  ]

  // Check if quote request is valid
  const isValidRequest = 
    quoteRequest.fromToken &&
    quoteRequest.toToken &&
    debouncedAmount &&
    parseFloat(debouncedAmount) > 0 &&
    quoteRequest.fromToken.address !== quoteRequest.toToken.address

  // Get quote from aggregator service
  const {
    data: quote,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['quote', quoteRequest.fromToken?.address, quoteRequest.toToken?.address, debouncedAmount, quoteRequest.fromToken?.chainId, quoteRequest.toToken?.chainId, quoteRequest.slippage],
    queryFn: async () => {
      if (!quoteRequest.fromToken || !quoteRequest.toToken || !debouncedAmount || debouncedAmount === '0') {
        return null;
      }

      return aggregatorApi.getQuote({
        fromChainId: quoteRequest.fromToken.chainId || 1,
        toChainId: quoteRequest.toToken.chainId || 1,
        fromToken: quoteRequest.fromToken.address,
        toToken: quoteRequest.toToken.address,
        amount: debouncedAmount,
        slippage: quoteRequest.slippage,
      });
    },
    enabled: !!(
      quoteRequest.fromToken &&
      quoteRequest.toToken &&
      debouncedAmount &&
      debouncedAmount !== '0'
    ),
    staleTime: 15000, // 15 seconds
    refetchInterval: 30000, // Auto refresh every 30 seconds
    refetchOnWindowFocus: false,
  })

  // Auto-refresh quote every 15 seconds
  useEffect(() => {
    if (!isValidRequest) return

    const interval = setInterval(() => {
      refetch()
    }, 15000)

    return () => clearInterval(interval)
  }, [isValidRequest, refetch])

  // Update quote request
  const updateQuoteRequest = useCallback((updates: Partial<QuoteRequest>) => {
    setQuoteRequest(prev => ({ ...prev, ...updates }))
  }, [])

  // Set tokens
  const setFromToken = useCallback((token: Token | null) => {
    updateQuoteRequest({ fromToken: token })
  }, [updateQuoteRequest])

  const setToToken = useCallback((token: Token | null) => {
    updateQuoteRequest({ toToken: token })
  }, [updateQuoteRequest])

  // Set amount
  const setAmount = useCallback((amount: string) => {
    updateQuoteRequest({ amount })
  }, [updateQuoteRequest])

  // Set slippage
  const setSlippage = useCallback((slippage: number) => {
    updateQuoteRequest({ slippage })
  }, [updateQuoteRequest])

  // Swap tokens
  const swapTokens = useCallback(() => {
    setQuoteRequest(prev => ({
      ...prev,
      fromToken: prev.toToken,
      toToken: prev.fromToken,
      amount: quote?.toAmount.toString() || '',
    }))
  }, [quote])

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
    if (!quote || !quoteRequest.fromToken || !quoteRequest.toToken) return null
    
    const rate = quote.toAmount / quote.fromAmount
    return `1 ${quoteRequest.fromToken.symbol} = ${rate.toFixed(6)} ${quoteRequest.toToken.symbol}`
  }

  // Check if quote is expired
  const isExpired = quote ? new Date(quote.expiresAt) < new Date() : false

  // Calculate time until expiry
  const timeUntilExpiry = quote ? 
    Math.max(0, new Date(quote.expiresAt).getTime() - Date.now()) : 0

  return {
    // State
    fromToken: quoteRequest.fromToken,
    toToken: quoteRequest.toToken,
    amount: quoteRequest.amount,
    slippage: quoteRequest.slippage,

    // Quote data
    quote,
    isLoading,
    error,
    isValidRequest,
    isExpired,
    timeUntilExpiry,
    lastUpdated: quote?.createdAt ? new Date(quote.createdAt).getTime() : null,

    // Actions
    setFromToken,
    setToToken,
    setAmount,
    setSlippage,
    swapTokens,
    refetch,

    // Computed values
    exchangeRate: getExchangeRate(),
    priceImpactColor: quote ? getPriceImpactColor(quote.priceImpact) : null,
    priceImpactSeverity: quote ? getPriceImpactSeverity(quote.priceImpact) : null,

    // Utilities
    getPriceImpactColor,
    getPriceImpactSeverity,
  }
} 