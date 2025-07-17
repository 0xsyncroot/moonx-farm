# Platform-Safe Number Utilities

## 🚨 The Problem

### Mac vs Windows Number Parsing Differences

```tsx
// ❌ DANGEROUS: Platform-dependent parsing
parseFloat("1,000.50")  // Windows: 1000.5 ✅ | Mac (some locales): 1 ❌
parseFloat("1.000,50")  // Windows: 1 ❌ | Mac (EU locale): 1000.5 ✅ 
parseFloat("invalid")   // Both: NaN ❌ → Division by Zero!
```

### Chain of Errors Leading to Division by Zero

```tsx
// Real scenario on Mac:
const userInput = "1.000,50"  // User enters 1000.50
const amount = parseFloat(userInput)  // → 1 (parsed wrong!)

// Later in code:
const percentage = profit / amount  // 500 / 1 = 50000% (wrong!)
const slippage = (expected - actual) / expected  // X / 0 → Division by Zero!
const progress = completed / total  // X / 0 → App crashes!
```

## ✅ The Solution

### 1. Use `safeParse()` Instead of `parseFloat()`

```tsx
import { safeParse } from '@/utils/number-utils'

// ✅ SAFE: Platform-independent parsing
safeParse("1,000.50")  // Always: 1000.5 ✅
safeParse("1.000,50")  // Always: 1000.5 ✅ 
safeParse("invalid")   // Always: 0 ✅ (safe fallback)
```

### 2. Use Safe Math Operations

```tsx
import { safeDivide, safePercentage, safeMultiply } from '@/utils/number-utils'

// ✅ SAFE: Division with fallback
const ratio = safeDivide(dividend, divisor, 0)  // Never crashes!

// ✅ SAFE: Percentage calculation  
const percent = safePercentage(value, total, 0)  // Never division by zero!

// ✅ SAFE: Multiplication with validation
const result = safeMultiply(a, b, 0)  // Always finite result
```

### 3. Use Safe NumericFormat

```tsx
import { NumericFormat } from 'react-number-format'
import { createSafeNumericFormatProps } from '@/utils/number-utils'

// ✅ SAFE: Platform-consistent formatting
<NumericFormat
  value={amount}
  onValueChange={(values) => setAmount(values.value || '')}
  {...createSafeNumericFormatProps({
    decimalScale: 6,
    placeholder: "0.0"
  })}
/>
```

## 📚 Complete API Reference

### Core Functions

#### `safeParse(value: string | number | null | undefined): number`
Platform-safe number parsing that always returns a valid number.

```tsx
safeParse("1,000.50")   // → 1000.5
safeParse("1.000,50")   // → 1000.5
safeParse("invalid")    // → 0
safeParse(null)         // → 0
safeParse("")           // → 0
```

#### `safeDivide(dividend, divisor, fallback = 0): number`
Division that prevents division by zero.

```tsx
safeDivide(100, 50)      // → 2
safeDivide(100, 0)       // → 0 (fallback)
safeDivide(100, 0, -1)   // → -1 (custom fallback)
```

#### `safePercentage(value, total, fallback = 0): number`
Safe percentage calculation.

```tsx
safePercentage(25, 100)   // → 25
safePercentage(50, 0)     // → 0 (prevents division by zero)
```

### Validation Functions

#### `isValidPositiveNumber(value): boolean`
Check if value is a valid positive number.

```tsx
isValidPositiveNumber("100")     // → true
isValidPositiveNumber("0")       // → false
isValidPositiveNumber("invalid") // → false
```

#### `isWithinBalance(amount, balance): boolean`
Check if amount is within available balance.

```tsx
isWithinBalance("100", "500")    // → true
isWithinBalance("600", "500")    // → false
isWithinBalance("abc", "500")    // → false
```

### Formatting Functions

#### `formatDisplayAmount(amount, options): string`
Format amounts for display with platform-safe parsing.

```tsx
formatDisplayAmount(1234.5678)                          // → "1234.567800"
formatDisplayAmount(1234.5678, { decimals: 2 })         // → "1234.57"
formatDisplayAmount(1234.5678, { compact: true })       // → "1.2K"
formatDisplayAmount(1234.5678, { prefix: '$' })         // → "$1234.567800"
```

## 🛠️ Migration Guide

### Before (Dangerous)

