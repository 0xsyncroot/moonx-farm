/**
 * Example Usage of Platform-Safe Number Utilities
 * Demonstrates how to use the centralized utilities in components
 */

import React, { useState } from 'react'
import { NumericFormat } from 'react-number-format'
import { 
  safeParse, 
  safeDivide, 
  safePercentage, 
  isValidPositiveNumber,
  isWithinBalance,
  formatDisplayAmount,
  createSafeNumericFormatProps,
  SAFE_NUMBER_CONFIG 
} from './number-utils'

// =====================
// Example 1: Safe Input Component
// =====================

interface SafeAmountInputProps {
  value: string
  balance?: string | number
  onValueChange: (value: string) => void
  placeholder?: string
  label?: string
}

export function SafeAmountInput({ 
  value, 
  balance, 
  onValueChange, 
  placeholder = "0.0",
  label = "Amount" 
}: SafeAmountInputProps) {
  // ✅ Use safe parsing instead of parseFloat
  const parsedAmount = safeParse(value)
  const parsedBalance = safeParse(balance)
  
  // ✅ Safe validation without division by zero
  const isValid = isValidPositiveNumber(value)
  const hasInsufficientBalance = balance ? !isWithinBalance(value, balance) : false
  
  // ✅ Safe percentage calculation
  const balanceUsedPercent = balance ? safePercentage(value, balance) : 0
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      
      {/* ✅ NumericFormat with safe defaults */}
      <NumericFormat
        value={value}
        onValueChange={(values) => onValueChange(values.value || '')}
        placeholder={placeholder}
        {...createSafeNumericFormatProps({
          decimalScale: SAFE_NUMBER_CONFIG.DECIMALS.TOKEN,
          className: `w-full px-3 py-2 border rounded-lg ${hasInsufficientBalance ? 'border-red-500' : 'border-gray-300'}`
        })}
      />
      
      {/* Balance info */}
      {balance && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>Available: {formatDisplayAmount(balance, { compact: true })}</span>
          <span>Using: {balanceUsedPercent.toFixed(1)}%</span>
        </div>
      )}
      
      {/* Error states */}
      {value && !isValid && (
        <p className="text-xs text-red-500">Invalid amount</p>
      )}
      {hasInsufficientBalance && (
        <p className="text-xs text-red-500">Insufficient balance</p>
      )}
    </div>
  )
}

// =====================
// Example 2: Safe Calculator Component
// =====================

export function SafeCalculator() {
  const [amount1, setAmount1] = useState('')
  const [amount2, setAmount2] = useState('')
  
  // ✅ All calculations are platform-safe
  const sum = safeParse(amount1) + safeParse(amount2)
  const difference = safeParse(amount1) - safeParse(amount2)
  const ratio = safeDivide(amount1, amount2, 0) // Safe division with fallback
  const percentage = safePercentage(amount1, amount2) // Safe percentage
  
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="font-semibold">Safe Calculator</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <SafeAmountInput
          value={amount1}
          onValueChange={setAmount1}
          label="Amount 1"
        />
        <SafeAmountInput
          value={amount2}
          onValueChange={setAmount2}
          label="Amount 2"
        />
      </div>
      
      <div className="space-y-2 text-sm">
        <div>Sum: {formatDisplayAmount(sum)}</div>
        <div>Difference: {formatDisplayAmount(difference)}</div>
        <div>Ratio: {ratio.toFixed(4)}</div>
        <div>Percentage: {percentage.toFixed(2)}%</div>
      </div>
    </div>
  )
}

// =====================
// Example 3: Trading Component
// =====================

interface TradingAmountProps {
  fromAmount: string
  toAmount: string
  slippage: number
  onFromAmountChange: (amount: string) => void
}

export function TradingAmount({ 
  fromAmount, 
  toAmount, 
  slippage, 
  onFromAmountChange 
}: TradingAmountProps) {
  // ✅ Safe calculations for trading
  const fromValue = safeParse(fromAmount)
  const toValue = safeParse(toAmount)
  
  // ✅ Safe price calculation (prevents division by zero)
  const exchangeRate = safeDivide(toAmount, fromAmount, 0)
  
  // ✅ Safe slippage calculation
  const slippageAmount = (toValue * slippage) / 100
  const minReceived = Math.max(0, toValue - slippageAmount)
  
  // ✅ Safe price impact calculation
  const priceImpact = safePercentage(slippageAmount, toValue)
  
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="font-semibold">Trading Calculator</h3>
      
      <SafeAmountInput
        value={fromAmount}
        onValueChange={onFromAmountChange}
        label="You Pay"
      />
      
      <div className="text-center text-gray-500">↓</div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">You Receive</label>
        <div className="px-3 py-2 bg-gray-50 rounded-lg">
          {formatDisplayAmount(toValue)}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="text-gray-500">Exchange Rate</div>
          <div className="font-medium">{exchangeRate.toFixed(6)}</div>
        </div>
        <div>
          <div className="text-gray-500">Price Impact</div>
          <div className={`font-medium ${priceImpact > 5 ? 'text-red-500' : 'text-green-500'}`}>
            {priceImpact.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-gray-500">Min Received</div>
          <div className="font-medium">{formatDisplayAmount(minReceived)}</div>
        </div>
        <div>
          <div className="text-gray-500">Slippage</div>
          <div className="font-medium">{slippage}%</div>
        </div>
      </div>
    </div>
  )
}

// =====================
// Example 4: Portfolio Component  
// =====================

export function PortfolioSummary() {
  const [positions] = useState([
    { symbol: 'ETH', amount: '1.5', value: '3000' },
    { symbol: 'BTC', amount: '0.1', value: '4000' },
    { symbol: 'USDC', amount: '1000', value: '1000' }
  ])
  
  // ✅ Safe total calculation
  const totalValue = positions.reduce((sum, pos) => sum + safeParse(pos.value), 0)
  
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="font-semibold">Portfolio Summary</h3>
      
      <div className="space-y-2">
        {positions.map((position, index) => {
          const positionValue = safeParse(position.value)
          // ✅ Safe percentage calculation (no division by zero)
          const allocation = safePercentage(position.value, totalValue)
          
          return (
            <div key={index} className="flex justify-between items-center">
              <div>
                <span className="font-medium">{position.symbol}</span>
                <span className="text-gray-500 ml-2">{formatDisplayAmount(position.amount)}</span>
              </div>
              <div className="text-right">
                <div className="font-medium">{formatDisplayAmount(positionValue, { prefix: '$' })}</div>
                <div className="text-xs text-gray-500">{allocation.toFixed(1)}%</div>
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="border-t pt-2">
        <div className="flex justify-between font-semibold">
          <span>Total Portfolio</span>
          <span>{formatDisplayAmount(totalValue, { prefix: '$' })}</span>
        </div>
      </div>
    </div>
  )
}

// =====================
// Example Usage in App
// =====================

export default function NumberUtilsExample() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Platform-Safe Number Utilities Examples</h1>
      <p className="text-gray-600">
        These examples show how to use the centralized number utilities to prevent 
        Mac/Windows parsing differences and division by zero errors.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SafeCalculator />
        <PortfolioSummary />
      </div>
      
      <TradingAmount
        fromAmount="1000"
        toAmount="2000"
        slippage={0.5}
        onFromAmountChange={() => {}}
      />
    </div>
  )
} 