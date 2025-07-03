// 🚀 IMPROVED: Token input with unlimited precision and responsive text sizing
import { ChevronDown, AlertTriangle } from 'lucide-react'
import Image from 'next/image'
import { NumericFormat } from 'react-number-format'
import { useState, useEffect, useCallback } from 'react'
import { Token } from '@/hooks/use-tokens'
import { useTokenBalance, formatTokenBalance, hasSufficientBalance } from '@/hooks/use-token-balance'
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
  
  // 🔧 FIX: Local state to handle immediate UI updates and prevent race conditions
  const [pendingAmount, setPendingAmount] = useState<string>('')
  const [isBalanceClicked, setIsBalanceClicked] = useState(false)
  
  // 🔧 FIX: Unified value logic for consistent behavior
  // Use displayValue for display, but ensure amount is the source of truth for editable inputs
  // 🚀 IMPROVED: Now supports unlimited precision and large numbers
  const displayedValue = displayValue ?? (pendingAmount || amount)
  const inputValue = readOnly ? displayedValue : (pendingAmount || amount)
  
  // 🔧 FIX: Real-time insufficient balance check for immediate feedback
  const currentInsufficientBalance = useCallback(() => {
    if (readOnly || !isFromToken || !token || !balance.balance) {
      return false
    }
    
    const currentAmount = pendingAmount || amount
    if (!currentAmount) {
      return false
    }
    
    // 🚀 IMPROVED: Better validation for large numbers
    try {
      const numValue = parseFloat(currentAmount)
      if (isNaN(numValue) || numValue <= 0) {
        return false
      }
      
      return !hasSufficientBalance(balance.balance, currentAmount, token.decimals)
    } catch (error) {
      console.warn('Error checking insufficient balance:', error)
      return false
    }
  }, [readOnly, isFromToken, token, balance.balance, pendingAmount, amount])
  
  // Determine if we should show insufficient balance warning
  const shouldShowInsufficientBalance = isBalanceClicked ? currentInsufficientBalance() : hasInsufficientBalance

  // Clear pending amount when external amount changes (parent component update)
  useEffect(() => {
    if (amount !== pendingAmount && !isBalanceClicked) {
      setPendingAmount('')
    }
  }, [amount, pendingAmount, isBalanceClicked])

  // Clear balance clicked flag after a short delay
  useEffect(() => {
    if (isBalanceClicked) {
      const timeout = setTimeout(() => {
        setIsBalanceClicked(false)
        setPendingAmount('')
      }, 1000) // Clear after 1 second
      
      return () => clearTimeout(timeout)
    }
  }, [isBalanceClicked])

  // 🔧 FIX: Improved balance click handler with immediate UI feedback
  const handleBalanceClick = () => {
    if (balance.error) {
      balance.refetch()
      return
    }
    
    if (!balance.balanceFormatted || !isFromToken || !onAmountChange) {
      return
    }
    
    try {
      // Use balanceFormatted instead of balanceNumber to avoid precision loss
      // Remove any formatting commas and ensure clean number string
      const cleanBalance = balance.balanceFormatted.replace(/,/g, '')
      const balanceNumber = parseFloat(cleanBalance)
      
      // 🚀 IMPROVED: Better validation for large numbers
      if (isNaN(balanceNumber) || balanceNumber <= 0 || !isFinite(balanceNumber)) {
        console.warn('Invalid balance number:', cleanBalance)
        return
      }
      
      // 🚀 IMPROVED: Always preserve full precision, no arbitrary limits
      let valueToSet = cleanBalance
      
      // Only format if the number is extremely large (to avoid scientific notation)
      if (balanceNumber > 1e15) {
        valueToSet = balanceNumber.toFixed(0) // No decimals for very large numbers
      } else {
        // Keep original precision for all other cases
        valueToSet = cleanBalance
      }
      
      // 🚀 IMPROVED: Better logging for debugging large numbers
      if (process.env.NODE_ENV === 'development') {
        console.log('Setting balance:', {
          originalBalance: balance.balanceFormatted,
          cleanBalance,
          balanceNumber,
          valueToSet,
          valueLength: valueToSet?.length,
          token: token?.symbol
        })
      }
      
      // 🔧 FIX: Set pending amount immediately for UI feedback
      setPendingAmount(valueToSet)
      setIsBalanceClicked(true)
      
      // Call parent's onAmountChange
      onAmountChange(valueToSet)
    } catch (error) {
      console.error('Error handling balance click:', error)
    }
  }

  // 🔧 FIX: Enhanced input change handler
  const handleInputChange = (values: any) => {
    const newValue = values.value
    
    // 🚀 IMPROVED: Better logging for debugging large numbers
    if (process.env.NODE_ENV === 'development') {
      console.log('NumericFormat onChange:', {
        newValue,
        formattedValue: values.formattedValue,
        floatValue: values.floatValue,
        valueLength: newValue?.length,
        token: token?.symbol
      })
    }
    
    // Clear pending amount when user types manually
    if (pendingAmount && newValue !== pendingAmount) {
      setPendingAmount('')
      setIsBalanceClicked(false)
    }
    
    onAmountChange?.(newValue)
  }

  return (
    <div className="space-y-2 md:space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">
          {isFromToken ? 'You pay' : 'You receive'}
        </span>
        {token && balance && (
          <div className="flex items-center gap-2">
            {/* Jupiter-style Balance Display */}
            <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
              {balance.isLoading ? (
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                  Loading...
                </span>
              ) : balance.error ? (
                <span className="text-red-400">Error</span>
              ) : (
                <>
                  Bal: {(() => {
                    if (!balance.balanceFormatted) return '0'
                    
                    try {
                      const balanceNum = parseFloat(balance.balanceFormatted.replace(/,/g, ''))
                      
                      if (isNaN(balanceNum) || balanceNum === 0) return '0'
                      
                      // 🚀 Jupiter-style formatting: Clean and compact (kept for balance display space)
                      if (balanceNum >= 1e9) return `${(balanceNum / 1e9).toFixed(1)}B`
                      if (balanceNum >= 1e6) return `${(balanceNum / 1e6).toFixed(1)}M`
                      if (balanceNum >= 1e5) return `${(balanceNum / 1e3).toFixed(0)}K` // Only for 100K+
                      
                      // For smaller numbers, show appropriate precision
                      if (balanceNum >= 1) return balanceNum.toFixed(2)
                      if (balanceNum >= 0.01) return balanceNum.toFixed(4)
                      if (balanceNum >= 0.0001) return balanceNum.toFixed(6)
                      
                      // For very small numbers, use scientific notation or show as ~0
                      return balanceNum < 0.000001 ? '~0' : balanceNum.toFixed(8)
                    } catch (error) {
                      return '0'
                    }
                  })()}
                </>
              )}
            </span>
            
            {/* Jupiter-style Max Button */}
            {!balance.isLoading && !balance.error && isFromToken && onAmountChange && (
              <button
                onClick={handleBalanceClick}
                className={cn(
                  "px-2 py-0.5 text-xs font-medium rounded-md transition-all duration-200",
                  "bg-[#ff7842] dark:bg-[#ff7842]/20 text-white",
                  "hover:bg-[#ff4d00] dark:hover:bg-[#ff7842]/40 hover:scale-105",
                  "border border-[#ff7842] dark:border-[#ff7842]/40",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                )}
                title={`Use max balance (${balance.balanceFormatted} ${token.symbol})`}
              >
                Max
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="relative group">
        <div className={cn(
          "relative bg-gradient-to-br from-gray-50 to-gray-50/50 dark:from-gray-800 dark:to-gray-800/50 rounded-xl md:rounded-2xl transition-all duration-300",
          "border border-gray-200/50 dark:border-gray-700/50",
          "hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg hover:shadow-gray-900/5 dark:hover:shadow-black/10",
          !readOnly && "focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10",
          !isFromToken && token && "border-green-200 dark:border-green-700/50 bg-green-50/50 dark:bg-green-900/10",
          // 🚀 NEW: Prevent container from overflowing
          "overflow-hidden",
          // 🚀 NEW: Warning border if insufficient balance
          shouldShowInsufficientBalance && "border-[#ff7842] dark:border-[#ff7842]"
        )}>
          <div className="flex items-center p-3 md:p-4">
            <div className="flex-1 min-w-0 overflow-hidden">
              {readOnly ? (
                <NumericFormat
                  key={`display-${token?.symbol || 'empty'}-${displayedValue}`}
                  value={displayedValue}
                  displayType="text"
                  thousandSeparator=","
                  decimalSeparator="."
                  // 🚀 REMOVED: decimalScale restriction to allow unlimited decimals
                  className={cn(
                    "w-full font-bold bg-transparent border-0 outline-none",
                    "text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500",
                    "transition-all duration-200",
                    // 🚀 IMPROVED: Better responsive text sizing for large numbers
                    (() => {
                      const valueLength = displayedValue?.length || 0
                      if (valueLength > 20) return "text-sm md:text-base"
                      if (valueLength > 15) return "text-base md:text-lg"
                      if (valueLength > 12) return "text-lg md:text-xl"
                      if (valueLength > 8) return "text-xl md:text-2xl"
                      return "text-2xl md:text-3xl"
                    })()
                  )}
                  style={{
                    // 🚀 IMPROVED: Dynamic font sizing to prevent overflow
                    fontSize: (() => {
                      const valueLength = displayedValue?.length || 0
                      if (valueLength > 25) return '0.75rem'
                      if (valueLength > 20) return '0.875rem'
                      if (valueLength > 15) return '1rem'
                      return undefined
                    })(),
                    // 🚀 NEW: Prevent text overflow and ensure it stays in container
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                />
              ) : (
                <NumericFormat
                  key={`input-${token?.symbol || 'empty'}`}
                  value={inputValue}
                  onValueChange={handleInputChange}
                  placeholder="0.0"
                  thousandSeparator=","
                  decimalSeparator="."
                  allowNegative={false}
                  // 🚀 REMOVED: decimalScale restriction to allow unlimited decimals
                  // 🚀 IMPROVED: More flexible validation - only prevent invalid numbers
                  isAllowed={(values) => {
                    const { floatValue, formattedValue } = values
                    // Allow empty values
                    if (floatValue === undefined) return true
                    
                    // Prevent negative numbers
                    if (floatValue < 0) return false
                    
                    // Allow any positive number including very large ones
                    // Only prevent if the number is too large to handle (avoid infinity)
                    if (floatValue === Infinity || floatValue > Number.MAX_SAFE_INTEGER) return false
                    
                    return true
                  }}
                  className={cn(
                    "w-full font-bold bg-transparent border-0 outline-none",
                    "text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500",
                    "disabled:opacity-50 transition-all duration-200",
                    // 🚀 IMPROVED: Better responsive text sizing for large numbers
                    (() => {
                      const valueLength = inputValue?.length || 0
                      if (valueLength > 20) return "text-sm md:text-base"
                      if (valueLength > 15) return "text-base md:text-lg"
                      if (valueLength > 12) return "text-lg md:text-xl"
                      if (valueLength > 8) return "text-xl md:text-2xl"
                      return "text-2xl md:text-3xl"
                    })()
                  )}
                  style={{
                    // 🚀 IMPROVED: Dynamic font sizing to prevent overflow
                    fontSize: (() => {
                      const valueLength = inputValue?.length || 0
                      if (valueLength > 25) return '0.75rem'
                      if (valueLength > 20) return '0.875rem'
                      if (valueLength > 15) return '1rem'
                      return undefined
                    })(),
                    // 🚀 NEW: Prevent text overflow and ensure it stays in container
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                />
              )}
              
              {token?.priceUSD && displayedValue && (() => {
                try {
                  const numValue = parseFloat(displayedValue)
                  if (isNaN(numValue) || numValue === 0) {
                    return (
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                        ≈ $0.00
                      </p>
                    )
                  }
                  
                  const usdValue = numValue * token.priceUSD
                  
                  // 🚀 IMPROVED: Use NumericFormat for consistent formatting
                  return (
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                      ≈ <NumericFormat
                        value={usdValue}
                        displayType="text"
                        prefix="$"
                        thousandSeparator=","
                        decimalSeparator="."
                        decimalScale={usdValue >= 1000 ? 2 : 4}
                        fixedDecimalScale={usdValue >= 1000}
                      />
                    </p>
                  )
                } catch (error) {
                  return (
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                      ≈ $0.00
                    </p>
                  )
                }
              })()}
              
              {shouldShowInsufficientBalance && (
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