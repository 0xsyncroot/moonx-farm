'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useAuth } from '@/hooks/use-auth'
import { Token } from '@/lib/api-client'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useSwap } from '@/hooks/use-swap'
import { cn } from '@/lib/utils'
import type { Quote } from '@/lib/api-client'

// Simple Button component for now
const Button = ({ children, onClick, disabled, variant, size, className }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: string
  size?: string
  className?: string
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'px-4 py-2 rounded-lg font-medium transition-colors',
      disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90',
      variant === 'destructive' ? 'bg-red-600 text-white' :
      variant === 'secondary' ? 'bg-gray-600 text-white' :
      'bg-[#ff7842] text-white',
      className
    )}
  >
    {children}
  </button>
)

// Simple icons
const AlertTriangle = ({ className }: { className: string }) => (
  <span className={className}>⚠️</span>
)
const Check = ({ className }: { className: string }) => (
  <span className={className}>✅</span>
)
const X = ({ className }: { className: string }) => (
  <span className={className}>❌</span>
)

interface SwapButtonProps {
  fromToken: Token | null
  toToken: Token | null
  fromAmount: string
  quote: Quote | null
  disabled: boolean
  priceImpactTooHigh: boolean
}

export function SwapButton({
  fromToken,
  toToken,
  fromAmount,
  quote,
  disabled,
  priceImpactTooHigh
}: SwapButtonProps) {
  const { user, login, createWallet } = usePrivy()
  const { client: smartWalletClient } = useSmartWallets()
  const { executeSwap, swapState, canSwap } = useSwap()

  // Determine button state and action
  const getButtonState = () => {
    // Authentication states
    if (!user) {
      return {
        text: 'Connect Wallet',
        variant: 'default' as const,
        action: login,
        disabled: false
      }
    }

    if (!smartWalletClient?.account?.address && user) {
      return {
        text: 'Create Smart Wallet',
        variant: 'default' as const,
        action: createWallet,
        disabled: false
      }
    }

    // Validation states
    if (!fromToken || !toToken) {
      return {
        text: 'Select Tokens',
        variant: 'secondary' as const,
        action: () => {},
        disabled: true
      }
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      return {
        text: 'Enter Amount',
        variant: 'secondary' as const,
        action: () => {},
        disabled: true
      }
    }

    if (!quote) {
      return {
        text: 'Getting Quote...',
        variant: 'secondary' as const,
        action: () => {},
        disabled: true
      }
    }

    if (priceImpactTooHigh) {
      return {
        text: 'Price Impact Too High',
        variant: 'destructive' as const,
        action: () => {},
        disabled: true
      }
    }

    // Swap states
    if (swapState.step === 'approving') {
      return {
        text: 'Approving Token...',
        variant: 'secondary' as const,
        action: () => {},
        disabled: true
      }
    }

    if (swapState.step === 'swapping') {
      return {
        text: 'Swapping...',
        variant: 'secondary' as const,
        action: () => {},
        disabled: true
      }
    }

    // Ready to swap
    return {
      text: `Swap ${fromToken?.symbol} for ${toToken?.symbol}`,
      variant: 'default' as const,
      action: () => executeSwap(quote),
      disabled: disabled || !canSwap
    }
  }

  const buttonState = getButtonState()

  return (
    <div className="space-y-3">
      {/* Smart Wallet Info */}
      {smartWalletClient?.account?.address && (
        <div className="text-xs text-gray-400 text-center p-2 bg-[#ff7842]/10 rounded-lg">
          Smart Wallet: {smartWalletClient.account.address.slice(0, 6)}...{smartWalletClient.account.address.slice(-4)}
        </div>
      )}

      {/* Price Impact Warning */}
      {quote?.priceImpact && quote.priceImpact > 5 && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-lg text-sm",
          quote.priceImpact > 15 
            ? "bg-red-500/10 text-red-400 border border-red-500/20" 
            : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
        )}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            High price impact: {quote.priceImpact.toFixed(2)}%
          </span>
        </div>
      )}

      {/* Swap Transaction Progress */}
      {swapState.step !== 'idle' && swapState.step !== 'success' && (
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#ff7842] border-t-transparent" />
          <div className="flex-1">
            <div className="text-sm font-medium">
              {swapState.step === 'approving' && 'Approving token spending...'}
              {swapState.step === 'swapping' && 'Executing swap via smart wallet...'}
            </div>
            {swapState.swapHash && (
              <div className="text-xs text-gray-400 mt-1">
                Tx: {swapState.swapHash.slice(0, 10)}...{swapState.swapHash.slice(-8)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success State */}
      {swapState.step === 'success' && swapState.swapHash && (
        <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
          <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-green-400">Swap completed!</div>
            <div className="text-xs text-gray-400 mt-1">
              Tx: {swapState.swapHash.slice(0, 10)}...{swapState.swapHash.slice(-8)}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {swapState.step === 'error' && swapState.error && (
        <div className="flex items-center gap-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
          <X className="h-4 w-4 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-red-400">Swap failed</div>
            <div className="text-xs text-gray-400 mt-1">
              {swapState.error}
            </div>
          </div>
        </div>
      )}

      {/* Main Swap Button */}
      <Button
        onClick={buttonState.action}
        disabled={buttonState.disabled}
        variant={buttonState.variant}
        size="lg"
        className="w-full h-14 text-lg font-semibold"
      >
        {buttonState.disabled && swapState.isSwapping && (
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
        )}
        {buttonState.text}
      </Button>

      {/* Provider Info */}
      {quote && (
        <div className="text-xs text-gray-400 text-center">
          Quote from {quote.provider} • Expires in {Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000))}s
          <br />
          <span className="text-[#ff7842]">Executing via Privy Smart Wallet</span>
        </div>
      )}
    </div>
  )
} 