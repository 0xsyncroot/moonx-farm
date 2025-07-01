import { ChevronDown, AlertTriangle } from 'lucide-react'
import Image from 'next/image'
import { NumericFormat } from 'react-number-format'
import { Token } from '@/hooks/use-tokens'
import { useTokenBalance, formatTokenBalance } from '@/hooks/use-token-balance'
import { formatCurrency, cn } from '@/lib/utils'

interface TokenInputProps {
  type: 'from' | 'to'
  token: Token | null
  amount: string
  onAmountChange?: (value: string) => void
  onTokenClick: () => void
  balance: ReturnType<typeof useTokenBalance>
  hasInsufficientBalance?: boolean
  displayValue?: string
  readOnly?: boolean
  chainInfo?: {
    color: string
  } | null
}

export function TokenInput({
  type,
  token,
  amount,
  onAmountChange,
  onTokenClick,
  balance,
  hasInsufficientBalance = false,
  displayValue,
  readOnly = false,
  chainInfo
}: TokenInputProps) {
  const isFromToken = type === 'from'
  const value = displayValue ?? amount

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">
          {isFromToken ? 'You pay' : 'You receive'}
        </span>
        {token && balance && (
          <button 
            onClick={() => {
              if (balance.error) {
                balance.refetch()
              } else if (balance.balanceFormatted && isFromToken && onAmountChange) {
                onAmountChange(balance.balanceNumber.toString())
              }
            }}
            disabled={balance.isLoading}
            className="text-xs md:text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={balance.error ? "Click to retry" : "Click to use max balance"}
          >
            {balance.isLoading ? (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                Loading...
              </span>
            ) : balance.error ? (
              <span className="text-red-400">Error loading balance</span>
            ) : (
              <>
                Balance: {balance.balanceFormatted ? 
                  formatTokenBalance(balance.balance, token.decimals, 4) : 
                  '0'
                } {token.symbol}
              </>
            )}
          </button>
        )}
      </div>
      
      <div className="relative group">
        <div className={cn(
          "relative bg-gradient-to-br from-gray-50 to-gray-50/50 dark:from-gray-800 dark:to-gray-800/50 rounded-xl md:rounded-2xl transition-all duration-300",
          "border border-gray-200/50 dark:border-gray-700/50",
          "hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg hover:shadow-gray-900/5 dark:hover:shadow-black/10",
          !readOnly && "focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10",
          !isFromToken && token && "border-green-200 dark:border-green-700/50 bg-green-50/50 dark:bg-green-900/10"
        )}>
          <div className="flex items-center p-3 md:p-4">
            <div className="flex-1 min-w-0">
              {readOnly ? (
                <NumericFormat
                  key={`display-${token?.symbol || 'empty'}-${value}`}
                  value={value}
                  displayType="text"
                  thousandSeparator=","
                  decimalSeparator="."
                  decimalScale={6}
                  className={cn(
                    "w-full font-bold bg-transparent border-0 outline-none",
                    "text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500",
                    "transition-all duration-200",
                    value.length > 12 ? "text-lg md:text-xl" :
                    value.length > 8 ? "text-xl md:text-2xl" :
                    "text-2xl md:text-3xl"
                  )}
                />
              ) : (
                <NumericFormat
                  value={amount}
                  onValueChange={(values) => onAmountChange?.(values.value)}
                  placeholder="0.0"
                  thousandSeparator=","
                  decimalSeparator="."
                  allowNegative={false}
                  decimalScale={6}
                  className={cn(
                    "w-full font-bold bg-transparent border-0 outline-none",
                    "text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500",
                    "disabled:opacity-50 transition-all duration-200",
                    amount && amount.length > 12 ? "text-lg md:text-xl" :
                    amount && amount.length > 8 ? "text-xl md:text-2xl" :
                    "text-2xl md:text-3xl"
                  )}
                  style={{
                    fontSize: amount && amount.length > 15 ? '1rem' : undefined
                  }}
                />
              )}
              
              {token?.priceUSD && value && (
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                  ≈ {formatCurrency(parseFloat(value) * token.priceUSD)}
                </p>
              )}
              
              {hasInsufficientBalance && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Insufficient balance
                </p>
              )}
            </div>
            
            {/* Token Selector Button */}
            <button
              onClick={onTokenClick}
              className={cn(
                "flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 ml-3 md:ml-4 transition-all duration-200",
                "bg-white dark:bg-gray-700 rounded-lg md:rounded-xl shadow-sm border border-gray-200 dark:border-gray-600",
                "hover:bg-gray-50 dark:hover:bg-gray-600 hover:scale-[1.02] hover:shadow-md"
              )}
            >
              {token ? (
                <>
                  <div className="relative">
                    {token.logoURI && (
                      <Image 
                        src={token.logoURI} 
                        alt={token.symbol}
                        width={28}
                        height={28}
                        className="w-6 h-6 md:w-7 md:h-7 rounded-full shadow-sm"
                      />
                    )}
                    {chainInfo && (
                      <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 md:-bottom-1 md:-right-1 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border-2 border-white dark:border-gray-700",
                        chainInfo.color
                      )} />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900 dark:text-white text-sm md:text-base">{token.symbol}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{token.name}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-6 h-6 md:w-7 md:h-7 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 rounded-full" />
                  <div className="text-left">
                    <div className="font-medium text-gray-500 dark:text-gray-400 text-sm md:text-base">Select token</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">Choose token</div>
                  </div>
                </>
              )}
              <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 