```tsx
// ❌ OLD WAY - Platform dependent
const amount = parseFloat(userInput)
const percentage = (profit / amount) * 100
const isValid = !isNaN(amount) && amount > 0

<NumericFormat
  value={amount}
  thousandSeparator=","
  decimalSeparator="."
  onValueChange={(values) => {
    const parsed = parseFloat(values.value)
    setAmount(parsed)
  }}
/>
```

### After (Safe)

```tsx
// ✅ NEW WAY - Platform safe
import { safeParse, safePercentage, isValidPositiveNumber, createSafeNumericFormatProps } from '@/utils/number-utils'

const amount = safeParse(userInput)
const percentage = safePercentage(profit, amount)
const isValid = isValidPositiveNumber(userInput)

<NumericFormat
  value={userInput}
  {...createSafeNumericFormatProps()}
  onValueChange={(values) => {
    setUserInput(values.value || '')
    // amount will be calculated via safeParse when needed
  }}
/>
```

## 🎯 Common Use Cases

### 1. Token Amount Input

```tsx
function TokenAmountInput({ value, balance, onChange }) {
  const parsedAmount = safeParse(value)
  const hasInsufficientBalance = !isWithinBalance(value, balance)
  const balanceUsed = safePercentage(value, balance)
  
  return (
    <div>
      <NumericFormat
        value={value}
        onValueChange={(values) => onChange(values.value || '')}
        {...createSafeNumericFormatProps({ decimalScale: 6 })}
      />
      <div>Using {balanceUsed.toFixed(1)}% of balance</div>
      {hasInsufficientBalance && <div>Insufficient balance</div>}
    </div>
  )
}
```

### 2. Trading Calculations

```tsx
function TradingCalculator({ fromAmount, toAmount, slippage }) {
  const exchangeRate = safeDivide(toAmount, fromAmount, 0)
  const slippageAmount = safeMultiply(toAmount, slippage / 100)
  const minReceived = safeParse(toAmount) - slippageAmount
  const priceImpact = safePercentage(slippageAmount, toAmount)
  
  return (
    <div>
      <div>Rate: {exchangeRate.toFixed(6)}</div>
      <div>Min Received: {formatDisplayAmount(minReceived)}</div>
      <div>Price Impact: {priceImpact.toFixed(2)}%</div>
    </div>
  )
}
```

### 3. Portfolio Calculations

```tsx
function PortfolioMetrics({ positions }) {
  const totalValue = positions.reduce((sum, pos) => sum + safeParse(pos.value), 0)
  
  return (
    <div>
      {positions.map(position => {
        const allocation = safePercentage(position.value, totalValue)
        return (
          <div key={position.id}>
            {position.symbol}: {allocation.toFixed(1)}%
          </div>
        )
      })}
    </div>
  )
}
```

## 🔧 Configuration

### Default Decimal Places

```tsx
import { SAFE_NUMBER_CONFIG } from '@/utils/number-utils'

// Use predefined decimal places for different contexts
const currencyDecimals = SAFE_NUMBER_CONFIG.DECIMALS.CURRENCY  // 2
const tokenDecimals = SAFE_NUMBER_CONFIG.DECIMALS.TOKEN        // 6
const priceDecimals = SAFE_NUMBER_CONFIG.DECIMALS.PRICE        // 8
```

### Custom NumericFormat Props

```tsx
// Create custom props with safe defaults
const customProps = createSafeNumericFormatProps({
  decimalScale: 4,
  prefix: '$',
  suffix: ' USD'
})
```

## ⚡ Performance Tips

1. **Parse once, use many times**:
   ```tsx
   // ✅ Good
   const amount = safeParse(userInput)
   const total = amount * price
   const percentage = safePercentage(amount, balance)
   
   // ❌ Bad
   const total = safeParse(userInput) * price
   const percentage = safePercentage(safeParse(userInput), balance)
   ```

2. **Use memoization for expensive calculations**:
   ```tsx
   const calculations = useMemo(() => ({
     total: safeParse(amount) * safeParse(price),
     percentage: safePercentage(amount, balance)
   }), [amount, price, balance])
   ```

## 🚨 Remember

- **Always use `safeParse()` instead of `parseFloat()`**
- **Always use `safeDivide()` for any division**
- **Always use `createSafeNumericFormatProps()` for NumericFormat**
- **Never trust user input - always validate with safe functions**

This prevents all Mac/Windows differences and division by zero errors! 🎯 