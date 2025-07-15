/**
 * Shared formatting utilities for portfolio components
 * Prevents code duplication between portfolio-overview and token-holdings
 */

/**
 * Format currency values with appropriate suffixes
 */
export const formatCurrency = (value: number): string => {
  if (value === 0) return '$0.00'
  if (Math.abs(value) < 0.01) return value >= 0 ? '<$0.01' : '>-$0.01'
  if (Math.abs(value) < 1000) return `$${value.toFixed(2)}`
  if (Math.abs(value) < 1000000) return `$${(value / 1000).toFixed(1)}K`
  return `$${(value / 1000000).toFixed(1)}M`
}

/**
 * Format token balance amounts with appropriate precision
 */
export const formatBalance = (balanceFormatted: number): string => {
  if (isNaN(balanceFormatted) || balanceFormatted === 0) return '0'
  if (balanceFormatted < 0.0001) return balanceFormatted.toExponential(2)
  if (balanceFormatted < 1) return balanceFormatted.toFixed(6)
  if (balanceFormatted < 1000) return balanceFormatted.toFixed(4)
  if (balanceFormatted < 1000000) return `${(balanceFormatted / 1000).toFixed(1)}K`
  return `${(balanceFormatted / 1000000).toFixed(1)}M`
}

/**
 * Format percentage values with appropriate sign
 */
export const formatPercentage = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

/**
 * Format large numbers with K/M suffixes
 */
export const formatNumber = (value: number): string => {
  if (value === 0) return '0'
  if (Math.abs(value) < 1000) return value.toString()
  if (Math.abs(value) < 1000000) return `${(value / 1000).toFixed(1)}K`
  return `${(value / 1000000).toFixed(1)}M`
}

/**
 * Professional color palette for charts - consistent across components
 */
export const chartColors = [
  '#22c55e', // Green
  '#3b82f6', // Blue  
  '#f59e0b', // Orange
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#6366f1', // Indigo
  '#f97316', // Orange-red
]

/**
 * Get color by index with fallback
 */
export const getChartColor = (index: number): string => {
  return chartColors[index % chartColors.length]
}

/**
 * Copy text to clipboard with error handling
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

/**
 * Generate QR code URL for addresses
 */
export const generateQRCodeUrl = (address: string): string => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(address)}`
}

/**
 * Truncate address for display
 */
export const truncateAddress = (address: string, startLength: number = 6, endLength: number = 4): string => {
  if (!address || address.length <= startLength + endLength) return address
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`
}

/**
 * Check if token is native (ETH, BNB, MATIC, etc.)
 */
export const isNativeToken = (token: any): boolean => {
  return token.tokenAddress === '0x0000000000000000000000000000000000000000' || 
         token.tokenSymbol === 'ETH' ||
         token.tokenSymbol === 'BNB' ||
         token.tokenSymbol === 'MATIC'
}

/**
 * Get token type display string
 */
export const getTokenTypeDisplay = (token: any): string => {
  return isNativeToken(token) ? 'Native Token' : 'ERC20 Token'
}

/**
 * Calculate allocation percentage
 */
export const calculateAllocation = (tokenValue: number, totalValue: number): number => {
  if (totalValue === 0) return 0
  return (tokenValue / totalValue) * 100
}

/**
 * Format allocation percentage for display
 */
export const formatAllocation = (tokenValue: number, totalValue: number): string => {
  return `${calculateAllocation(tokenValue, totalValue).toFixed(1)}%`
} 