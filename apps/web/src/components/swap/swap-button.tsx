'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useAuth } from '@/hooks/use-auth'
import { Token } from '@/lib/api-client'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useSwap } from '@/hooks/use-swap'
import { cn } from '@/lib/utils'
import type { Quote } from '@/lib/api-client'
import React, { useCallback, useRef, useEffect, useMemo } from 'react'

// Global execution lock to prevent ANY duplicate calls
const globalExecutionLock = {
  isExecuting: false,
  lastExecutionTime: 0,
  setLock: function() {
    this.isExecuting = true
    this.lastExecutionTime = Date.now()
  },
  releaseLock: function() {
    this.isExecuting = false
  },
  canExecute: function() {
    const now = Date.now()
    return !this.isExecuting && (now - this.lastExecutionTime) > 1000
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
    if (now - lastClickRef.current < 500) return // 500ms debounce
    
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
  onResumeCountdown
}: SwapButtonProps) {
  const { user, login, createWallet } = usePrivy()
  const { client: smartWalletClient } = useSmartWallets()
  const { executeSwap, swapState, canSwap, resetSwapState, isSwapping, setOnSwapComplete } = useSwap()

  // Prevent rapid consecutive clicks
  const lastClickTimeRef = useRef(0)

  // Set up cleanup callback for global lock  
  useEffect(() => {
    setOnSwapComplete(() => {
      // Release global lock when swap completes (success, error, or cancel)
      if (globalExecutionLock.isExecuting) {
        globalExecutionLock.releaseLock() // Release immediately
      }
      // ✨ Countdown resume handled automatically by useEffect tracking swapState.step
    })
    
    // Cleanup callback on unmount
    return () => {
      setOnSwapComplete(null)
    }
  }, [setOnSwapComplete])

  // ✨ Track swap state changes for countdown control
  useEffect(() => {
    if (swapState.step === 'approving' && onPauseCountdown) {
      onPauseCountdown('approval')
    } else if (swapState.step === 'cancelled' && onResumeCountdown) {
      onResumeCountdown('cancelled')
    } else if (swapState.step === 'error' && onResumeCountdown) {
      onResumeCountdown('error')
    } else if (swapState.step === 'success' && onResumeCountdown) {
      onResumeCountdown('completed')
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
    // Global lock check - prevents ALL duplicate calls  
    if (!globalExecutionLock.canExecute()) {
      console.warn('🔒 Global execution lock prevents swap execution')
      return
    }
    
    if (!quote || isSwapping) {
      console.warn('❌ Cannot execute swap:', { hasQuote: !!quote, isSwapping })
      return
    }
    
    // Validate quote has required fields before execution
    const isQuoteValid = !!(
      quote.callData &&
      quote.fromToken?.address &&
      quote.toToken?.address &&
      quote.fromAmount &&
      quote.toAmount &&
      quote.provider &&
      quote.value !== undefined
    )
    
    if (!isQuoteValid) {
      console.error('❌ Quote validation failed before swap execution:', {
        id: quote.id,
        provider: quote.provider,
        hasCallData: !!quote.callData,
        hasFromToken: !!quote.fromToken?.address,
        hasToToken: !!quote.toToken?.address,
        hasFromAmount: !!quote.fromAmount,
        hasToAmount: !!quote.toAmount,
        hasValue: quote.value !== undefined,
        quote: quote
      })
      return
    }
    
    console.log('🚀 Executing swap with validated quote:', {
      id: quote.id,
      provider: quote.provider,
      fromToken: quote.fromToken?.symbol,
      toToken: quote.toToken?.symbol,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      callDataLength: quote.callData?.length,
      value: quote.value
    })
    
    // ✨ PAUSE countdown when starting swap (DEX behavior)
    if (onPauseCountdown) {
      onPauseCountdown('swap')
    }
    
    // Set global lock
    globalExecutionLock.setLock()
    lastClickTimeRef.current = Date.now()
    
    try {
      await executeSwap(quote)
    } catch (error) {
      // Error handling is done in the hook
      console.error('Swap execution error:', error)
      // Release lock on immediate error
      globalExecutionLock.releaseLock()
      // ✨ Countdown resume handled automatically by useEffect tracking swapState.step
    }
  }, [quote, executeSwap, isSwapping, onPauseCountdown, onResumeCountdown])

  // Simplified retry - just reset and try again with same function
  const handleRetrySwap = useCallback(async () => {
    // Global lock check - prevents ALL duplicate calls
    if (!globalExecutionLock.canExecute()) {
      console.warn('🔒 Global execution lock prevents retry execution')
      return
    }
    
    if (!quote || isSwapping) {
      console.warn('❌ Cannot retry swap:', { hasQuote: !!quote, isSwapping })
      return
    }
    
    // Validate quote has required fields before retry
    const isQuoteValid = !!(
      quote.callData &&
      quote.fromToken?.address &&
      quote.toToken?.address &&
      quote.fromAmount &&
      quote.toAmount &&
      quote.provider &&
      quote.value !== undefined
    )
    
    if (!isQuoteValid) {
      console.error('❌ Quote validation failed before retry execution:', {
        id: quote.id,
        provider: quote.provider,
        hasCallData: !!quote.callData,
        hasFromToken: !!quote.fromToken?.address,
        hasToToken: !!quote.toToken?.address,
        hasFromAmount: !!quote.fromAmount,
        hasToAmount: !!quote.toAmount,
        hasValue: quote.value !== undefined,
        quote: quote
      })
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
    
    // ✨ PAUSE countdown when retrying swap
    if (onPauseCountdown) {
      onPauseCountdown('swap')
    }
    
    // Set global lock
    globalExecutionLock.setLock()
    lastClickTimeRef.current = Date.now()
    
    try {
      await executeSwap(quote)
    } catch (error) {
      // Error handling is done in the hook
      console.error('Retry swap execution error:', error)
      // Release lock on immediate error
      globalExecutionLock.releaseLock()
      // ✨ Countdown resume handled automatically by useEffect tracking swapState.step
    }
  }, [quote, resetSwapState, executeSwap, isSwapping, onPauseCountdown, onResumeCountdown])



  const handleResetError = useCallback(() => {
    resetSwapState()
    // ✨ Countdown resume handled automatically by useEffect tracking swapState.step
  }, [resetSwapState])

  // Memoize button state to prevent excessive re-computations
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

    // Swap states
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

    // Cancelled state - allow retry immediately
    if (swapState.step === 'cancelled') {
      return {
        text: 'Try Again',
        variant: 'default' as const,
        action: handleSwap,
        disabled: disabled, // Don't check global lock for cancelled state
        loading: false
      }
    }

    // Error state - allow retry immediately
    if (swapState.step === 'error') {
      return {
        text: 'Retry Swap',
        variant: 'default' as const,
        action: handleRetrySwap,
        disabled: disabled, // Don't check global lock for error state
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
    swapState.error,
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
        <div className="relative overflow-hidden rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5 animate-pulse" />
          
          <div className="relative flex items-center gap-4 p-4">
            <div className="relative">
              <Loader className="h-6 w-6 text-blue-400" />
              <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
            </div>
            
            <div className="flex-1">
              <div className="font-semibold text-blue-400">
                {swapState.step === 'approving' && '🔐 Approving Token Spending'}
                {swapState.step === 'swapping' && '🔄 Processing Swap Transaction'}
              </div>
              <div className="text-sm text-blue-300/80 mt-1">
                {swapState.step === 'approving' && 'Please confirm the approval in your wallet'}
                {swapState.step === 'swapping' && 'Your swap is being processed on the blockchain'}
              </div>
              {swapState.swapHash && (
                <div className="text-xs text-blue-300/60 mt-2 font-mono bg-blue-500/10 px-2 py-1 rounded-lg inline-block">
                  Tx: {swapState.swapHash.slice(0, 10)}...{swapState.swapHash.slice(-8)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {swapState.step === 'success' && swapState.swapHash && (
        <div className="relative overflow-hidden rounded-xl border border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-sm">
          {/* Success sparkle effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-green-500/5" />
          
          <div className="relative flex items-center gap-4 p-4">
            <div className="relative">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
              <div className="absolute inset-0 rounded-full bg-green-400/30 animate-ping" />
            </div>
            
            <div className="flex-1">
              <div className="font-semibold text-green-400">🎉 Swap Completed Successfully!</div>
              <div className="text-sm text-green-300/80 mt-1">
                Your tokens have been swapped and are now in your wallet
              </div>
              {swapState.swapHash && (
                <div className="text-xs text-green-300/60 mt-2 font-mono bg-green-500/10 px-2 py-1 rounded-lg inline-block">
                  Tx: {swapState.swapHash.slice(0, 10)}...{swapState.swapHash.slice(-8)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancelled State */}
      {swapState.step === 'cancelled' && (
        <div className="relative overflow-hidden rounded-xl border border-gray-500/30 bg-gradient-to-r from-gray-500/10 to-slate-500/10 backdrop-blur-sm">
          <div className="relative flex items-center gap-4 p-4">
            <div className="relative">
              <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center">
                <X className="h-4 w-4 text-white" />
              </div>
            </div>
            
            <div className="flex-1">
              <div className="font-semibold text-gray-400">Transaction Cancelled</div>
              <div className="text-sm text-gray-500 mt-1">
                You can try again when ready
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {swapState.step === 'error' && swapState.error && (
        <div className="relative overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-pink-500/10 backdrop-blur-sm">
          <div className="relative flex items-center gap-4 p-4">
            <div className="relative">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <X className="h-4 w-4 text-white" />
              </div>
            </div>
            
            <div className="flex-1">
              <div className="font-semibold text-red-400">❌ Swap Failed</div>
              <div className="text-sm text-red-300/80 mt-1 break-words">
                {swapState.error}
              </div>
            </div>
            
            <button
              onClick={handleResetError}
              className="px-4 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all duration-200 hover:scale-105"
            >
              Try Again
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
      {quote && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span>Quote from <span className="font-semibold text-gray-300">{quote.provider}</span></span>
          <span>•</span>
          <span>Expires in <span className="font-mono text-gray-300">{Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000))}s</span></span>
        </div>
      )}
    </div>
  )
} 