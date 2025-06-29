import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { parseUnits, formatUnits } from 'ethers'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount)
}

export function formatNumber(
  number: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
    ...options,
  }).format(number)
}

export function formatAddress(address: string, length: number = 4): string {
  if (!address) return ""
  return `${address.slice(0, length + 2)}...${address.slice(-length)}`
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), wait)
    }
  }
}

/**
 * Swap URL utilities following Uniswap/Jupiter patterns
 */

export interface SwapUrlParams {
  from?: string // Token address or symbol
  fromChain?: number
  to?: string // Token address or symbol  
  toChain?: number
  amount?: string
  exactField?: 'input' | 'output'
  slippage?: number
  theme?: 'light' | 'dark'
}

/**
 * Generate a shareable swap URL
 * @param params - Swap parameters
 * @param baseUrl - Base URL (defaults to current origin)
 * @returns Complete swap URL
 */
export function generateSwapUrl(params: SwapUrlParams, baseUrl?: string): string {
  const url = new URL('/swap', baseUrl || window.location.origin)
  
  // Add parameters if they exist
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value.toString())
    }
  })
  
  return url.toString()
}

/**
 * Parse swap parameters from URL
 * @param searchParams - URLSearchParams object
 * @returns Parsed swap parameters
 */
export function parseSwapParams(searchParams: URLSearchParams): SwapUrlParams {
  return {
    from: searchParams.get('from') || undefined,
    fromChain: searchParams.get('fromChain') ? parseInt(searchParams.get('fromChain')!) : undefined,
    to: searchParams.get('to') || undefined,
    toChain: searchParams.get('toChain') ? parseInt(searchParams.get('toChain')!) : undefined,
    amount: searchParams.get('amount') || undefined,
    exactField: (searchParams.get('exactField') as 'input' | 'output') || undefined,
    slippage: searchParams.get('slippage') ? parseFloat(searchParams.get('slippage')!) : undefined,
    theme: (searchParams.get('theme') as 'light' | 'dark') || undefined,
  }
}

/**
 * Validate if a string is a valid token address
 * @param address - Address to validate
 * @returns true if valid address format
 */
export function isValidTokenAddress(address: string): boolean {
  // Ethereum/EVM address format: 0x followed by 40 hex characters
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Create a copy-to-clipboard shareable swap link
 * @param params - Swap parameters
 * @returns Promise that resolves when copied
 */
export async function copySwapLink(params: SwapUrlParams): Promise<void> {
  const url = generateSwapUrl(params)
  
  try {
    await navigator.clipboard.writeText(url)
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = url
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
}

/**
 * Sanitize swap parameters to remove invalid values
 * @param params - Raw parameters
 * @returns Sanitized parameters
 */
export function sanitizeSwapParams(params: SwapUrlParams): SwapUrlParams {
  const sanitized: SwapUrlParams = {}
  
  // Token addresses or symbols
  if (params.from && (isValidTokenAddress(params.from) || /^[A-Z]+$/.test(params.from))) {
    sanitized.from = params.from
  }
  
  if (params.to && (isValidTokenAddress(params.to) || /^[A-Z]+$/.test(params.to))) {
    sanitized.to = params.to
  }
  
  // Chain IDs
  if (params.fromChain && params.fromChain > 0) {
    sanitized.fromChain = params.fromChain
  }
  
  if (params.toChain && params.toChain > 0) {
    sanitized.toChain = params.toChain
  }
  
  // Amount (positive number)
  if (params.amount && !isNaN(parseFloat(params.amount)) && parseFloat(params.amount) > 0) {
    sanitized.amount = params.amount
  }
  
  // Exact field
  if (params.exactField === 'input' || params.exactField === 'output') {
    sanitized.exactField = params.exactField
  }
  
  // Slippage (0-100%)
  if (params.slippage && params.slippage >= 0 && params.slippage <= 100) {
    sanitized.slippage = params.slippage
  }
  
  // Theme
  if (params.theme === 'light' || params.theme === 'dark') {
    sanitized.theme = params.theme
  }
  
  return sanitized
}

/**
 * Parse human-readable amount to blockchain amount (with decimals)
 * Example: "10" USDC (6 decimals) → "10000000"
 * Example: "1.5" ETH (18 decimals) → "1500000000000000000"
 */
export function parseTokenAmount(amount: string, decimals: number): string {
  if (!amount || amount === '0' || amount === '') return '0'
  
  try {
    // Use ethers parseUnits to handle decimal conversion
    const parsed = parseUnits(amount, decimals)
    return parsed.toString()
  } catch (error) {
    console.error('Failed to parse token amount:', error)
    return '0'
  }
}

/**
 * Format blockchain amount to human-readable (with decimals)
 * Example: "10000000" USDC (6 decimals) → "10"
 * Example: "1500000000000000000" ETH (18 decimals) → "1.5"
 */
export function formatTokenAmount(amount: string | number | bigint, decimals: number): string {
  if (!amount || amount === '0' || amount === 0) return '0'
  
  try {
    // Convert to string first, then handle different formats
    let amountStr = amount.toString()
    
    // If it's already a decimal number (like 10887315.12), return as is
    if (typeof amount === 'number' && !Number.isInteger(amount)) {
      return amountStr
    }
    
    // If it's a decimal string (like "10887315.12"), return as is  
    if (typeof amount === 'string' && amount.includes('.')) {
      return amountStr
    }
    
    // Otherwise, treat as blockchain amount (wei/smallest unit) and format
    const formatted = formatUnits(amountStr, decimals)
    return formatted
  } catch (error) {
    console.error('Failed to format token amount:', error, { amount, decimals })
    return '0'
  }
}

/**
 * Check if amount string is valid for token input
 */
export function isValidTokenAmount(amount: string): boolean {
  if (!amount || amount.trim() === '') return false
  
  try {
    // Try to parse with parseUnits - will throw if invalid
    parseUnits(amount, 18) // Use 18 decimals as default for validation
    return true
  } catch {
    return false
  }
} 