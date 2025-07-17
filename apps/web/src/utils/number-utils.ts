/**
 * Platform-Safe Number Utilities
 * Prevents Mac/Windows parsing differences and division by zero errors
 */

// =====================
// Core Safe Parsing
// =====================

/**
 * Platform-safe number parsing utility
 * Handles locale differences between Mac/Windows/Linux
 * 
 * @param value - String or number to parse
 * @returns Safe number (0 if invalid)
 * 
 * @example
 * safeParse("1,000.50") → 1000.5  ✅ (Windows format)
 * safeParse("1.000,50") → 1000.5  ✅ (Some EU locales on Mac)
 * safeParse("1000.50")  → 1000.5  ✅ (Standard)
 * safeParse("invalid")  → 0        ✅ (Safe fallback)
 */
export const safeParse = (value: string | number | null | undefined): number => {
  if (!value && value !== 0) return 0
  
  // Convert to string for processing
  const stringValue = value.toString()
  if (stringValue.trim() === '') return 0
  
  // Step 1: Normalize by removing all characters except digits, dots, and minus
  // This handles cases where different locales might inject different characters
  let normalized = stringValue.replace(/[^\d.-]/g, '')
  
  // Step 2: Handle multiple dots - keep only the last one as decimal separator
  const dotIndex = normalized.lastIndexOf('.')
  if (dotIndex !== -1) {
    // Remove all dots except the last one
    normalized = normalized.substring(0, dotIndex).replace(/\./g, '') + normalized.substring(dotIndex)
  }
  
  // Step 3: Parse using standard parseFloat
  const parsed = parseFloat(normalized)
  
  // Step 4: Validate result and return safe fallback
  if (isNaN(parsed) || !isFinite(parsed)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('safeParse: Invalid number parsed:', { 
        original: value, 
        normalized, 
        parsed,
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'server',
        locale: typeof navigator !== 'undefined' ? navigator.language : 'unknown'
      })
    }
    return 0
  }
  
  // Debug logging for platform differences (only in development)
  if (process.env.NODE_ENV === 'development' && normalized !== stringValue) {
    console.log('safeParse: Number normalized:', { 
      original: value, 
      stringValue,
      normalized, 
      parsed,
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'server'
    })
  }
  
  return parsed
}

// =====================
// Safe Math Operations
// =====================

/**
 * Safe division that prevents division by zero
 */
export const safeDivide = (dividend: number | string, divisor: number | string, fallback: number = 0): number => {
  const num = safeParse(dividend)
  const den = safeParse(divisor)
  
  if (den === 0) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('safeDivide: Division by zero prevented:', { dividend, divisor, fallback })
    }
    return fallback
  }
  
  const result = num / den
  return isFinite(result) ? result : fallback
}

/**
 * Safe percentage calculation
 */
export const safePercentage = (value: number | string, total: number | string, fallback: number = 0): number => {
  return safeDivide(value, total, fallback) * 100
}

/**
 * Safe multiplication with validation
 */
export const safeMultiply = (a: number | string, b: number | string, fallback: number = 0): number => {
  const numA = safeParse(a)
  const numB = safeParse(b)
  
  const result = numA * numB
  return isFinite(result) ? result : fallback
}

// =====================
// Validation Helpers
// =====================

/**
 * Check if a value is a valid positive number
 */
export const isValidPositiveNumber = (value: string | number | null | undefined): boolean => {
  const parsed = safeParse(value)
  return parsed > 0
}

/**
 * Check if a value is a valid number (including 0)
 */
export const isValidNumber = (value: string | number | null | undefined): boolean => {
  const parsed = safeParse(value)
  return parsed >= 0
}

/**
 * Validate amount is within balance
 */
export const isWithinBalance = (amount: string | number, balance: string | number): boolean => {
  const amountNum = safeParse(amount)
  const balanceNum = safeParse(balance)
  
  return amountNum > 0 && amountNum <= balanceNum
}

// =====================
// Amount Formatting
// =====================

/**
 * Format amount for display with platform-safe parsing
 */
export const formatDisplayAmount = (
  amount: string | number | null | undefined,
  options: {
    decimals?: number
    prefix?: string
    suffix?: string
    compact?: boolean
  } = {}
): string => {
  const { decimals = 6, prefix = '', suffix = '', compact = false } = options
  
  const parsed = safeParse(amount)
  
  if (parsed === 0) return `${prefix}0${suffix}`
  
  if (compact) {
    if (parsed >= 1e9) return `${prefix}${(parsed / 1e9).toFixed(1)}B${suffix}`
    if (parsed >= 1e6) return `${prefix}${(parsed / 1e6).toFixed(1)}M${suffix}`
    if (parsed >= 1e3) return `${prefix}${(parsed / 1e3).toFixed(1)}K${suffix}`
  }
  
  // Handle very small numbers
  if (parsed < 0.000001) {
    return `${prefix}${parsed.toExponential(2)}${suffix}`
  }
  
  // Standard formatting
  const formatted = parsed.toFixed(decimals).replace(/\.?0+$/, '')
  return `${prefix}${formatted}${suffix}`
}

// =====================
// Type Definitions
// =====================

export interface SafeNumberValue {
  raw: string | number
  parsed: number
  isValid: boolean
  formatted: string
}

/**
 * Create a safe number value object with metadata
 */
export const createSafeNumber = (value: string | number | null | undefined): SafeNumberValue => {
  const parsed = safeParse(value)
  const raw = value || ''
  
  return {
    raw,
    parsed,
    isValid: parsed >= 0,
    formatted: formatDisplayAmount(parsed)
  }
}

// =====================
// NumericFormat Helpers
// =====================

/**
 * Safe defaults for NumericFormat to prevent platform differences
 */
export const SAFE_NUMERIC_FORMAT_PROPS = {
  thousandSeparator: ',',
  decimalSeparator: '.',
  fixedDecimalScale: false,
  allowLeadingZeros: false,
  allowNegative: false,
} as const

/**
 * Create platform-safe NumericFormat props
 */
export const createSafeNumericFormatProps = (overrides: Record<string, any> = {}) => ({
  ...SAFE_NUMERIC_FORMAT_PROPS,
  ...overrides,
})

// =====================
// Export Constants
// =====================

export const SAFE_NUMBER_CONFIG = {
  /** Default decimal places for different contexts */
  DECIMALS: {
    CURRENCY: 2,
    TOKEN: 6,
    PERCENTAGE: 2,
    PRICE: 8
  },
  
  /** Safe defaults for NumericFormat */
  NUMERIC_FORMAT_DEFAULTS: SAFE_NUMERIC_FORMAT_PROPS
} as const

// =====================
// Default Export
// =====================

export default {
  safeParse,
  safeDivide,
  safePercentage,
  safeMultiply,
  isValidPositiveNumber,
  isValidNumber,
  isWithinBalance,
  formatDisplayAmount,
  createSafeNumber,
  createSafeNumericFormatProps,
  SAFE_NUMBER_CONFIG
} 