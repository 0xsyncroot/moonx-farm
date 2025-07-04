'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useAuth } from '@/hooks/use-auth'
import { Token, coreApi } from '@/lib/api-client'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useSwap } from '@/hooks/use-swap'
import { cn } from '@/lib/utils'
import type { Quote } from '@/lib/api-client'
import React, { useCallback, useRef, useEffect, useMemo, useState } from 'react'

// Global execution lock to prevent ANY duplicate calls
const globalExecutionLock = {
  isExecuting: false,
  lastExecutionTime: 0,
  currentQuoteId: null as string | null,
  setLock: function(quoteId: string) {
    this.isExecuting = true
    this.lastExecutionTime = Date.now()
    this.currentQuoteId = quoteId
  },
  releaseLock: function() {
    this.isExecuting = false
    this.currentQuoteId = null
  },
  canExecute: function(quoteId: string) {
    const now = Date.now()
    // Allow if not executing, or if enough time has passed, or if it's a different quote
    return !this.isExecuting || (now - this.lastExecutionTime) > 3000 || this.currentQuoteId !== quoteId
  }
}

// Enhanced Button component with better loading states
const Button = ({ children, onClick, disabled, variant, size, className, loading }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: string
  size?: string
  className?: string
  loading?: boolean
}) => {
  // Prevent double-clicking with a ref to track last click
  const lastClickRef = useRef(0)
  
  const handleClick = useCallback(() => {
    if (disabled || loading) return
    
    const now = Date.now()
    if (now - lastClickRef.current < 500) return // 500ms debounce - reduced for better UX
    
    lastClickRef.current = now
    onClick?.()
  }, [onClick, disabled, loading])

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={cn(
        'relative px-6 py-4 rounded-xl font-semibold transition-all duration-300 transform overflow-hidden',
        'disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none',
        'active:scale-[0.98] hover:scale-[1.02]',
        variant === 'destructive' 
          ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25' 
          : variant === 'secondary' 
          ? 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white shadow-lg shadow-gray-500/25'
          : 'bg-gradient-to-r from-[#ff7842] to-[#ff4d00] hover:from-[#ff4d00] hover:to-[#e63900] text-white shadow-lg shadow-orange-500/25',
        loading && 'cursor-wait',
        className
      )}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
      
      {/* Shimmer effect for loading */}
      {loading && (
        <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
      )}
      
      <span className={cn('flex items-center justify-center gap-2', loading && 'opacity-70')}>
        {children}
      </span>
    </button>
  )
}

// Enhanced icons with better styling
const AlertTriangle = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
)

const Check = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

