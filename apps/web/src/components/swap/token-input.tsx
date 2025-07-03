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
  const displayedValue = displayValue ?? (pendingAmount || amount)
  const inputValue = readOnly ? displayedValue : (pendingAmount || amount)
  
  // 🔧 FIX: Real-time insufficient balance check for immediate feedback
  const currentInsufficientBalance = useCallback(() => {
    if (readOnly || !isFromToken || !token || !balance.balance) {
      return false
    }
    
    const currentAmount = pendingAmount || amount
    if (!currentAmount || parseFloat(currentAmount) <= 0) {
      return false
    }
    
    return !hasSufficientBalance(balance.balance, currentAmount, token.decimals)
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
      
      // Validate the balance before setting
      if (isNaN(balanceNumber) || balanceNumber <= 0) {
        console.warn('Invalid balance number:', cleanBalance)
        return
      }
      
      // For very small balances, preserve precision
      let valueToSet: string
      if (balanceNumber < 0.000001) {
        valueToSet = cleanBalance // Use full precision
      } else {
        // For normal balances, use reasonable precision (max 8 decimals)
        valueToSet = balanceNumber.toString()
      }
      
      console.log('Setting balance:', {
        originalBalance: balance.balanceFormatted,
        cleanBalance,
        balanceNumber,
        valueToSet,
        token: token?.symbol
      })
      
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
    console.log('NumericFormat onChange:', {
      newValue,
      formattedValue: values.formattedValue,
      floatValue: values.floatValue,
      token: token?.symbol
    })
    
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
          <button 
            onClick={handleBalanceClick}
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
                  key={`display-${token?.symbol || 'empty'}-${displayedValue}`}
                  value={displayedValue}
                  displayType="text"
                  thousandSeparator=","
                  decimalSeparator="."
                  decimalScale={6}
                  className={cn(
                    "w-full font-bold bg-transparent border-0 outline-none",
                    "text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500",
                    "transition-all duration-200",
                    displayedValue.length > 12 ? "text-lg md:text-xl" :
                    displayedValue.length > 8 ? "text-xl md:text-2xl" :
                    "text-2xl md:text-3xl"
                  )}
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
                  decimalScale={6}
                  // 🔧 FIX: Ensure the input always reflects the current amount
                  isAllowed={(values) => {
                    const { floatValue } = values
                    // Allow empty values and valid numbers
                    return floatValue === undefined || floatValue >= 0
                  }}
                  className={cn(
                    "w-full font-bold bg-transparent border-0 outline-none",
                    "text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500",
                    "disabled:opacity-50 transition-all duration-200",
                    inputValue && inputValue.length > 12 ? "text-lg md:text-xl" :
                    inputValue && inputValue.length > 8 ? "text-xl md:text-2xl" :
                    "text-2xl md:text-3xl"
                  )}
                  style={{
                    fontSize: inputValue && inputValue.length > 15 ? '1rem' : undefined
                  }}
                />
              )}
              
              {token?.priceUSD && displayedValue && (
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                  ≈ {formatCurrency(parseFloat(displayedValue) * token.priceUSD)}
                </p>
              )}
              
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