const X = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const Loader = ({ className }: { className: string }) => (
  <svg className={cn("animate-spin", className)} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

interface SwapButtonProps {
  fromToken: Token | null
  toToken: Token | null
  fromAmount: string
  quote: Quote | null
  disabled: boolean
  priceImpactTooHigh: boolean
  hasInsufficientBalance?: boolean
  onPauseCountdown?: (reason?: 'swap' | 'approval') => void
  onResumeCountdown?: (reason?: 'cancelled' | 'completed' | 'error') => void
  smartWalletClient?: any // Smart wallet client from auto chain switch
  // 🚀 NEW: Jupiter-style post-swap callbacks
  onBalanceReload?: () => void
  onInputReset?: () => void
  onSwapSuccess?: (hash: string, quote: Quote) => void
}

export function SwapButton({
  fromToken,
  toToken,
  fromAmount,
  quote,
  disabled,
  priceImpactTooHigh,
  hasInsufficientBalance = false,
  onPauseCountdown,
  onResumeCountdown,
  smartWalletClient: customSmartWalletClient,
  // 🚀 NEW: Jupiter-style post-swap callbacks
  onBalanceReload,
  onInputReset,
  onSwapSuccess
}: SwapButtonProps) {
  const { user, login, createWallet } = usePrivy()
  const { client: defaultSmartWalletClient } = useSmartWallets()
  const smartWalletClient = customSmartWalletClient || defaultSmartWalletClient
  const { 
    executeSwap, 
    swapState, 
    canSwap, 
    resetSwapState, 
    isSwapping, 
    setOnSwapComplete,
    setOnSwapSuccess,
    setOnBalanceReload,
    setOnInputReset,
    setUserInteracting
  } = useSwap(smartWalletClient)

  // Track current quote ID for state management
  const currentQuoteIdRef = useRef<string | null>(null)
  
  // 🚀 JUPITER-STYLE: Track user interaction with success state
  const [isSuccessInteracting, setIsSuccessInteracting] = useState(false)
  const successInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // 🚀 KEY IMPROVEMENT: Auto-reset states when tokens or amounts change (Jupiter-style)
  const resetStateKey = useMemo(() => {
    return `${fromToken?.address || ''}_${toToken?.address || ''}_${fromAmount || ''}`
  }, [fromToken?.address, toToken?.address, fromAmount])

  const lastResetKeyRef = useRef<string>('')
  
  useEffect(() => {
    // Reset swap state when tokens or amounts change (like Jupiter)
    if (resetStateKey !== lastResetKeyRef.current && lastResetKeyRef.current !== '') {
      console.log('🔄 Auto-resetting swap state due to token/amount change:', {
        old: lastResetKeyRef.current,
        new: resetStateKey,
        swapStep: swapState.step
      })
      
      // 🚀 JUPITER-STYLE: NEVER reset during active states or success display
      // Allow user to see success message and transaction details
      if (swapState.step !== 'approving' && 
          swapState.step !== 'swapping' && 
          swapState.step !== 'success') { // 🔧 FIX: Don't reset success state
        resetSwapState()
        // Release global lock if held
        if (globalExecutionLock.isExecuting) {
          globalExecutionLock.releaseLock()
        }
      } else if (swapState.step === 'success') {
        // 🚀 JUPITER-STYLE: For success state, only update the reset key
        // The success state will auto-clear after its own timeout
        console.log('📌 Preserving success state, will auto-clear after timeout')
      }
    }
    lastResetKeyRef.current = resetStateKey
  }, [resetStateKey, swapState.step, resetSwapState])

  // 🚀 ENHANCED: Setup post-swap callbacks
  useEffect(() => {
    // General cleanup callback
    setOnSwapComplete(() => {
      console.log('🏁 Swap completed:', { quoteId: currentQuoteIdRef.current })
      
      // Always release global lock when swap completes
      if (globalExecutionLock.isExecuting) {
        globalExecutionLock.releaseLock()
      }
      
      currentQuoteIdRef.current = null
    })
    
    // Balance reload callback
    if (onBalanceReload) {
      setOnBalanceReload(onBalanceReload)
    }
    
    // Input reset callback
    if (onInputReset) {
      setOnInputReset(onInputReset)
    }
    
    // Success callback with trade recording
    if (onSwapSuccess) {
      setOnSwapSuccess(async (hash: string, quote: Quote) => {
        console.log('🎉 Swap successful, recording trade:', {
          hash,
          fromToken: quote.fromToken?.symbol,
          toToken: quote.toToken?.symbol,
          fromAmount: quote.fromAmount,
          toAmount: quote.toAmount
        })
        
                  // 🆕 Record trade in database for P&L tracking
          try {
            const tradeData = {
              walletAddress: smartWalletClient?.account?.address,
              txHash: hash,
              chainId: quote.fromToken?.chainId || 1,
              type: 'swap',
              fromToken: {
                symbol: quote.fromToken?.symbol || 'Unknown',
                name: quote.fromToken?.name || quote.fromToken?.symbol || 'Unknown',
                address: quote.fromToken?.address || '',
                decimals: quote.fromToken?.decimals || 18,
                amount: quote.fromAmount || '0',
                amountFormatted: parseFloat(quote.fromAmount || '0') / Math.pow(10, quote.fromToken?.decimals || 18),
                priceUSD: quote.fromToken?.priceUSD || 0,
                valueUSD: (quote.fromToken?.priceUSD || 0) * (parseFloat(quote.fromAmount || '0') / Math.pow(10, quote.fromToken?.decimals || 18))
              },
              toToken: {
                symbol: quote.toToken?.symbol || 'Unknown',
                name: quote.toToken?.name || quote.toToken?.symbol || 'Unknown',
                address: quote.toToken?.address || '',
                decimals: quote.toToken?.decimals || 18,
                amount: quote.toAmount || '0',
                amountFormatted: parseFloat(quote.toAmount || '0') / Math.pow(10, quote.toToken?.decimals || 18),
                priceUSD: quote.toToken?.priceUSD || 0,
                valueUSD: (quote.toToken?.priceUSD || 0) * (parseFloat(quote.toAmount || '0') / Math.pow(10, quote.toToken?.decimals || 18))
              },
              gasFeeETH: 0, // Will be updated by backend from tx receipt
              gasFeeUSD: 0, // Will be calculated by backend
              dexName: quote.metadata?.tool || quote.provider || 'Unknown',
              slippage: quote.slippageTolerance || 0.5,
              executedAt: new Date().toISOString()
            }
          
          // Call core-service to record trade using api-client
          const result = await coreApi.recordTrade(tradeData)
          
          console.log('✅ Trade recorded successfully:', {
            tradeId: result.data?.trade?.id,
            txHash: hash,
            pnl: result.data?.trade?.pnl
          })
          
          // Call original success callback
          onSwapSuccess(hash, quote)
          
        } catch (error) {
          console.error('❌ Failed to record trade:', error)
          // Don't fail the swap success, just log the error
          // User's swap was successful, we just couldn't record it
          
          // Still call original success callback
          onSwapSuccess(hash, quote)
        }
      })
    }
    
    return () => {
      setOnSwapComplete(null)
      setOnBalanceReload(null)
      setOnInputReset(null)
      setOnSwapSuccess(null)
      
      // 🚀 CLEANUP: Clear interaction timeout to prevent memory leaks
      if (successInteractionTimeoutRef.current) {
        clearTimeout(successInteractionTimeoutRef.current)
      }
    }
  }, [setOnSwapComplete, setOnBalanceReload, setOnInputReset, setOnSwapSuccess, onBalanceReload, onInputReset, onSwapSuccess, smartWalletClient?.account?.address])

  // 🚀 KEY IMPROVEMENT: Jupiter-style state tracking for countdown control
  useEffect(() => {
    if (swapState.step === 'approving' && onPauseCountdown) {
      onPauseCountdown('approval')
    } else if (swapState.step === 'swapping' && onPauseCountdown) {
      onPauseCountdown('swap')
    } else if (swapState.step === 'cancelled' && onResumeCountdown) {
      onResumeCountdown('cancelled')
    } else if (swapState.step === 'error' && onResumeCountdown) {
      onResumeCountdown('error')
    } else if (swapState.step === 'success' && onResumeCountdown) {
      onResumeCountdown('completed')
    } else if (swapState.step === 'idle' && onResumeCountdown) {
      // Resume countdown when returning to idle state
      onResumeCountdown('cancelled')
    }
  }, [swapState.step, onPauseCountdown, onResumeCountdown])

  // Memoized callback functions to prevent re-creation on every render
  const handleLogin = useCallback(() => {
    if (isSwapping) return
    login()
  }, [login, isSwapping])

  const handleCreateWallet = useCallback(() => {
    if (isSwapping) return
    createWallet()
  }, [createWallet, isSwapping])

  const handleSwap = useCallback(async () => {
    if (!quote || isSwapping) {
      console.warn('❌ Cannot execute swap:', { hasQuote: !!quote, isSwapping })
      return
    }

    // Enhanced quote validation
    const isQuoteValid = !!(
      quote.id &&
      quote.callData &&
      quote.fromToken?.address &&
      quote.toToken?.address &&
      quote.fromAmount &&
      quote.toAmount &&
      quote.provider &&
      quote.value !== undefined
    )
    
    if (!isQuoteValid) {
      console.error('❌ Quote validation failed:', {
        id: quote.id,
        provider: quote.provider,
        hasCallData: !!quote.callData,
        hasFromToken: !!quote.fromToken?.address,
        hasToToken: !!quote.toToken?.address,
        hasFromAmount: !!quote.fromAmount,
        hasToAmount: !!quote.toAmount,
        hasValue: quote.value !== undefined
      })
      return
    }

    // Global lock check with quote ID tracking
    if (!globalExecutionLock.canExecute(quote.id)) {
      console.warn('🔒 Global execution lock prevents swap execution for quote:', quote.id)
      return
    }
    
    console.log('🚀 Executing swap with validated quote:', {
      id: quote.id,
      provider: quote.provider,
      fromToken: quote.fromToken?.symbol,
      toToken: quote.toToken?.symbol,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount
    })
    
    // Set tracking vars
    currentQuoteIdRef.current = quote.id
    globalExecutionLock.setLock(quote.id)
    
    try {
      await executeSwap(quote)
    } catch (error) {
      console.error('Swap execution error:', error)
      // Release lock on immediate error
      globalExecutionLock.releaseLock()
      currentQuoteIdRef.current = null
    }
  }, [quote, executeSwap, isSwapping])

  // 🚀 KEY IMPROVEMENT: Enhanced retry with better error handling
  const handleRetrySwap = useCallback(async () => {
    if (!quote || isSwapping) {
      console.warn('❌ Cannot retry swap:', { hasQuote: !!quote, isSwapping })
      return
    }

    // Enhanced quote validation for retry
    const isQuoteValid = !!(
      quote.id &&
      quote.callData &&
      quote.fromToken?.address &&
      quote.toToken?.address &&
      quote.fromAmount &&
      quote.toAmount &&
      quote.provider &&
      quote.value !== undefined
    )
    
    if (!isQuoteValid) {
      console.error('❌ Quote validation failed for retry:', {
        id: quote.id,
        provider: quote.provider,
        missingFields: {
          callData: !quote.callData,
          fromToken: !quote.fromToken?.address,
          toToken: !quote.toToken?.address,
          fromAmount: !quote.fromAmount,
          toAmount: !quote.toAmount,
          value: quote.value === undefined
        }
      })
      return
    }

    // Global lock check for retry
    if (!globalExecutionLock.canExecute(quote.id)) {
      console.warn('🔒 Global execution lock prevents retry for quote:', quote.id)
      return
    }
    
    console.log('🔄 Retrying swap with validated quote:', {
      id: quote.id,
      provider: quote.provider,
      fromToken: quote.fromToken?.symbol,
      toToken: quote.toToken?.symbol
    })
    
    // Reset state first
    resetSwapState()
    
    // Small delay to ensure state is reset
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Set tracking vars
    currentQuoteIdRef.current = quote.id
    globalExecutionLock.setLock(quote.id)
    
    try {
      await executeSwap(quote)
    } catch (error) {
      console.error('Retry swap execution error:', error)
      // Release lock on immediate error
      globalExecutionLock.releaseLock()
      currentQuoteIdRef.current = null
    }
  }, [quote, resetSwapState, executeSwap, isSwapping])

  const handleResetError = useCallback(() => {
    console.log('🔄 Resetting error state')
    resetSwapState()
    // Release global lock if held
    if (globalExecutionLock.isExecuting) {
      globalExecutionLock.releaseLock()
    }
    currentQuoteIdRef.current = null
  }, [resetSwapState])

  // 🚀 KEY IMPROVEMENT: Enhanced button state logic (Jupiter-style)
  const buttonState = useMemo(() => {
    // Authentication states
    if (!user) {
      return {
        text: 'Connect Wallet',
        variant: 'default' as const,
        action: handleLogin,
        disabled: false,
        loading: false
      }
    }

    if (!smartWalletClient?.account?.address && user) {
      return {
        text: 'Create Smart Wallet',
        variant: 'default' as const,
        action: handleCreateWallet,
        disabled: false,
        loading: false
      }
    }

    // Validation states
    if (!fromToken || !toToken) {
      return {
        text: 'Select Tokens',
        variant: 'secondary' as const,
        action: () => {},
        disabled: true,
        loading: false
      }
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      return {
        text: 'Enter Amount',
        variant: 'secondary' as const,
        action: () => {},
        disabled: true,
        loading: false
      }
    }

    if (hasInsufficientBalance) {
      return {
        text: 'Insufficient Balance',
        variant: 'destructive' as const,
        action: () => {},
        disabled: true,
        loading: false
      }
    }

    if (!quote) {
      return {
        text: 'Getting Quote...',
        variant: 'secondary' as const,
        action: () => {},
        disabled: true,
        loading: true
      }
    }

    if (priceImpactTooHigh) {
      return {
        text: 'Price Impact Too High',
        variant: 'destructive' as const,
        action: () => {},
        disabled: true,
        loading: false
      }
    }

    // Swap execution states
    if (swapState.step === 'approving') {
      return {
        text: 'Approving Token...',
        variant: 'secondary' as const,
        action: () => {},
        disabled: true,
        loading: true
      }
    }

    if (swapState.step === 'swapping') {
      return {
        text: 'Swapping...',
        variant: 'secondary' as const,
        action: () => {},
        disabled: true,
        loading: true
      }
    }

    // Error states - allow immediate retry
    if (swapState.step === 'error') {
      return {
        text: 'Retry Swap',
        variant: 'default' as const,
        action: handleRetrySwap,
        disabled: false,
        loading: false
      }
    }

    // Cancelled state - allow immediate retry
    if (swapState.step === 'cancelled') {
      return {
        text: 'Try Again',
        variant: 'default' as const,
        action: handleSwap,
        disabled: false,
        loading: false
      }
    }

    // Success state - Jupiter-style with manual reset option
    if (swapState.step === 'success') {
      return {
        text: 'New Swap',
        variant: 'default' as const,
        action: () => {
          console.log('🔄 Manual success state reset (Jupiter-style)')
          resetSwapState()
          // Also trigger input reset immediately for new swap
          if (onInputReset) {
            onInputReset()
          }
        },
        disabled: false,
        loading: false
      }
    }

    // Ready to swap
    return {
      text: `Swap ${fromToken?.symbol} for ${toToken?.symbol}`,
      variant: 'default' as const,
      action: handleSwap,
      disabled: disabled || !canSwap || isSwapping,
      loading: isSwapping
    }
  }, [
    user,
    smartWalletClient?.account?.address,
    fromToken,
    toToken,
    fromAmount,
    hasInsufficientBalance,
    quote,
    priceImpactTooHigh,
    swapState.step,
    disabled,
    canSwap,
    isSwapping,
    handleLogin,
    handleCreateWallet,
    handleSwap,
    handleRetrySwap
  ])

  return (
    <div className="space-y-4">
      {/* Price Impact Warning */}
      {quote?.priceImpact && parseFloat(quote.priceImpact) > 5 && (
        <div className={cn(
          "flex items-center gap-3 p-4 rounded-xl border backdrop-blur-sm transition-all duration-300",
          parseFloat(quote.priceImpact) > 15 
            ? "bg-red-500/10 text-red-400 border-red-500/30 shadow-lg shadow-red-500/10" 
            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30 shadow-lg shadow-yellow-500/10"
        )}>
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div>
            <div className="font-semibold">High Price Impact</div>
            <div className="text-sm opacity-80">
              {parseFloat(quote.priceImpact).toFixed(2)}% - You may receive less tokens than expected
            </div>
          </div>
        </div>
      )}

      {/* Swap Transaction Progress */}
      {swapState.step !== 'idle' && swapState.step !== 'success' && swapState.step !== 'error' && swapState.step !== 'cancelled' && (
        <div className="relative overflow-hidden rounded-xl border border-blue-200 dark:border-blue-500/30 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 backdrop-blur-sm">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-100/50 via-purple-100/50 to-blue-100/50 dark:from-blue-500/5 dark:via-purple-500/5 dark:to-blue-500/5 animate-pulse" />
          
          <div className="relative flex items-center gap-4 p-4">
            <div className="relative">
              <Loader className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <div className="absolute inset-0 rounded-full bg-blue-400/20 dark:bg-blue-500/20 animate-ping" />
            </div>
            
            <div className="flex-1">
              <div className="font-semibold text-blue-700 dark:text-blue-400">
                {swapState.step === 'approving' && '🔐 Approving Token Spending'}
                {swapState.step === 'swapping' && '🔄 Processing Swap Transaction'}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-300/80 mt-1">
                {swapState.step === 'approving' && 'Please confirm the approval in your wallet'}
                {swapState.step === 'swapping' && 'Your swap is being processed on the blockchain'}
              </div>
              {swapState.swapHash && (
                <div className="text-xs text-blue-600 dark:text-blue-300/60 mt-2 font-mono bg-blue-100 dark:bg-blue-500/10 px-2 py-1 rounded-lg inline-block">
                  Tx: {swapState.swapHash.slice(0, 10)}...{swapState.swapHash.slice(-8)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success State - Jupiter-style with hover protection */}
      {swapState.step === 'success' && swapState.swapHash && (
        <div 
          className="relative overflow-hidden rounded-xl border border-green-200 dark:border-green-500/30 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 backdrop-blur-sm transition-all duration-300 hover:border-green-300 dark:hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/20"
          onMouseEnter={() => {
            console.log('🎯 User interacting with success state')
            setIsSuccessInteracting(true)
            setUserInteracting(true) // 🚀 Notify hook about user interaction
            if (successInteractionTimeoutRef.current) {
              clearTimeout(successInteractionTimeoutRef.current)
            }
          }}
          onMouseLeave={() => {
            console.log('👋 User stopped interacting with success state')
            // Delay before setting to false to prevent rapid toggling
            successInteractionTimeoutRef.current = setTimeout(() => {
              setIsSuccessInteracting(false)
              setUserInteracting(false) // 🚀 Notify hook when interaction ends
            }, 1000)
          }}
        >
          {/* Success sparkle effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-100/50 via-emerald-100/50 to-green-100/50 dark:from-green-500/5 dark:via-emerald-500/5 dark:to-green-500/5" />
          
          <div className="relative flex items-center gap-4 p-4">
            <div className="relative">
              <div className="w-6 h-6 bg-green-500 dark:bg-green-600 rounded-full flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
              <div className="absolute inset-0 rounded-full bg-green-400/30 dark:bg-green-500/30 animate-ping" />
            </div>
            
                          <div className="flex-1">
                <div className="font-semibold text-green-700 dark:text-green-400">🎉 Swap Completed Successfully!</div>
                <div className="text-sm text-green-600 dark:text-green-300/80 mt-1">
                {swapState.completedQuote ? (
                  <>
                    Swapped {swapState.completedQuote.fromToken?.symbol} → {swapState.completedQuote.toToken?.symbol}
                  </>
                ) : (
                  'Your tokens have been swapped and are now in your wallet'
                )}
              </div>
              {swapState.swapHash && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(swapState.swapHash!)
                      console.log('📋 Transaction hash copied')
                    }}
                    className="text-xs text-green-600 dark:text-green-300/60 font-mono bg-green-100 dark:bg-green-500/10 hover:bg-green-200 dark:hover:bg-green-500/20 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    title="Click to copy transaction hash"
                  >
                    Tx: {swapState.swapHash.slice(0, 10)}...{swapState.swapHash.slice(-8)}
                  </button>
                  {/* 🚀 ENHANCED: Transaction link button with better styling */}
                  {swapState.explorerUrl && (
                    <a
                      href={swapState.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-green-100 dark:bg-green-500/20 hover:bg-green-200 dark:hover:bg-green-500/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-lg transition-all duration-200 border border-green-200 dark:border-green-500/30 hover:border-green-300 dark:hover:border-green-500/50 hover:scale-105"
                      onClick={() => console.log('🔗 Opening transaction in explorer')}
                    >
                      View ↗
                    </a>
                  )}
                </div>
              )}
            </div>
            
            {/* 🚀 NEW: Manual dismiss button (Jupiter-style) */}
            <button
              onClick={() => {
                console.log('❌ Manual dismiss success state')
                resetSwapState()
              }}
                             className="w-6 h-6 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-500/10 hover:bg-green-200 dark:hover:bg-green-500/20 text-green-600 dark:text-green-300 hover:text-green-700 dark:hover:text-green-200 transition-colors group"
              title="Dismiss"
            >
              <X className="w-3 h-3 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* Cancelled State */}
      {swapState.step === 'cancelled' && (
        <div className="relative overflow-hidden rounded-xl border border-gray-300 dark:border-gray-500/30 bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-500/10 dark:to-slate-500/10 backdrop-blur-sm">
          <div className="relative flex items-center gap-4 p-4">
            <div className="relative">
              <div className="w-6 h-6 bg-gray-500 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <X className="h-4 w-4 text-white" />
              </div>
            </div>
            
            <div className="flex-1">
              <div className="font-semibold text-gray-700 dark:text-gray-400">Transaction Cancelled</div>
              <div className="text-sm text-gray-600 dark:text-gray-500 mt-1">
                You can try again when ready
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {swapState.step === 'error' && swapState.error && (
        <div className="relative overflow-hidden rounded-xl border border-red-200 dark:border-red-500/30 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-500/10 dark:to-pink-500/10 backdrop-blur-sm">
          <div className="relative flex items-center gap-4 p-4">
            <div className="relative">
              <div className="w-6 h-6 bg-red-500 dark:bg-red-600 rounded-full flex items-center justify-center">
                <X className="h-4 w-4 text-white" />
              </div>
            </div>
            
            <div className="flex-1">
              <div className="font-semibold text-red-700 dark:text-red-400">❌ Swap Failed</div>
              <div className="text-sm text-red-600 dark:text-red-300/80 mt-1 break-words">
                {swapState.error}
              </div>
            </div>
            
            <button
              onClick={handleResetError}
              className="px-4 py-2 text-sm bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-700 dark:text-red-400 rounded-lg transition-all duration-200 hover:scale-105"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Swap Button */}
      <Button
        onClick={buttonState.action}
        disabled={buttonState.disabled}
        variant={buttonState.variant}
        size="lg"
        loading={buttonState.loading}
        className="w-full h-16 text-lg font-bold shadow-xl"
      >
        {buttonState.text}
      </Button>

      {/* Provider Info */}
      {(quote || swapState.completedQuote) && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          {swapState.step === 'success' && swapState.completedQuote ? (
            <>
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span>Swapped via <span className="font-semibold text-green-700 dark:text-green-300">{swapState.completedQuote.provider}</span></span>
              {swapState.explorerUrl && (
                <>
                  <span>•</span>
                                      <a
                      href={swapState.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 underline"
                    >
                      View Transaction
                    </a>
                </>
              )}
            </>
          ) : quote ? (
            <>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>Quote from <span className="font-semibold text-gray-800 dark:text-gray-300">{quote.provider}</span></span>
              <span>•</span>
              <span>Expires in <span className="font-mono text-gray-800 dark:text-gray-300">{Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000))}s</span></span>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
} 